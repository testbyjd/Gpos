"use client";

import { ClipboardList, LayoutGrid, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-border/80 bg-white px-3 text-xs font-bold text-muted-foreground shadow-sm transition-colors hover:bg-card-hover hover:text-foreground dark:bg-card";

interface Props {
  shelfOpen: boolean;
  onToggleShelf: () => void;
  onReturn?: () => void;
}

export function PosToolbar({ shelfOpen, onToggleShelf, onReturn }: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 bg-[#f3f4f6] px-3 py-2 dark:bg-muted/40 sm:px-4">
      <button type="button" onClick={onReturn} className={chip}>
        <RotateCcw className="h-3.5 w-3.5" />
        Return
      </button>
      <button
        type="button"
        onClick={onToggleShelf}
        className={cn(
          chip,
          shelfOpen &&
            "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Items {shelfOpen ? "ON" : ""}
      </button>
      <Link href="/reports" className={chip}>
        <ClipboardList className="h-3.5 w-3.5" />
        Daily summary
      </Link>

      <p className="ml-auto hidden text-[11px] font-medium text-muted-foreground xl:block">
        F2 search · F6 return · F4 hold · F9 pay
      </p>
      <span className="sr-only">
        <Search className="h-3 w-3" />
      </span>
    </div>
  );
}
