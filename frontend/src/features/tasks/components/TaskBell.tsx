"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchTaskSummary } from "@/features/tasks/api/tasks";
import { TaskPanel } from "./TaskPanel";

export function TaskBell() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [highCount, setHighCount] = useState(0);

  const refreshSummary = useCallback(() => {
    fetchTaskSummary()
      .then((res) => {
        setOpenCount(res.open_assigned);
        setHighCount(res.open_high);
      })
      .catch(() => {
        /* logged-in pages only; panel shows load errors */
      });
  }, []);

  useEffect(() => {
    refreshSummary();
    const id = window.setInterval(refreshSummary, 60_000);
    return () => window.clearInterval(id);
  }, [refreshSummary]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group relative flex h-11 min-w-[8.5rem] items-center gap-2.5 rounded-xl border border-border/70 bg-card/90 px-2.5 text-left text-muted-foreground shadow-sm transition-all hover:-translate-y-px hover:border-primary/30 hover:bg-card hover:text-foreground hover:shadow-md active:translate-y-0 active:scale-[0.98]",
          open && "border-primary/40 bg-primary/[0.06] text-primary shadow-md ring-2 ring-primary/10",
        )}
        aria-label="Tasks"
        title="Staff tasks"
      >
        <span
          className={cn(
            "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground",
            highCount > 0 && "bg-danger/10 text-danger group-hover:bg-danger group-hover:text-white",
          )}
        >
          <Bell className="h-[1.125rem] w-[1.125rem]" />
          {openCount > 0 && (
            <span className={cn(
              "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-card",
              highCount > 0 ? "bg-danger" : "bg-primary",
            )} />
          )}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-xs font-extrabold text-foreground">Staff tasks</span>
          <span className={cn(
            "mt-0.5 block text-[10px] font-semibold text-muted-foreground",
            highCount > 0 && "text-danger",
          )}>
            {openCount > 0
              ? `${openCount} pending${highCount > 0 ? ` · ${highCount} urgent` : ""}`
              : "All caught up"}
          </span>
        </span>
      </button>

      {open && (
        <TaskPanel
          anchorRef={rootRef}
          onClose={() => setOpen(false)}
          onChanged={refreshSummary}
        />
      )}
    </div>
  );
}
