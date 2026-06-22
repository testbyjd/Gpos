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
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((p) => {
        const low = p.stock <= 10;
        return (
          <button
            key={p.id}
            onClick={() => onAdd(p)}
            className="group flex items-stretch gap-2 rounded-lg border border-border/80 bg-card p-1.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card-hover hover:shadow-md active:translate-y-0 active:scale-[0.99]"
          >
            <span className="relative flex h-[4.25rem] w-[4.25rem] shrink-0 overflow-hidden rounded-md bg-muted text-2xl shadow-inner">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveAssetUrl(p.imageUrl)}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">{p.emoji ?? "📦"}</span>
              )}
            </span>

            <span className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
              <span>
                <span className="line-clamp-2 text-[13px] font-semibold leading-4 text-foreground">
                  {p.name}
                </span>
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-4",
                    low
                      ? "bg-warning/15 text-warning ring-1 ring-warning/20"
                      : "bg-muted text-muted-foreground ring-1 ring-border/70",
                  )}
                >
                  {low ? "Low stock" : `${p.stock} ${p.unit}`}
                </span>
              </span>
              <span className="text-sm font-black tabular-nums text-primary">
                {formatMoney(p.price)}
                <span className="ml-1 text-[11px] font-semibold text-muted-foreground">/{p.unit}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
