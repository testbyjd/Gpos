"use client";

import { cn } from "@/lib/utils";

interface FilterChipsProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: FilterChipsProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap items-center gap-1", className)}
    >
      {options.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              "h-8 rounded-md px-2.5 text-xs font-bold transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "border border-border/80 bg-card text-muted-foreground hover:bg-card-hover hover:text-foreground",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
