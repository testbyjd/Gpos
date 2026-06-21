"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStoredUser } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api";
import { getUsersSettings, type UserSettingsRow } from "@/lib/admin-api";
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
  type TaskPriority,
  type TaskRow,
} from "@/features/tasks/api/tasks";

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_TONE: Record<TaskPriority, string> = {
  high: "border-danger/40 bg-danger/10 text-danger",
  medium: "border-warning/40 bg-warning/10 text-warning",
  low: "border-border bg-muted text-muted-foreground",
};

interface TaskPanelProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  onChanged: () => void;
}

export function TaskPanel({ anchorRef, onClose, onChanged }: TaskPanelProps) {
  const user = getStoredUser();
  const isOwner = user?.role === "owner";
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [users, setUsers] = useState<UserSettingsRow[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignedTo, setAssignedTo] = useState<number | "">("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);

  function loadTasks() {
    setLoading(true);
    return listTasks()
      .then((res) => {
        setTasks(res.data);
        setError(null);
      })
      .catch((err) => {
        setTasks([]);
        setError(getErrorMessage(err, "Tasks load nahi hue — server/migration check karo."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTasks();
    if (isOwner) {
      getUsersSettings()
        .then((res) => setUsers(res.data.filter((u) => u.is_active)))
        .catch(() => {});
    }
  }, [isOwner]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const root = anchorRef.current;
      if (root && !root.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [anchorRef, onClose]);

  const visible = useMemo(
    () => tasks.filter((t) => showDone || t.status === "open"),
    [tasks, showDone],
  );

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await createTask({
        title: trimmed,
        priority,
        due_at: dueAt || undefined,
        assigned_to: isOwner && assignedTo ? Number(assignedTo) : undefined,
      });
      setTitle("");
      setPriority("medium");
      setAssignedTo("");
      setDueAt("");
      await loadTasks();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Task save nahi hua."));
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(task: TaskRow) {
    try {
      await updateTask(task.id, { status: task.status === "open" ? "done" : "open" });
      await loadTasks();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Update fail."));
    }
  }

  async function removeTask(task: TaskRow) {
    if (!window.confirm(`"${task.title}" delete karein?`)) return;
    try {
      await deleteTask(task.id);
      await loadTasks();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, "Delete fail."));
    }
  }

  return (
    <div
      className="absolute right-0 top-full z-[120] mt-2 w-[min(100vw-2rem,380px)] overflow-hidden rounded-xl border border-border/80 bg-card shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
        <div>
          <p className="font-black text-foreground">Tasks</p>
          <p className="text-xs text-muted-foreground">Priority wise · mark done</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close tasks"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={onAdd} className="space-y-2 border-b border-border/80 p-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Naya task likho…"
          className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        />
        <div className="flex flex-wrap gap-2">
          {(["high", "medium", "low"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-bold capitalize",
                priority === p ? PRIORITY_TONE[p] : "border-border text-muted-foreground",
              )}
            >
              {PRIORITY_LABEL[p]}
            </button>
          ))}
        </div>
        <label className="block text-xs font-semibold text-muted-foreground">
          Due date (optional)
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-input px-2 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          />
        </label>
        {isOwner && users.length > 0 && (
          <label className="block text-xs font-semibold text-muted-foreground">
            Assign to
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : "")}
              className="mt-1 h-9 w-full rounded-md border border-border bg-input px-2 text-sm font-semibold"
            >
              <option value="">Khud (self)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </label>
        )}
        <Button type="submit" size="sm" className="w-full" disabled={saving || !title.trim()}>
          <Plus className="h-4 w-4" />
          {saving ? "Saving…" : "Add task"}
        </Button>
      </form>

      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="flex items-center gap-1 text-xs font-bold text-primary"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDone && "rotate-180")} />
          {showDone ? "Done tasks hide karo" : "Done tasks dikhao"}
        </button>
        <span className="text-xs text-muted-foreground">{visible.length} shown</span>
      </div>

      {error && (
        <p className="mx-3 mb-2 rounded-md border border-danger/30 bg-danger/10 px-2 py-1.5 text-xs font-bold text-danger">
          {error}
        </p>
      )}

      <ul className="max-h-72 space-y-2 overflow-y-auto px-3 pb-3">
        {loading && <li className="py-6 text-center text-sm text-muted-foreground">Loading…</li>}
        {!loading && visible.length === 0 && (
          <li className="py-6 text-center text-sm text-muted-foreground">Koi task nahi.</li>
        )}
        {visible.map((task) => {
          const canDelete = isOwner || task.creator?.id === user?.id;
          return (
            <li
              key={task.id}
              className={cn(
                "rounded-lg border border-border/80 p-3",
                task.status === "done" && "opacity-60",
              )}
            >
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => toggleDone(task)}
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                    task.status === "done"
                      ? "border-success bg-success text-success-foreground"
                      : "border-border bg-card hover:border-primary",
                  )}
                  aria-label={task.status === "done" ? "Reopen task" : "Mark done"}
                >
                  {task.status === "done" && <Check className="h-3 w-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-bold text-foreground", task.status === "done" && "line-through")}>
                    {task.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
                    <span className={cn("rounded-full border px-1.5 py-0.5", PRIORITY_TONE[task.priority])}>
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                    {task.assignee && (
                      <span className="text-muted-foreground">→ {task.assignee.name}</span>
                    )}
                    {task.due_at && task.status === "open" && (
                      <span className="text-muted-foreground">
                        · Due {new Date(task.due_at).toLocaleDateString("en-PK")}
                      </span>
                    )}
                  </div>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => removeTask(task)}
                    className="text-muted-foreground hover:text-danger"
                    aria-label="Delete task"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
