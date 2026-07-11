"use client";

import { useEffect } from "react";
import { CheckCircle2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import type { PaymentMethod } from "../types";
import { PAYMENT_METHOD_LABEL } from "../paymentMethods";

const METHOD_LABEL = PAYMENT_METHOD_LABEL;

export interface SaleResult {
  invoice: string;
  total: number;
  tendered: number;
  change: number;
  method: PaymentMethod;
  customer: string;
  referenceId?: string;
}

interface Props {
  sale: SaleResult;
  onClose: () => void;
}

export function SaleSuccessModal({ sale, onClose }: Props) {
  useModalDismiss(onClose);

  const isCash = sale.method === "cash";
  const isKhata = sale.method === "khata";
  const showChange = isCash && sale.change > 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sale-success-title"
    >
      <section
        className="animate-fade-in w-full max-w-sm overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center px-6 pt-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="h-8 w-8" />
          </span>
          <h2 id="sale-success-title" className="mt-3 text-lg font-black text-foreground">
            Sale Completed
          </h2>
          <p className="text-xs text-muted-foreground">{sale.invoice}</p>
        </div>

        {/* Prominent change so the cashier can read it while handing cash back */}
        {showChange ? (
          <div className="mx-6 mt-4 rounded-lg border border-success/30 bg-success/10 px-4 py-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-success">
              Return to customer
            </p>
            <p className="mt-1 text-4xl font-black tabular-nums text-success">
              {formatMoney(sale.change)}
            </p>
          </div>
        ) : isKhata ? (
          <div className="mx-6 mt-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-center">
            <p className="text-xs font-bold uppercase tracking-wide text-warning">
              Added to Khata
            </p>
            <p className="mt-1 text-sm font-bold text-foreground">{sale.customer}</p>
          </div>
        ) : (
          <div className="mx-6 mt-4 rounded-lg border border-border/80 bg-card px-4 py-3 text-center">
            <p className="text-sm font-bold text-foreground">No change due</p>
          </div>
        )}

        <div className="mx-6 mt-4 space-y-2 rounded-lg border border-border/80 bg-card p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold tabular-nums text-foreground">{formatMoney(sale.total)}</span>
          </div>
          {isCash && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cash received</span>
              <span className="font-bold tabular-nums text-foreground">{formatMoney(sale.tendered)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment</span>
            <span className="font-bold text-foreground">{METHOD_LABEL[sale.method]}</span>
          </div>
          {sale.referenceId && (
            <div className="flex justify-between gap-3">
              <span className="shrink-0 text-muted-foreground">Reference</span>
              <span className="truncate font-bold text-foreground">{sale.referenceId}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-bold text-foreground">{sale.customer}</span>
          </div>
        </div>

        <div className="p-6 pt-4">
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="secondary" className="w-full" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button size="lg" className="w-full" onClick={onClose} autoFocus>
              New Sale
            </Button>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Press <kbd className="rounded border border-border bg-muted px-1">Enter</kbd> for next sale
          </p>
        </div>
      </section>
    </div>
  );
}
