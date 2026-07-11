"use client";

import { useState, type RefObject } from "react";
import {
  Pause,
  ScanLine,
  Search,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import { resolveAssetUrl } from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";
import {
  cartLineDiscountTotal,
  cartSubtotal,
  discountPercent,
  freeLineDiscountCap,
  lineDiscountAmount,
  lineDiscountGate,
  lineNet,
  maxLineDiscount,
  requiresDiscountApproval,
} from "../discount";
import type { CartLine, HeldCart, PosCustomer, Product } from "../types";

function qtyToInputValue(qty: number, fractional: boolean): string {
  if (fractional) return qty.toFixed(3).replace(/\.?0+$/, "");
  return String(qty);
}

function parseQtyInput(raw: string, fractional: boolean): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  const rounded = fractional ? Math.round(parsed * 1000) / 1000 : Math.round(parsed);
  return rounded > 0 ? rounded : null;
}

function QtyCell({
  qty,
  fractional,
  unit,
  onSetQty,
}: {
  qty: number;
  fractional: boolean;
  unit: string;
  onSetQty: (qty: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => qtyToInputValue(qty, fractional));
  const displayValue = editing ? draft : qtyToInputValue(qty, fractional);

  function commit() {
    const parsed = parseQtyInput(draft, fractional);
    setEditing(false);
    if (parsed === null) {
      setDraft(qtyToInputValue(qty, fractional));
      return;
    }
    if (parsed !== qty) onSetQty(parsed);
  }

  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="text"
        inputMode={fractional ? "decimal" : "numeric"}
        value={displayValue}
        onChange={(e) => {
          const next = e.target.value;
          if (fractional) {
            if (next === "" || /^\d*\.?\d{0,3}$/.test(next)) setDraft(next);
          } else if (next === "" || /^\d+$/.test(next)) {
            setDraft(next);
          }
        }}
        onFocus={(e) => {
          setDraft(qtyToInputValue(qty, fractional));
          setEditing(true);
          e.target.select();
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setDraft(qtyToInputValue(qty, fractional));
            setEditing(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        title={fractional ? "Kg — 0.001 tak (jaise 0.200 = 200g)" : undefined}
        className={
          fractional
            ? "h-9 w-[4.5rem] rounded-md border border-border bg-card px-1.5 text-center text-sm font-bold tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            : "h-9 w-16 rounded-md border border-border bg-card px-2 text-center text-sm font-bold tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
        }
      />
      <span className="shrink-0 text-[11px] font-bold uppercase text-muted-foreground">{unit}</span>
    </div>
  );
}

interface Props {
  lines: CartLine[];
  customers: PosCustomer[];
  customerId: number | null;
  onCustomerChange: (id: number | null) => void;
  saleQuery: string;
  onSaleQueryChange: (v: string) => void;
  onSaleSubmit: (raw: string) => void;
  saleResults: Product[];
  onPickSale: (p: Product) => void;
  saleInputRef?: RefObject<HTMLInputElement | null>;
  searchDisabled?: boolean;
  discount: number;
  onDiscountChange: (d: number) => void;
  discountRecipientName: string;
  onDiscountRecipientNameChange: (value: string) => void;
  discountReason: string;
  onDiscountReasonChange: (value: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onSetLineDiscount: (id: string, amount: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onHold: () => void;
  onCheckout: () => void;
  onMorePay: () => void;
  onKhata: () => void;
  heldCarts: HeldCart[];
  onResume: (id: string) => void;
}

export function BillingWorkspace(props: Props) {
  const {
    lines,
    customers,
    customerId,
    onCustomerChange,
    saleQuery,
    onSaleQueryChange,
    onSaleSubmit,
    saleResults,
    onPickSale,
    saleInputRef,
    searchDisabled,
    discount,
    onDiscountChange,
    discountRecipientName,
    onDiscountRecipientNameChange,
    discountReason,
    onDiscountReasonChange,
    onSetQty,
    onSetLineDiscount,
    onRemove,
    onClear,
    onHold,
    onCheckout,
    onMorePay,
    onKhata,
    heldCarts,
    onResume,
  } = props;

  const [discErrors, setDiscErrors] = useState<Record<string, string>>({});

  const subtotal = cartSubtotal(lines);
  const lineDiscTotal = cartLineDiscountTotal(lines);
  const billDiscount = Math.min(discount, Math.max(0, subtotal - lineDiscTotal));
  const totalDiscount = Math.round((lineDiscTotal + billDiscount) * 100) / 100;
  const total = Math.max(0, subtotal - totalDiscount);
  const needsDiscountApproval = requiresDiscountApproval(subtotal, totalDiscount);
  const discountPct = discountPercent(subtotal, totalDiscount);
  const unitCount = lines.reduce((s, l) => s + l.qty, 0);
  const empty = lines.length === 0;
  const q = saleQuery.trim();
  const showResults = q.length > 0;
  const maxBillDiscount = Math.max(0, subtotal - lineDiscTotal);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b border-border/70 bg-surface px-3 py-2.5 shadow-[0_1px_8px_rgb(15_23_42/0.025)] sm:px-4">
        <div className="grid gap-2 lg:grid-cols-[minmax(15rem,0.38fr)_minmax(20rem,1fr)]">
        <label className="flex h-11 items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3 transition-colors focus-within:border-primary/50 focus-within:bg-surface">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <select
            value={customerId ?? ""}
            onChange={(e) => onCustomerChange(e.target.value === "" ? null : Number(e.target.value))}
            className="w-full bg-transparent text-sm font-bold uppercase tracking-wide text-foreground outline-none"
          >
            <option value="">WALK-IN (Walk-in Customer)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
                {c.balance > 0 ? ` (Khata ${formatMoney(c.balance)})` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="relative">
          <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 h-[1.125rem] w-[1.125rem] -translate-y-1/2 text-primary" />
          <input
            ref={saleInputRef}
            value={saleQuery}
            disabled={searchDisabled}
            onChange={(e) => onSaleQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSaleSubmit(e.currentTarget.value);
              }
            }}
            placeholder="Search product by name / code / barcode…"
            className="h-11 w-full rounded-lg border border-border/80 bg-card pl-11 pr-24 text-sm font-semibold shadow-sm outline-none transition-all placeholder:font-medium placeholder:text-muted-foreground focus:border-primary focus:shadow-md focus:ring-2 focus:ring-ring/20 disabled:opacity-60"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {showResults && (
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-1.5 text-xs font-bold tabular-nums text-primary">
                {saleResults.length}
              </span>
            )}
            <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground sm:inline">F2</kbd>
          </div>
        </div>
        </div>

        {showResults && (
          <div className="animate-fade-in mt-2 max-h-48 overflow-y-auto rounded-xl border border-border/80 bg-card shadow-xl shadow-foreground/5">
            {saleResults.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                &quot;{q}&quot; se koi product nahi mila.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {saleResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onPickSale(p)}
                      className="flex w-full items-center gap-2 px-2 py-2 text-left transition-colors hover:bg-card-hover"
                    >
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface ring-1 ring-border/40">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveAssetUrl(p.imageUrl)}
                            alt=""
                            className="max-h-full max-w-full object-contain"
                          />
                        ) : (
                          <span className="text-lg">{p.emoji ?? "📦"}</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.name}</span>
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

        {heldCarts.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
            {heldCarts.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => onResume(h.id)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 text-xs font-bold text-warning transition-colors hover:bg-warning/20"
              >
                <Pause className="h-3.5 w-3.5" />
                {h.label} · {h.lines.length}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 z-10 border-b border-border/70 bg-muted/95 text-left text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-3 py-2.5">No</th>
              <th className="px-3 py-2.5">Product</th>
              <th className="px-3 py-2.5">Price</th>
              <th className="px-3 py-2.5">MRP</th>
              <th className="px-3 py-2.5">Qty</th>
              <th className="px-3 py-2.5">Dsc</th>
              <th className="px-3 py-2.5 text-right">Subtotal</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-surface">
            {empty ? (
              <tr>
                <td colSpan={8} className="px-4 py-14 text-center text-sm text-muted-foreground">
                  <div className="mx-auto flex max-w-sm flex-col items-center">
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5">
                      <ShoppingCart className="h-7 w-7" />
                    </div>
                    <p className="font-bold text-foreground">New sale is ready</p>
                    <p className="mt-1 text-xs leading-5">Product scan karein, naam search karein, ya Items shelf se product select karein.</p>
                    <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold shadow-sm">
                      <Search className="h-3 w-3" /> F2 se search focus
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              lines.map((l, idx) => {
                const maxDisc = maxLineDiscount(l);
                const freeCap = freeLineDiscountCap(l);
                const lineDisc = lineDiscountAmount(l);
                const net = lineNet(l);
                return (
                <tr key={l.product.id} className="animate-fade-in transition-colors hover:bg-primary/[0.035]">
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-3">
                    <p className="font-bold text-foreground">{l.product.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {l.product.barcode || `P-${l.product.id}`}
                    </p>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{formatMoney(l.product.price)}</td>
                  <td className="px-3 py-3 tabular-nums text-muted-foreground">
                    {formatMoney(l.product.price)}
                  </td>
                  <td className="px-3 py-3">
                    <QtyCell
                      qty={l.qty}
                      fractional={l.product.fractional}
                      unit={l.product.unit}
                      onSetQty={(qty) => onSetQty(l.product.id, qty)}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      min={0}
                      max={maxDisc}
                      step="0.01"
                      value={lineDisc || ""}
                      title={
                        freeCap > 0
                          ? `Free discount ${formatMoney(freeCap)}`
                          : "Is product pe free discount nahi"
                      }
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          setDiscErrors((prev) => {
                            const next = { ...prev };
                            delete next[l.product.id];
                            return next;
                          });
                          onSetLineDiscount(l.product.id, 0);
                          return;
                        }
                        const next = Number(raw);
                        if (!Number.isFinite(next) || next < 0) return;
                        const gate = lineDiscountGate(l, next);
                        if (gate === "over_max") {
                          setDiscErrors((prev) => ({
                            ...prev,
                            [l.product.id]:
                              maxDisc > 0
                                ? `Max ${formatMoney(maxDisc)} — put nahi hoga`
                                : "Discount allow nahi",
                          }));
                          return;
                        }
                        setDiscErrors((prev) => {
                          const copy = { ...prev };
                          delete copy[l.product.id];
                          return copy;
                        });
                        onSetLineDiscount(l.product.id, next);
                      }}
                      placeholder="0"
                      aria-label={`Discount for ${l.product.name}`}
                      className={cn(
                        "h-9 w-16 rounded-md border bg-card px-2 text-right text-sm font-bold tabular-nums outline-none transition-colors focus:ring-2",
                        discErrors[l.product.id]
                          ? "border-danger focus:border-danger focus:ring-danger/20"
                          : "border-border focus:border-primary focus:ring-ring/20",
                      )}
                    />
                    {discErrors[l.product.id] ? (
                      <p className="mt-0.5 text-[10px] font-bold text-danger">
                        {discErrors[l.product.id]}
                      </p>
                    ) : lineDisc > 0 && freeCap > 0 ? (
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        free {formatMoney(freeCap)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-right font-black tabular-nums">
                    {formatMoney(net)}
                  </td>
                  <td className="px-2 py-3">
                    <button
                      type="button"
                      onClick={() => onRemove(l.product.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label={`Remove ${l.product.name}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="shrink-0 border-t border-border/80 bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/70 bg-muted/40 px-3 py-2.5 text-sm sm:px-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">Items</span>
            <strong className="tabular-nums text-foreground">
              {lines.length}({Math.round(unitCount * 1000) / 1000})
            </strong>
          </span>
          <span className="h-4 w-px bg-border/70" aria-hidden />
          <span className="inline-flex items-center gap-1.5">
            <span className="text-muted-foreground">Subtotal</span>
            <strong className="tabular-nums text-foreground">{formatMoney(subtotal)}</strong>
          </span>
          <label className="inline-flex items-center gap-2">
            <span className="text-muted-foreground">Bill disc.</span>
            <input
              type="number"
              min={0}
              max={maxBillDiscount}
              value={billDiscount || ""}
              onChange={(e) => {
                const next = Number(e.target.value) || 0;
                onDiscountChange(Math.min(maxBillDiscount, Math.max(0, next)));
              }}
              className="h-8 w-20 rounded-md border border-border bg-card px-2 text-right text-sm font-bold tabular-nums outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/20"
            />
          </label>
          {lineDiscTotal > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              Line disc: <strong className="tabular-nums text-foreground">{formatMoney(lineDiscTotal)}</strong>
            </span>
          )}
          {totalDiscount > 0 && (
            <span className="inline-flex h-6 items-center rounded-full bg-success/10 px-2 text-xs font-bold text-success">
              {discountPct.toFixed(1)}% off
            </span>
          )}
          {!empty && (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-danger transition-colors hover:text-danger/80"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        {needsDiscountApproval && (
          <div className="space-y-2 border-b border-warning/30 bg-warning/5 px-3 py-2.5 sm:px-4">
            <p className="text-[11px] font-bold text-warning">
              5% se zyada discount — naam aur reason zaroori
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={discountRecipientName}
                onChange={(e) => onDiscountRecipientNameChange(e.target.value)}
                placeholder="Kis ko diya? (naam)"
                className="h-9 rounded-md border border-border bg-input px-2.5 text-sm font-semibold outline-none transition-colors focus:border-warning focus:ring-2 focus:ring-warning/20"
              />
              <input
                type="text"
                value={discountReason}
                onChange={(e) => onDiscountReasonChange(e.target.value)}
                placeholder="Reason (gift, staff…)"
                className="h-9 rounded-md border border-border bg-input px-2.5 text-sm font-semibold outline-none transition-colors focus:border-warning focus:ring-2 focus:ring-warning/20"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between bg-gradient-to-r from-primary/[0.07] via-primary/[0.025] to-transparent px-3 py-2.5 sm:px-4">
          <span>
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.13em] text-muted-foreground">Amount due</span>
            <span className="mt-0.5 block text-sm font-black text-foreground">Total payable</span>
          </span>
          <span className="text-3xl font-black tracking-tight tabular-nums text-primary sm:text-[2.5rem] sm:leading-none">
            {formatMoney(total)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-4 sm:px-4">
          <button
            type="button"
            disabled={empty}
            onClick={onHold}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-3 text-sm font-black text-warning shadow-sm transition-all hover:bg-warning/20 hover:shadow active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            <Pause className="h-5 w-5" />
            Suspend
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={onMorePay}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 text-sm font-black text-accent shadow-sm transition-all hover:bg-accent/20 hover:shadow active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            <Wallet className="h-5 w-5" />
            More pay
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={onKhata}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-border bg-muted px-3 text-sm font-black text-foreground shadow-sm transition-all hover:bg-card-hover hover:shadow active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
          >
            <ShoppingBag className="h-5 w-5" />
            Khata
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={onCheckout}
            className={cn(
              "col-span-2 inline-flex h-14 items-center justify-center rounded-xl bg-primary px-3 text-base font-black text-primary-foreground shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:col-span-1",
            )}
          >
            Payment {formatMoney(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
