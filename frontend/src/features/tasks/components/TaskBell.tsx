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
          "relative flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card-hover hover:text-foreground sm:px-3",
          open && "border-primary/40 text-primary",
        )}
        aria-label="Tasks"
        title="Staff tasks"
      >
        <Bell className="h-4 w-4 shrink-0" />
        <span className="text-xs font-bold">Tasks</span>
        {openCount > 0 && (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black text-white",
              highCount > 0 ? "bg-danger" : "bg-primary",
            )}
          >
            {openCount > 9 ? "9+" : openCount}
          </span>
        )}
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
