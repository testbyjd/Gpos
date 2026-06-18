"use client";

import { type RefObject } from "react";
import { Search, ScanLine } from "lucide-react";

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  resultCount: number;
}

export function ProductSearch({ value, onValueChange, inputRef, resultCount }: Props) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-muted-foreground" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        autoFocus
        placeholder="Search products by name or scan barcode…"
        className="h-12 w-full rounded-lg border border-border/80 bg-input pl-10 pr-28 text-sm font-medium text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
      />
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {resultCount} items
        </span>
        <kbd className="hidden items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex">
          F2
        </kbd>
        <ScanLine className="h-[1.125rem] w-[1.125rem] text-muted-foreground" />
      </div>
    </div>
  );
}
