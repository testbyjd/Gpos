"use client";

import { useState, type RefObject } from "react";
import {
  Pause,
  ShoppingBag,
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
            ? "h-9 w-[4.5rem] rounded-md border border-border bg-white px-1.5 text-center text-sm font-bold tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:bg-input"
            : "h-9 w-16 rounded-md border border-border bg-white px-2 text-center text-sm font-bold tabular-nums outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:bg-input"
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
    <div className="flex h-full min-h-0 flex-col bg-[#f8fafc] dark:bg-background">
      <div className="shrink-0 space-y-2 border-b border-border/70 bg-white p-3 dark:bg-surface sm:p-3.5">
        <label className="flex h-11 items-center gap-2 rounded-lg border border-border/80 bg-[#f9fafb] px-3 dark:bg-input">
          <User className="h-4 w-4 text-muted-foreground" />
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
            placeholder="Search Product By Name / Code / Barcode..."
            className="h-12 w-full rounded-lg border border-border/80 bg-white pl-4 pr-24 text-sm font-semibold outline-none placeholder:font-medium placeholder:text-muted-foreground focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60 dark:bg-input"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-xs text-muted-foreground">
            {showResults && <span>{saleResults.length} match</span>}
            <span className="font-mono text-[10px]">||||</span>
          </div>
        </div>

        {showResults && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border/80 bg-white shadow-sm dark:bg-card">
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
                      className="flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-card-hover"
                    >
                      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-border/40">
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
                      <span className="shrink-0 text-sm font-black tabular-nums text-emerald-600">
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
          <div className="flex gap-2 overflow-x-auto">
            {heldCarts.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => onResume(h.id)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-700"
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
          <thead className="sticky top-0 z-10 bg-[#eef2f7] text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground dark:bg-muted">
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
          <tbody className="divide-y divide-border/60 bg-white dark:bg-surface">
            {empty ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  Search se add karo — ya right side Items dabao
                </td>
              </tr>
            ) : (
              lines.map((l, idx) => {
                const maxDisc = maxLineDiscount(l);
                const freeCap = freeLineDiscountCap(l);
                const lineDisc = lineDiscountAmount(l);
                const net = lineNet(l);
                return (
                <tr key={l.product.id} className="hover:bg-slate-50 dark:hover:bg-card-hover">
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
                        "h-9 w-16 rounded-md border bg-white px-2 text-right text-sm font-bold tabular-nums outline-none focus:ring-2 dark:bg-input",
                        discErrors[l.product.id]
                          ? "border-danger focus:border-danger focus:ring-danger/20"
                          : "border-border focus:border-emerald-500 focus:ring-emerald-500/20",
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
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-500 hover:bg-red-50"
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

      <div className="shrink-0 border-t border-border/80 bg-white dark:bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-[#f3f4f6] px-3 py-2.5 text-sm dark:bg-muted/40 sm:px-4">
          <span>
            Items:{" "}
            <strong className="tabular-nums">
              {lines.length}({Math.round(unitCount * 1000) / 1000})
            </strong>
          </span>
          <span>
            Total: <strong className="tabular-nums">{formatMoney(subtotal)}</strong>
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
              className="h-8 w-20 rounded-md border border-border bg-white px-2 text-right text-sm font-bold tabular-nums outline-none dark:bg-input"
            />
          </label>
          {lineDiscTotal > 0 && (
            <span className="text-xs text-muted-foreground">
              Line disc: <strong className="tabular-nums">{formatMoney(lineDiscTotal)}</strong>
            </span>
          )}
          <span className="text-muted-foreground">
            Market total: <strong className="text-foreground tabular-nums">{formatMoney(subtotal)}</strong>
          </span>
          {totalDiscount > 0 && (
            <span className="text-xs text-muted-foreground">{discountPct.toFixed(1)}% off</span>
          )}
          {!empty && (
            <button
              type="button"
              onClick={onClear}
              className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-red-500 hover:underline"
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
                className="h-9 rounded-md border border-border bg-input px-2.5 text-sm font-semibold outline-none"
              />
              <input
                type="text"
                value={discountReason}
                onChange={(e) => onDiscountReasonChange(e.target.value)}
                placeholder="Reason (gift, staff…)"
                className="h-9 rounded-md border border-border bg-input px-2.5 text-sm font-semibold outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between px-3 py-3 sm:px-4">
          <span className="text-sm font-black uppercase tracking-wide text-foreground">
            Total Payable
          </span>
          <span className="text-3xl font-black tabular-nums text-emerald-600 sm:text-4xl">
            {formatMoney(total)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 px-3 pb-3 sm:grid-cols-4 sm:px-4">
          <button
            type="button"
            disabled={empty}
            onClick={onHold}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-orange-400 px-3 text-sm font-black text-white shadow-sm transition hover:bg-orange-500 disabled:opacity-40"
          >
            <Pause className="h-5 w-5" />
            Suspend
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={onMorePay}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-violet-500 px-3 text-sm font-black text-white shadow-sm transition hover:bg-violet-600 disabled:opacity-40"
          >
            <Wallet className="h-5 w-5" />
            More pay
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={onKhata}
            className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-amber-700 px-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-40"
          >
            <ShoppingBag className="h-5 w-5" />
            Khata
          </button>
          <button
            type="button"
            disabled={empty}
            onClick={onCheckout}
            className={cn(
              "col-span-2 inline-flex h-14 items-center justify-center rounded-xl bg-emerald-600 px-3 text-base font-black text-white shadow-md transition hover:bg-emerald-700 disabled:opacity-40 sm:col-span-1",
            )}
          >
            Payment {formatMoney(total)}
          </button>
        </div>
      </div>
    </div>
  );
}
