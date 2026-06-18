"use client";

import { useState } from "react";
import { CalendarClock, PackageCheck, Sparkles, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMoney } from "@/lib/utils";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import type { UnitType } from "@/features/pos/types";
import {
  PURCHASE_CATEGORIES,
  UNITS,
  newAverageCost,
  type PurchaseProduct,
} from "../data/purchasing";

export interface DraftLine {
  id: string;
  barcode: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  cost: number;
  isNew: boolean;
  sellPrice: number;
  expiry?: string;
  promo: { price: number; start: string; end: string } | null;
  prevAvg?: number;
  newAvg?: number;
}

const inputCls =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
const labelCls =
  "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

interface Props {
  barcode: string;
  existing?: PurchaseProduct;
  onAdd: (line: Omit<DraftLine, "id">) => void;
  onClose: () => void;
}

export function ReceiveItemModal({ barcode, existing, onAdd, onClose }: Props) {
  useModalDismiss(onClose);
  const isNew = !existing;

  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(existing ? String(existing.lastCost) : "");
  // New-product fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(PURCHASE_CATEGORIES[0]);
  const [unit, setUnit] = useState<UnitType>("pcs");
  const [sellPrice, setSellPrice] = useState("");
  // Optional fields
  const [expiry, setExpiry] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  const [promoPrice, setPromoPrice] = useState("");
  const [promoStart, setPromoStart] = useState("");
  const [promoEnd, setPromoEnd] = useState("");

  const qtyNum = parseFloat(qty) || 0;
  const costNum = parseFloat(cost) || 0;
  const sellNum = parseFloat(sellPrice) || 0;
  const promoNum = parseFloat(promoPrice) || 0;
  const lineTotal = qtyNum * costNum;

  const resolvedUnit = existing ? existing.unit : unit;
  const resolvedName = existing ? existing.name : name.trim();
  const avgPreview = existing
    ? newAverageCost(existing.stock, existing.avgCost, qtyNum, costNum)
    : costNum;

  const valid =
    qtyNum > 0 && costNum > 0 && (existing ? true : resolvedName.length > 0 && sellNum > 0);

  function submit() {
    if (!valid) return;
    onAdd({
      barcode,
      name: resolvedName,
      category: existing ? existing.category : category,
      unit: resolvedUnit,
      qty: qtyNum,
      cost: costNum,
      isNew,
      sellPrice: existing ? existing.sellPrice : sellNum,
      expiry: expiry || undefined,
      promo: showPromo && promoNum > 0 ? { price: promoNum, start: promoStart, end: promoEnd } : null,
      prevAvg: existing ? existing.avgCost : undefined,
      newAvg: existing ? avgPreview : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receive-modal-title"
      onClick={onClose}
    >
      <section
        className="animate-fade-in max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/80 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg",
                isNew ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary",
              )}
            >
              {isNew ? <Sparkles className="h-5 w-5" /> : <PackageCheck className="h-5 w-5" />}
            </span>
            <div>
              <h2 id="receive-modal-title" className="text-base font-black text-foreground">
                {isNew ? "New Product" : existing!.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {barcode ? `Barcode ${barcode}` : "No barcode"}
                {isNew && " · not in catalog yet"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Existing product summary */}
          {existing && (
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/80 bg-card p-3 text-center">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last price</p>
                <p className="mt-1 font-black tabular-nums text-foreground">{formatMoney(existing.lastCost)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg cost</p>
                <p className="mt-1 font-black tabular-nums text-foreground">{formatMoney(existing.avgCost)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">In stock</p>
                <p className="mt-1 font-black tabular-nums text-foreground">{existing.stock} {existing.unit}</p>
              </div>
            </div>
          )}

          {/* New product fields */}
          {isNew && (
            <div className="space-y-3">
              <label className="block">
                <span className={labelCls}>Product name</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mango Juice 1L"
                  className={inputCls}
                />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className={labelCls}>Category</span>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    {PURCHASE_CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>Unit</span>
                  <select value={unit} onChange={(e) => setUnit(e.target.value as UnitType)} className={inputCls}>
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>Sell price</span>
                  <input
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                    className={inputCls}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Quantity + cost */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Quantity ({resolvedUnit})</span>
              <input
                autoFocus={!isNew}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Purchase cost / {resolvedUnit}</span>
              <input
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className={inputCls}
              />
            </label>
          </div>

          {/* Live totals + moving-average preview */}
          <div className="flex items-center justify-between rounded-lg bg-muted px-4 py-3 text-sm">
            <span className="font-semibold text-muted-foreground">Line total</span>
            <span className="text-lg font-black tabular-nums text-foreground">{formatMoney(lineTotal)}</span>
          </div>
          {existing && qtyNum > 0 && costNum > 0 && (
            <p className="text-xs text-muted-foreground">
              New moving-average cost:{" "}
              <span className="font-bold text-foreground">{formatMoney(avgPreview)}</span>{" "}
              <span className={cn(avgPreview > existing.avgCost ? "text-warning" : "text-success")}>
                ({avgPreview > existing.avgCost ? "▲" : "▼"} from {formatMoney(existing.avgCost)})
              </span>
            </p>
          )}

          {/* Expiry */}
          <label className="block">
            <span className={labelCls}>
              <CalendarClock className="mr-1 inline h-3.5 w-3.5" />
              Expiry date (optional)
            </span>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className={inputCls} />
          </label>

          {/* Promotion — collapsed behind "extra options" */}
          {!showPromo ? (
            <button
              onClick={() => setShowPromo(true)}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Tag className="h-4 w-4" />
              Extra options · Add promotion
            </button>
          ) : (
            <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-black text-foreground">
                  <Tag className="h-4 w-4 text-accent" />
                  Promotion
                </span>
                <button
                  onClick={() => setShowPromo(false)}
                  className="text-xs font-bold text-muted-foreground hover:text-danger"
                >
                  Remove
                </button>
              </div>
              <label className="block">
                <span className={labelCls}>Promo price / {resolvedUnit}</span>
                <input
                  value={promoPrice}
                  onChange={(e) => setPromoPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                  className={inputCls}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={labelCls}>Starts</span>
                  <input type="date" value={promoStart} onChange={(e) => setPromoStart(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className={labelCls}>Ends</span>
                  <input type="date" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)} className={inputCls} />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 grid grid-cols-3 gap-2 border-t border-border/80 bg-surface px-5 py-3.5">
          <Button variant="secondary" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button size="lg" className="col-span-2" disabled={!valid} onClick={submit}>
            Add to purchase
          </Button>
        </div>
      </section>
    </div>
  );
}
