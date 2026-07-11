"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, Plus, Star, StarOff } from "lucide-react";
import { resolveAssetUrl } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Product } from "../types";

export function MeriShelf({
  open,
  onToggle,
  products,
  shelfIds,
  onToggleShelf,
  onAdd,
}: {
  open: boolean;
  onToggle: () => void;
  products: Product[];
  shelfIds: string[];
  onToggleShelf: (id: string) => void;
  onAdd: (p: Product) => void;
}) {
  const [filter, setFilter] = useState("");
  const [picking, setPicking] = useState(false);

  const shelfProducts = useMemo(() => {
    const idSet = new Set(shelfIds);
    const q = filter.trim().toLowerCase();
    return products
      .filter((p) => idSet.has(p.id))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.barcode?.toLowerCase().includes(q) ?? false),
      );
  }, [products, shelfIds, filter]);

  const pickerProducts = useMemo(() => {
    const idSet = new Set(shelfIds);
    const q = filter.trim().toLowerCase();
    return products
      .filter((p) => !idSet.has(p.id))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.barcode?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 40);
  }, [products, shelfIds, filter]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        aria-label="Items shelf kholo"
        className="hidden w-10 shrink-0 flex-col items-center justify-center gap-2 border-l border-border/80 bg-surface text-primary transition-colors hover:bg-primary/10 lg:flex"
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="text-[10px] font-black uppercase tracking-wide [writing-mode:vertical-rl]">
          Items
        </span>
      </button>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col border-l border-border/80 bg-surface lg:w-[min(42%,420px)] lg:shrink-0">
      <div className="flex items-start justify-between gap-2 border-b border-border/70 px-3 py-3">
        <div>
          <h2 className="text-sm font-black uppercase tracking-wide text-primary">
            Meri Shelf
          </h2>
          <p className="text-xs text-muted-foreground">{shelfProducts.length} items</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {picking
              ? "Catalog se ★ dabao — shelf pe add ho jayega"
              : "Shelf par click = bill mein add · ★ = shelf se hatao"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {picking ? (
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-primary/40 px-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Add product
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            className="hidden h-8 items-center justify-center rounded-md border border-border px-2.5 text-xs font-bold leading-none text-muted-foreground transition-colors hover:bg-card-hover lg:inline-flex"
          >
            Band
          </button>
        </div>
      </div>

      <div className="border-b border-border/70 px-3 py-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Shelf filter — naam ya barcode..."
          className="h-10 w-full rounded-lg border border-border/80 bg-muted/40 px-3 text-sm font-semibold outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {picking ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground">Catalog se shelf pe add karo</p>
            {pickerProducts.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Koi product nahi mila.</p>
            ) : (
              <ul className="space-y-1.5">
                {pickerProducts.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onToggleShelf(p.id)}
                      className="flex w-full items-center gap-2 rounded-lg border border-border/70 px-2 py-2 text-left transition-colors hover:bg-card-hover hover:border-primary/40"
                    >
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      <Star className="ml-auto h-4 w-4 shrink-0 text-warning" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : shelfProducts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <LayoutGrid className="h-12 w-12 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-bold text-foreground">Shelf khali hai</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ata, cheeni, dal jaisi cheezein yahan rakho — click se bill mein add.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-primary/40 px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              Add product
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {shelfProducts.map((p) => (
              <div
                key={p.id}
                className="card-lift relative overflow-hidden rounded-xl border border-border/80 bg-card"
              >
                <button
                  type="button"
                  onClick={() => onAdd(p)}
                  className="flex w-full flex-col items-stretch p-2 text-left"
                >
                  <span className="mb-2 flex h-16 items-center justify-center overflow-hidden rounded-md bg-surface ring-1 ring-border/40">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveAssetUrl(p.imageUrl)}
                        alt=""
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-2xl">{p.emoji ?? "📦"}</span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-bold leading-snug">{p.name}</span>
                  <span className="mt-1 text-sm font-black tabular-nums text-primary">
                    {formatMoney(p.price)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleShelf(p.id)}
                  className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface/95 text-warning shadow-sm ring-1 ring-border/60 backdrop-blur transition-colors hover:bg-surface"
                  aria-label="Shelf se hatao"
                >
                  <StarOff className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
