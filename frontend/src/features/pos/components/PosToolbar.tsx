"use client";

import { ClipboardList, LayoutGrid, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-xs font-bold text-muted-foreground transition-all hover:border-border/80 hover:bg-card hover:text-foreground hover:shadow-sm active:scale-[0.97]";

interface Props {
  shelfOpen: boolean;
  onToggleShelf: () => void;
  onReturn?: () => void;
}

export function PosToolbar({ shelfOpen, onToggleShelf, onReturn }: Props) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-border/60 bg-muted/35 px-3 py-1.5 sm:px-5">
      <button type="button" onClick={onReturn} className={chip}>
        <RotateCcw className="h-3.5 w-3.5" />
        Return
      </button>
      <button
        type="button"
        onClick={onToggleShelf}
        aria-pressed={shelfOpen}
        className={cn(
          chip,
          shelfOpen &&
            "border-primary/20 bg-primary/10 text-primary shadow-sm",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Items{shelfOpen ? " · ON" : ""}
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
