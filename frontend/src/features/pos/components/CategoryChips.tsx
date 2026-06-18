"use client";

import { cn } from "@/lib/utils";

interface Props {
  categories: readonly string[];
  active: string;
  onSelect: (c: string) => void;
}

export function CategoryChips({ categories, active, onSelect }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          className={cn(
            "h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition-all",
            active === c
              ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "border-border/80 bg-card text-muted-foreground hover:border-primary/30 hover:bg-card-hover hover:text-foreground",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
