"use client";

import { PackageX } from "lucide-react";
import { resolveAssetUrl } from "@/lib/api";
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
            className="group flex flex-col gap-1 rounded-lg border border-border/80 bg-card p-2 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card-hover hover:shadow-md active:translate-y-0 active:scale-[0.99]"
          >
            <div className="relative">
              <span className="flex h-[4.5rem] w-full items-center justify-center overflow-hidden rounded-md bg-muted text-2xl shadow-inner">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveAssetUrl(p.imageUrl)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  p.emoji ?? "📦"
                )}
              </span>
              <span
                className={cn(
                  "absolute right-1 top-1 max-w-[calc(100%-0.5rem)] truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-4 shadow-sm",
                  low
                    ? "bg-warning/15 text-warning ring-1 ring-warning/20"
                    : "bg-card/95 text-muted-foreground ring-1 ring-border/70 backdrop-blur-sm",
                )}
              >
                {low ? "Low" : `${p.stock}`} {p.unit}
              </span>
            </div>
            <span className="line-clamp-2 text-[12px] font-semibold leading-4 text-foreground">
              {p.name}
            </span>
            <div className="flex items-end justify-between gap-1">
              <span className="text-sm font-black tabular-nums text-primary">
                {formatMoney(p.price)}
              </span>
              <span className="text-[11px] text-muted-foreground">/{p.unit}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
