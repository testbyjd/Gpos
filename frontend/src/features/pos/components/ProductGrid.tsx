"use client";

import { PackageX } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import type { Product } from "../types";

interface Props {
  products: Product[];
  onAdd: (p: Product) => void;
}

export function ProductGrid({ products, onAdd }: Props) {
  if (products.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
        <PackageX className="h-10 w-10" />
        <p className="text-sm">No products match your search.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {products.map((p) => {
        const low = p.stock <= 10;
        return (
          <button
            key={p.id}
            onClick={() => onAdd(p)}
            className="group flex min-h-[8.75rem] flex-col rounded-lg border border-border/80 bg-card p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card-hover hover:shadow-md active:translate-y-0 active:scale-[0.99]"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-2xl shadow-inner">
                {p.emoji ?? "📦"}
              </span>
              <span
                className={cn(
                  "max-w-[5.5rem] truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-4",
                  low
                    ? "bg-warning/15 text-warning ring-1 ring-warning/20"
                    : "bg-muted text-muted-foreground ring-1 ring-border/70",
                )}
              >
                {low ? "Low" : `${p.stock}`} {p.unit}
              </span>
            </div>
            <span className="line-clamp-2 min-h-[2.35rem] text-[13px] font-semibold leading-5 text-foreground">
              {p.name}
            </span>
            <div className="mt-auto flex items-end justify-between gap-2 pt-2">
              <span className="text-sm font-black tabular-nums text-primary">
                {formatMoney(p.price)}
              </span>
              <span className="text-xs text-muted-foreground">/{p.unit}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
