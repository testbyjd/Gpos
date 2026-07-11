"use client";

import { useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  CreditCard,
  Delete,
  NotebookPen,
  Smartphone,
  SplitSquareHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMoney } from "@/lib/utils";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import { PAYMENT_METHOD_LABEL, requiresPaymentReference } from "../paymentMethods";
import type { PaymentMethod } from "../types";

const METHOD_ICON: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  card: CreditCard,
  easypaisa: Smartphone,
  jazzcash: Smartphone,
  bank_transfer: Building2,
  khata: NotebookPen,
  split: SplitSquareHorizontal,
};

const QUICK_NOTES = [100, 500, 1000, 5000];
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "."];

interface Props {
  total: number;
  payment: PaymentMethod;
  customer: string;
  onConfirm: (tendered: number, change: number, referenceId?: string) => Promise<void> | void;
  onClose: () => void;
}

export function PaymentModal({ total, payment, customer, onConfirm, onClose }: Props) {
  useModalDismiss(onClose, { escape: false });

  const isCash = payment === "cash";
  const needsRef = requiresPaymentReference(payment);
  const [tendered, setTendered] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const tenderedNum = parseFloat(tendered) || 0;
  const change = tenderedNum - total;
  const enough = !isCash || tenderedNum >= total;
  const label = PAYMENT_METHOD_LABEL[payment];
  const Icon = METHOD_ICON[payment];

  function push(key: string) {
    setTendered((prev) => {
      if (key === "." && prev.includes(".")) return prev;
      if (prev === "0" && key !== ".") return key;
      return prev + key;
    });
  }

  async function confirm() {
    if (!enough || submitting) return;
    if (needsRef && !referenceId.trim()) {
      setError("Reference ID lazmi hai.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onConfirm(
        tenderedNum,
        isCash ? Math.max(0, change) : 0,
        needsRef ? referenceId.trim() : undefined,
      );
    } catch {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (needsRef && document.activeElement?.tagName === "INPUT") {
        if (e.key === "Enter") {
          e.preventDefault();
          void confirm();
        }
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        push(e.key);
      } else if (e.key === ".") {
        e.preventDefault();
        push(".");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setTendered((p) => p.slice(0, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        void confirm();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tendered, enough, tenderedNum, submitting, referenceId, needsRef]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-modal-title"
    >
      <section
        className="animate-fade-in w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <h2 id="payment-modal-title" className="text-base font-black text-foreground">
              {label} Payment
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="rounded-lg border border-border/80 bg-card p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Total due</span>
              <span className="text-2xl font-black tabular-nums text-foreground">
                {formatMoney(total)}
              </span>
            </div>

            {isCash ? (
              <>
                <div className="mt-3 flex items-baseline justify-between border-t border-border/70 pt-3">
                  <span className="text-sm font-semibold text-muted-foreground">Received</span>
                  <span className="text-xl font-black tabular-nums text-foreground">
                    {tendered ? formatMoney(tenderedNum) : "—"}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-border/70 pt-3">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {change >= 0 ? "Change" : "Remaining"}
                  </span>
                  <span
                    className={cn(
                      "text-2xl font-black tabular-nums",
                      change >= 0 ? "text-success" : "text-danger",
                    )}
                  >
                    {formatMoney(Math.abs(change))}
                  </span>
                </div>
              </>
            ) : payment === "khata" ? (
              <p className="mt-3 border-t border-border/70 pt-3 text-sm text-muted-foreground">
                Yeh amount{" "}
                <span className="font-bold text-foreground">{customer}</span>
                {" "}ke Khata pe add hoga.
              </p>
            ) : (
              <p className="mt-3 border-t border-border/70 pt-3 text-sm text-muted-foreground">
                Confirm once the {label.toLowerCase()} transaction is approved.
              </p>
            )}
          </div>

          {needsRef && (
            <label className="mt-4 block space-y-1.5">
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
                placeholder={
                  payment === "khata"
                    ? "Note / slip / agreement no…"
                    : "Txn ID / TID / slip no…"
                }
                className="h-11 w-full rounded-lg border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                autoFocus
              />
            </label>
          )}

          {error && <p className="mt-2 text-xs font-bold text-danger">{error}</p>}

          {isCash && (
            <>
              <div className="mt-4 grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setTendered(total.toString())}
                  className="rounded-md border border-primary/40 bg-primary/10 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
                >
                  Exact
                </button>
                {QUICK_NOTES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTendered((p) => ((parseFloat(p) || 0) + n).toString())}
                    className="rounded-md border border-border bg-card py-2 text-sm font-bold text-foreground transition-colors hover:bg-card-hover"
                  >
                    +{n >= 1000 ? `${n / 1000}k` : n}
                  </button>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                {KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => push(k)}
                    className="h-12 rounded-md border border-border bg-card text-lg font-bold text-foreground transition-colors hover:bg-card-hover active:scale-[0.97]"
                  >
                    {k}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setTendered((p) => p.slice(0, -1))}
                  aria-label="Backspace"
                  className="col-span-3 flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-bold text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Delete className="h-4 w-4" />
                  Backspace
                </button>
              </div>
            </>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button variant="secondary" size="lg" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              size="lg"
              className="col-span-2"
              disabled={!enough || submitting}
              onClick={() => void confirm()}
            >
              {submitting
                ? "Saving…"
                : isCash && !enough
                  ? `Need ${formatMoney(total - tenderedNum)} more`
                  : "Complete sale"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
