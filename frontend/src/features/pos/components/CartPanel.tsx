"use client";

import { useState } from "react";
import {
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  User,
  PauseCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMoney, formatQty } from "@/lib/utils";
import { discountPercent, requiresDiscountApproval } from "../discount";
import type { CartLine, HeldCart, PaymentMethod, PosCustomer, Product } from "../types";
import { PaymentMethods } from "./PaymentMethods";

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

function CartQtyInput({
  qty,
  unit,
  fractional,
  onSetQty,
}: {
  qty: number;
  unit: Product["unit"];
  fractional: boolean;
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
    <div className="flex min-w-0 items-center justify-center gap-1 border-x border-border px-1.5">
      <input
        type="text"
        inputMode={fractional ? "decimal" : "numeric"}
        aria-label={`Quantity in ${unit}`}
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
        className="w-full min-w-[2.75rem] bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none focus:text-primary"
      />
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{unit}</span>
    </div>
  );
}

interface Props {
  lines: CartLine[];
  customers: PosCustomer[];
  customerId: number | null;
  onCustomerChange: (id: number | null) => void;
  discount: number;
  onDiscountChange: (d: number) => void;
  discountRecipientName: string;
  onDiscountRecipientNameChange: (value: string) => void;
  discountReason: string;
  onDiscountReasonChange: (value: string) => void;
  payment: PaymentMethod;
  onPaymentChange: (m: PaymentMethod) => void;
  onQty: (id: string, delta: number) => void;
  onSetQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onHold: () => void;
  onCheckout: () => void;
  heldCarts: HeldCart[];
  onResume: (id: string) => void;
}

export function CartPanel(props: Props) {
  const {
    lines, customers, customerId, onCustomerChange, discount, onDiscountChange,
    discountRecipientName, onDiscountRecipientNameChange, discountReason, onDiscountReasonChange,
    payment, onPaymentChange, onQty, onSetQty, onRemove, onClear, onHold,
    onCheckout, heldCarts, onResume,
  } = props;

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const needsDiscountApproval = requiresDiscountApproval(subtotal, discount);
  const discountPct = discountPercent(subtotal, discount);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const empty = lines.length === 0;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface shadow-[-18px_0_42px_-34px_rgba(15,23,42,0.75)] dark:shadow-[-18px_0_42px_-34px_rgba(0,0,0,0.95)]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/80 bg-card/70 px-4 py-3 backdrop-blur lg:px-5 lg:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <h2 className="text-base font-bold text-foreground">Current Sale</h2>
            <p className="text-xs text-muted-foreground">
              {empty ? "Ready for checkout" : `${lines.length} line items`}
            </p>
          </div>
          {!empty && (
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary ring-1 ring-primary/15">
              {formatQty(itemCount, "items").replace(" items", "")} items
            </span>
          )}
        </div>
        {!empty && (
          <button
            onClick={onClear}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {/* Customer selector */}
      <div className="shrink-0 border-b border-border/70 px-4 py-2.5 lg:px-5 lg:py-3">
        <label className="flex h-10 items-center gap-2 rounded-lg border border-border/80 bg-input px-3 shadow-sm transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/25 lg:h-11">
          <User className="h-4 w-4 text-muted-foreground" />
          <select
            value={customerId ?? ""}
            onChange={(e) => onCustomerChange(e.target.value === "" ? null : Number(e.target.value))}
            className="w-full bg-transparent text-sm font-medium text-foreground focus:outline-none"
          >
            <option value="">Walk-in Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ""}
                {c.balance > 0 ? ` (Khata ${formatMoney(c.balance)})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Held carts */}
      {heldCarts.length > 0 && (
        <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border/70 bg-muted/45 px-5 py-2.5">
          {heldCarts.map((h) => (
            <button
              key={h.id}
              onClick={() => onResume(h.id)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-warning/35 bg-warning/10 px-3 text-xs font-semibold text-warning transition-colors hover:bg-warning/20"
            >
              <PauseCircle className="h-3.5 w-3.5" />
              {h.label} · {h.lines.length}
            </button>
          ))}
        </div>
      )}

      {/* Line items — only this section scrolls */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-background/45 px-3 py-3">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-card text-primary shadow-sm ring-1 ring-border">
              <ShoppingCart className="h-8 w-8 opacity-80" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Cart is empty</p>
              <p className="mt-1 text-xs">Search or tap a product to start a sale.</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {lines.map((l) => (
              <li
                key={l.product.id}
                className="animate-fade-in rounded-lg border border-border/80 bg-card p-3 shadow-sm transition-all hover:border-primary/25 hover:bg-card-hover"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-base">
                        {l.product.emoji}
                      </span>
                      {l.product.name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatMoney(l.product.price)} / {l.product.unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold tabular-nums text-foreground">
                      {formatMoney(l.product.price * l.qty)}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {formatQty(l.qty, l.product.unit)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="grid h-9 grid-cols-[2.25rem_minmax(5.5rem,1fr)_2.25rem] overflow-hidden rounded-md border border-border bg-input">
                    <button
                      onClick={() => onQty(l.product.id, l.product.fractional ? -0.25 : -1)}
                      className="flex items-center justify-center text-foreground transition-colors hover:bg-card-hover"
                      aria-label={`Decrease ${l.product.name}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <CartQtyInput
                      qty={l.qty}
                      unit={l.product.unit}
                      fractional={l.product.fractional}
                      onSetQty={(qty) => onSetQty(l.product.id, qty)}
                    />
                    <button
                      onClick={() => onQty(l.product.id, l.product.fractional ? 0.25 : 1)}
                      className="flex items-center justify-center text-foreground transition-colors hover:bg-card-hover"
                      aria-label={`Increase ${l.product.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => onRemove(l.product.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label={`Remove ${l.product.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Totals + payment + actions — pinned to bottom */}
      <div className="shrink-0 border-t border-border/80 bg-surface px-4 py-3 shadow-[0_-16px_30px_-28px_rgba(15,23,42,0.9)] lg:px-5 lg:py-4">
        <div className="rounded-lg border border-border/80 bg-card px-3 py-2.5 shadow-sm lg:px-4 lg:py-3">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-medium tabular-nums text-foreground">{formatMoney(subtotal)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-sm text-muted-foreground lg:mt-2">
            <span>Discount</span>
            <input
              type="number"
              min={0}
              max={subtotal}
              value={discount || ""}
              onChange={(e) => {
                const next = Number(e.target.value) || 0;
                onDiscountChange(Math.min(subtotal, Math.max(0, next)));
              }}
              placeholder="0"
              className="h-8 w-24 rounded-md border border-border bg-input px-2 text-right text-sm font-medium tabular-nums text-foreground shadow-inner focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25 lg:w-28"
            />
          </div>
          {discount > 0 && (
            <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
              {discountPct.toFixed(1)}% off
            </p>
          )}
          {needsDiscountApproval && (
            <div className="mt-3 space-y-2 rounded-md border border-warning/35 bg-warning/5 p-2.5">
              <p className="text-[11px] font-bold text-warning">
                5% se zyada discount — naam aur reason zaroori
              </p>
              <button
                type="button"
                onClick={() => onDiscountChange(Math.round(subtotal * 100) / 100)}
                className="w-full rounded-md border border-dashed border-warning/40 py-1.5 text-xs font-bold text-warning hover:bg-warning/10"
              >
                Gift bill (100% off)
              </button>
              <input
                type="text"
                value={discountRecipientName}
                onChange={(e) => onDiscountRecipientNameChange(e.target.value)}
                placeholder="Kis ko diya? (naam)"
                className="h-9 w-full rounded-md border border-border bg-input px-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
              <input
                type="text"
                value={discountReason}
                onChange={(e) => onDiscountReasonChange(e.target.value)}
                placeholder="Reason (gift, staff, complaint…)"
                className="h-9 w-full rounded-md border border-border bg-input px-2.5 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            </div>
          )}
          <div className="mt-2 flex items-end justify-between border-t border-border/80 pt-2 lg:mt-3 lg:pt-3">
            <span className="pb-0.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Total</span>
            <span className="text-2xl font-black tabular-nums text-primary lg:text-3xl">
              {formatMoney(total)}
            </span>
          </div>
        </div>

        <div className="mt-2 lg:mt-3">
          <PaymentMethods selected={payment} onSelect={onPaymentChange} />
        </div>

        <div className="mt-2 grid grid-cols-4 gap-2 lg:mt-3">
          <Button
            variant="secondary"
            size="lg"
            disabled={empty}
            onClick={onHold}
            className="col-span-1 h-12 px-2 text-sm lg:h-[3.25rem] lg:px-3"
          >
            <PauseCircle className="h-5 w-5" />
            Hold
          </Button>
          <Button
            size="lg"
            disabled={empty}
            onClick={onCheckout}
            className={cn("col-span-3 h-12 text-sm font-bold shadow-md shadow-primary/20 lg:h-[3.25rem] lg:text-base")}
          >
            Charge {formatMoney(total)}
          </Button>
        </div>
        <p className="mt-2 hidden text-center text-[11px] text-muted-foreground lg:block">
          <kbd className="rounded border border-border bg-muted px-1">F4</kbd> Hold
          <span className="mx-2">·</span>
          <kbd className="rounded border border-border bg-muted px-1">F9</kbd> Charge
        </p>
      </div>
    </aside>
  );
}
