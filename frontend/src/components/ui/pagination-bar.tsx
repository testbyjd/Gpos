"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  page: number;
  lastPage: number;
  total: number;
  perPage: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function PaginationBar({ page, lastPage, total, perPage, onPageChange, className }: Props) {
  if (lastPage <= 1) return null;

  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 border-t border-border/80 px-4 py-3", className)}>
      <p className="text-xs font-semibold text-muted-foreground">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
          Pehle
        </Button>
        <span className="min-w-[5rem] text-center text-xs font-bold tabular-nums text-foreground">
          {page} / {lastPage}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          Agle
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
