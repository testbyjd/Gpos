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
    <div className="grid grid-cols-[repeat(auto-fill,minmax(12.5rem,1fr))] gap-1.5">
      {products.map((p) => {
        const outOfStock = Number(p.stock) <= 0;
        const low = !outOfStock && p.stock <= 10;
        return (
          <button
            key={p.id}
            type="button"
            disabled={outOfStock}
            onClick={() => {
              if (outOfStock) return;
              onAdd(p);
            }}
            className={cn(
              "group flex items-stretch gap-2 rounded-lg border border-border/80 bg-card p-1.5 text-left shadow-sm transition-all",
              outOfStock
                ? "cursor-not-allowed opacity-50"
                : "hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card-hover hover:shadow-md active:translate-y-0 active:scale-[0.99]",
            )}
          >
            <div className="relative flex size-[4.25rem] shrink-0 items-center justify-center overflow-hidden rounded-md bg-white shadow-inner ring-1 ring-border/40">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveAssetUrl(p.imageUrl)}
                  alt=""
                  className="max-h-full max-w-full object-contain object-center"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-muted text-2xl">{p.emoji ?? "📦"}</div>
              )}
            </div>

            <span className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
              <span>
                <span className="line-clamp-2 text-[13px] font-semibold leading-4 text-foreground">
                  {p.name}
                </span>
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-4",
                    outOfStock
                      ? "bg-danger/15 text-danger ring-1 ring-danger/20"
                      : low
                        ? "bg-warning/15 text-warning ring-1 ring-warning/20"
                        : "bg-muted text-muted-foreground ring-1 ring-border/70",
                  )}
                >
                  {outOfStock ? "Out of stock" : low ? "Low stock" : `${p.stock} ${p.unit}`}
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
