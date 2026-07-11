"use client";

import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Check, ChevronDown, CircleUserRound, ListTodo, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
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

function formatDueAt(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCreatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
  });
}

function dueAtForApi(value: string): string | undefined {
  if (!value) return undefined;
  return value.length === 16 ? `${value}:00` : value;
}

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
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignedTo, setAssignedTo] = useState<number | "">("");
  const [dueAt, setDueAt] = useState("");
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  useLayoutEffect(() => {
    function updatePosition() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        right: Math.max(16, window.innerWidth - rect.right),
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchorRef]);

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
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [anchorRef, onClose]);

  const visible = useMemo(
    () => tasks.filter((t) => showDone || t.status === "open"),
    [tasks, showDone],
  );
  const openTasks = tasks.filter((task) => task.status === "open");
  const urgentCount = openTasks.filter((task) => task.priority === "high").length;

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await createTask({
        title: trimmed,
        body: body.trim() || undefined,
        priority,
        due_at: dueAtForApi(dueAt),
        assigned_to: isOwner && assignedTo ? Number(assignedTo) : undefined,
      });
      setTitle("");
      setBody("");
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
    <ModalPortal>
      <div
        ref={panelRef}
        className="fixed z-[200] flex max-h-[calc(100dvh-5rem)] w-[min(100vw-2rem,560px)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-2xl shadow-black/15 ring-1 ring-black/5"
        style={
          position
            ? { top: position.top, right: position.right }
            : { top: 0, right: 16, visibility: "hidden" as const }
        }
      >
      <div className="flex items-center justify-between border-b border-border/80 bg-gradient-to-r from-primary/[0.08] to-transparent px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <ListTodo className="h-5 w-5" />
          </span>
          <div>
            <p className="text-base font-black text-foreground">Staff tasks</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {openTasks.length} pending{urgentCount > 0 ? ` · ${urgentCount} urgent` : ""}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close tasks"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={onAdd} className="space-y-3 border-b border-border/80 bg-muted/20 p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted-foreground">Create a new task</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Naya task likho…"
          className="h-11 w-full rounded-lg border border-border bg-input px-3 text-sm font-semibold shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Details / instructions (optional)…"
          rows={2}
          className="w-full resize-none rounded-lg border border-border bg-input px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-bold text-muted-foreground">Priority</span>
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
        <div className={cn("grid gap-2", isOwner && users.length > 0 && "sm:grid-cols-2")}>
        <label className="block text-xs font-semibold text-muted-foreground">
          Due date & time
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-2.5 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
          />
        </label>
        {isOwner && users.length > 0 && (
          <label className="block text-xs font-semibold text-muted-foreground">
            Assign to
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value ? Number(e.target.value) : "")}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-input px-2.5 text-sm font-semibold"
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
        </div>
        <Button type="submit" className="h-11 w-full rounded-lg" disabled={saving || !title.trim()}>
          <Plus className="h-4 w-4" />
          {saving ? "Saving…" : "Add task"}
        </Button>
      </form>

      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="flex items-center gap-1 text-xs font-bold text-primary"
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDone && "rotate-180")} />
          {showDone ? "Done tasks hide karo" : "Done tasks dikhao"}
        </button>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground">{visible.length} shown</span>
      </div>

      {error && (
        <p className="mx-3 mb-2 rounded-md border border-danger/30 bg-danger/10 px-2 py-1.5 text-xs font-bold text-danger">
          {error}
        </p>
      )}

      <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4 pt-3">
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
                "rounded-xl border border-border/80 bg-surface p-3.5 shadow-sm transition-colors hover:border-primary/25",
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
                  <p className={cn("text-sm font-bold text-foreground", task.status === "done" && "line-through")}>
                    {task.title}
                  </p>
                  {task.body && (
                    <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                      {task.body}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide">
                    <span className={cn("rounded-full border px-1.5 py-0.5", PRIORITY_TONE[task.priority])}>
                      {PRIORITY_LABEL[task.priority]}
                    </span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
                    {task.assignee && (
                      <span className="inline-flex items-center gap-1"><CircleUserRound className="h-3.5 w-3.5" /> {task.assignee.name}</span>
                    )}
                    {task.due_at && task.status === "open" && (
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Due {formatDueAt(task.due_at)}</span>
                    )}
                    <span className="ml-auto">Created {formatCreatedAt(task.created_at)}{task.creator ? ` by ${task.creator.name}` : ""}</span>
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
    </ModalPortal>
  );
}
