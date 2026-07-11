"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, PackageCheck, Sparkles, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMoney } from "@/lib/utils";
import type { UnitType } from "@/features/pos/types";
import { createCategory, type CategoryRow } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { UNITS, newAverageCost, type PurchaseProduct } from "../data/purchasing";

export interface DraftLine {
  id: string;
  productId?: number;
  barcode: string;
  name: string;
  category: string;
  category_id?: number | null;
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
  /** Catalog for name search (manual / loose receive). */
  catalog?: PurchaseProduct[];
  categories: CategoryRow[];
  onAdd: (line: Omit<DraftLine, "id">) => void;
  onClose: () => void;
  onCategoryAdded?: (category: CategoryRow) => void;
}

export function ReceiveItemModal({
  barcode,
  existing,
  catalog = [],
  categories,
  onAdd,
  onClose,
  onCategoryAdded,
}: Props) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const [picked, setPicked] = useState<PurchaseProduct | null>(existing ?? null);
  const [localCategories, setLocalCategories] = useState(categories);
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(existing ? String(existing.lastCost) : "");
  // New-product fields
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [unit, setUnit] = useState<UnitType>("pcs");
  const [sellPrice, setSellPrice] = useState("");
  // Optional fields
  const [expiry, setExpiry] = useState("");
  const [showPromo, setShowPromo] = useState(false);
  const [promoPrice, setPromoPrice] = useState("");
  const [promoStart, setPromoStart] = useState("");
  const [promoEnd, setPromoEnd] = useState("");

  const active = picked ?? existing ?? null;
  const isNew = !active;
  const resolvedBarcode = active?.barcode || barcode;
  const allowNameSearch = !existing && !barcode.trim();

  const nameMatches = useMemo(() => {
    if (!allowNameSearch || !isNew) return [];
    const q = name.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog
      .filter((p) => p.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aLoose = !a.barcode ? 0 : 1;
        const bLoose = !b.barcode ? 0 : 1;
        if (aLoose !== bLoose) return aLoose - bLoose;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8);
  }, [allowNameSearch, isNew, name, catalog]);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  function selectExisting(product: PurchaseProduct) {
    setPicked(product);
    setCost(String(product.lastCost));
    setName("");
    setQty("");
  }

  function clearPicked() {
    setPicked(null);
    setCost("");
    setQty("");
  }

  async function addCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setCategoryError("Category name likho.");
      return;
    }
    setAddingCategory(true);
    setCategoryError(null);
    try {
      const res = await createCategory(trimmed);
      setLocalCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(String(res.data.id));
      setNewCategoryName("");
      setShowNewCategory(false);
      onCategoryAdded?.(res.data);
    } catch (err) {
      setCategoryError(getErrorMessage(err, "Category add nahi hui."));
    } finally {
      setAddingCategory(false);
    }
  }

  const qtyNum = parseFloat(qty) || 0;
  const costNum = parseFloat(cost) || 0;
  const sellNum = parseFloat(sellPrice) || 0;
  const promoNum = parseFloat(promoPrice) || 0;
  const lineTotal = qtyNum * costNum;

  const resolvedUnit = active ? active.unit : unit;
  const resolvedName = active ? active.name : name.trim();
  const avgPreview = active
    ? newAverageCost(active.stock, active.avgCost, qtyNum, costNum)
    : costNum;

  const valid =
    qtyNum > 0 && costNum > 0 && (active ? true : resolvedName.length > 0 && sellNum > 0);

  function submit() {
    if (!valid) return;
    const pickedCat = localCategories.find((c) => String(c.id) === categoryId);
    onAdd({
      productId: active?.id,
      barcode: resolvedBarcode,
      name: resolvedName,
      category: active ? active.category : pickedCat?.name ?? "Uncategorized",
      category_id: active ? undefined : pickedCat?.id ?? null,
      unit: resolvedUnit,
      qty: qtyNum,
      cost: costNum,
      isNew,
      sellPrice: active ? active.sellPrice : sellNum,
      expiry: expiry || undefined,
      promo: showPromo && promoNum > 0 ? { price: promoNum, start: promoStart, end: promoEnd } : null,
      prevAvg: active ? active.avgCost : undefined,
      newAvg: active ? avgPreview : undefined,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receive-modal-title"
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
                {isNew ? "New Product" : active!.name}
              </h2>
              <p className="text-xs text-muted-foreground">
                {resolvedBarcode ? `Barcode ${resolvedBarcode}` : "No barcode · loose item"}
                {isNew && " · not in catalog yet"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cancel"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Existing product summary */}
          {active && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border/80 bg-card p-3 text-center">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Last price</p>
                  <p className="mt-1 font-black tabular-nums text-foreground">{formatMoney(active.lastCost)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg cost</p>
                  <p className="mt-1 font-black tabular-nums text-foreground">{formatMoney(active.avgCost)}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">In stock</p>
                  <p className="mt-1 font-black tabular-nums text-foreground">
                    {active.stock} {active.unit}
                  </p>
                </div>
              </div>
              {allowNameSearch && (
                <button
                  type="button"
                  onClick={clearPicked}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  ← Different item / create new
                </button>
              )}
            </div>
          )}

          {isNew && allowNameSearch && (
            <p className="rounded-md border border-border/80 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Pehle name se search karo — agar item mil jaye to select karo (same loose stock update hogi). Naya banana ho to naya name likho.
            </p>
          )}

          {/* New product fields */}
          {isNew && (
            <div className="space-y-3">
              <label className="block">
                <span className={labelCls}>{allowNameSearch ? "Search or new name" : "Product name"}</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={allowNameSearch ? "e.g. Loose sugar, Mango…" : "e.g. Mango Juice 1L"}
                  className={inputCls}
                />
              </label>
              {nameMatches.length > 0 && (
                <ul className="max-h-40 overflow-y-auto rounded-lg border border-border/80 bg-card">
                  {nameMatches.map((p) => (
                    <li key={p.id ?? p.name}>
                      <button
                        type="button"
                        onClick={() => selectExisting(p)}
                        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-card-hover"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-foreground">{p.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {p.barcode || "no barcode"} · stock {p.stock} {p.unit}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                          {formatMoney(p.lastCost)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className={labelCls}>Category</span>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
                    <option value="">Uncategorized</option>
                    {localCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {!showNewCategory ? (
                    <button
                      type="button"
                      onClick={() => setShowNewCategory(true)}
                      className="mt-1.5 text-xs font-bold text-primary hover:underline"
                    >
                      + New category
                    </button>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Category name"
                        className={inputCls}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={addCategory} disabled={addingCategory}>
                          {addingCategory ? "..." : "Add"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setShowNewCategory(false);
                            setCategoryError(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
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
              {categoryError && (
                <p className="text-xs font-bold text-danger">{categoryError}</p>
              )}
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
          {active && qtyNum > 0 && costNum > 0 && (
            <p className="text-xs text-muted-foreground">
              New moving-average cost:{" "}
              <span className="font-bold text-foreground">{formatMoney(avgPreview)}</span>{" "}
              <span className={cn(avgPreview > active.avgCost ? "text-warning" : "text-success")}>
                ({avgPreview > active.avgCost ? "▲" : "▼"} from {formatMoney(active.avgCost)})
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
