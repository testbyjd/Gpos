"use client";

import { useState } from "react";
import {
  Banknote,
  Building2,
  CreditCard,
  Smartphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMoney } from "@/lib/utils";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import {
  MORE_PAY_METHODS,
  PAYMENT_METHOD_LABEL,
  requiresPaymentReference,
} from "../paymentMethods";
import type { PaymentMethod } from "../types";

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  easypaisa: Smartphone,
  jazzcash: Smartphone,
  bank_transfer: Building2,
  khata: Banknote,
  split: Banknote,
};

interface Props {
  total: number;
  onPick: (method: PaymentMethod, referenceId?: string) => void;
  onClose: () => void;
}

export function MorePayModal({ total, onPick, onClose }: Props) {
  useModalDismiss(onClose);
  const [selected, setSelected] = useState<PaymentMethod>("easypaisa");
  const [referenceId, setReferenceId] = useState("");
  const [error, setError] = useState("");

  const needsRef = requiresPaymentReference(selected);

  function confirm() {
    if (needsRef && !referenceId.trim()) {
      setError("Reference ID lazmi hai (txn / TID / slip no).");
      return;
    }
    setError("");
    onPick(selected, needsRef ? referenceId.trim() : undefined);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="more-pay-title"
    >
      <section
        className="animate-fade-in w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5">
          <div>
            <h2 id="more-pay-title" className="text-base font-black text-foreground">
              More payment options
            </h2>
            <p className="text-xs text-muted-foreground">
              Cash ke ilawa reference ID lazmi — reports mein save hogi
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-card-hover hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-baseline justify-between rounded-lg border border-border/80 bg-card px-4 py-3">
            <span className="text-sm font-semibold text-muted-foreground">Total due</span>
            <span className="text-2xl font-black tabular-nums text-emerald-600">
              {formatMoney(total)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MORE_PAY_METHODS.map((id) => {
              const Icon = METHOD_ICON[id];
              const active = selected === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSelected(id);
                    setError("");
                  }}
                  className={cn(
                    "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border px-2 text-center transition",
                    active
                      ? "border-violet-500 bg-violet-50 text-violet-700 ring-2 ring-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300"
                      : "border-border/80 bg-card text-foreground hover:bg-card-hover",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-bold leading-tight">
                    {PAYMENT_METHOD_LABEL[id]}
                  </span>
                </button>
              );
            })}
          </div>

          {needsRef && (
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Reference ID <span className="text-danger">*</span>
              </span>
              <input
                type="text"
                value={referenceId}
                onChange={(e) => {
                  setReferenceId(e.target.value);
                  setError("");
                }}
                placeholder="Txn ID / TID / slip no…"
                className="h-11 w-full rounded-lg border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
                autoFocus
              />
            </label>
          )}

          {error && <p className="text-xs font-bold text-danger">{error}</p>}

          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button size="lg" className="col-span-2 bg-violet-600 hover:bg-violet-700" onClick={confirm}>
              {selected === "cash"
                ? "Cash keypad →"
                : `Confirm ${PAYMENT_METHOD_LABEL[selected]}`}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
