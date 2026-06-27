"use client";

import { type RefObject } from "react";
import { PackageX, Search, ScanLine } from "lucide-react";
import { resolveAssetUrl } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { Product } from "../types";

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  onSubmit: (raw: string) => void;
  results: Product[];
  onPick: (product: Product) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
}

export function SaleQuickAdd({
  value,
  onValueChange,
  onSubmit,
  results,
  onPick,
  inputRef,
  disabled,
}: Props) {
  const q = value.trim();
  const showResults = q.length > 0;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative shrink-0">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={value}
          disabled={disabled}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmit(e.currentTarget.value);
            }
          }}
          placeholder="Bill mein add — naam likho ya barcode scan karo…"
          className="h-12 w-full rounded-lg border border-border/80 bg-input pl-10 pr-28 text-sm font-medium text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60"
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          {showResults && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {results.length} match
            </span>
          )}
          <kbd className="hidden items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex">
            F2
          </kbd>
          <ScanLine className="h-[1.125rem] w-[1.125rem] text-muted-foreground" />
        </div>
      </div>

      {showResults && (
        <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-border/80 bg-card shadow-sm">
          {results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <PackageX className="h-4 w-4 shrink-0" />
              &quot;{q}&quot; se koi product nahi mila.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onPick(p)}
                    className="flex w-full items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-card-hover"
                  >
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-border/40">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveAssetUrl(p.imageUrl)}
                          alt=""
                          className="max-h-full max-w-full object-contain object-center"
                        />
                      ) : (
                        <span className="text-lg">{p.emoji ?? "📦"}</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{p.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {p.stock} {p.unit}
                        {p.barcode ? ` · ${p.barcode}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-black tabular-nums text-primary">
                      {formatMoney(p.price)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
