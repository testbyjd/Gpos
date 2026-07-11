"use client";

import { formatMoney } from "@/lib/utils";
import { paymentMethodLabel } from "@/features/pos/paymentMethods";

export interface PaymentBreakdownRow {
  method: string;
  amount: number;
}

interface Props {
  rows: PaymentBreakdownRow[];
  /** When true, cash row is omitted (cashier blind count / physical cash counted separately). */
  hideCash?: boolean;
  title?: string;
  hint?: string;
}

export function PaymentHandoverPanel({
  rows,
  hideCash = false,
  title = "Payment methods — handover",
  hint,
}: Props) {
  const visible = hideCash ? rows.filter((r) => r.method !== "cash") : rows;
  const total = visible.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="rounded-lg border border-border/80 bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}
      <div className="mt-3 space-y-2 text-sm">
        {visible.length === 0 ? (
          <p className="text-muted-foreground">Is session mein koi payment nahi.</p>
        ) : (
          visible.map((row) => (
            <div key={row.method} className="flex justify-between gap-3">
              <span className="text-muted-foreground">{paymentMethodLabel(row.method)}</span>
              <span className="font-bold tabular-nums text-foreground">
                {formatMoney(Number(row.amount || 0))}
              </span>
            </div>
          ))
        )}
        <div className="flex justify-between border-t border-border/70 pt-2">
          <span className="font-bold text-foreground">
            {hideCash ? "Non-cash total" : "All methods total"}
          </span>
          <span className="font-black tabular-nums text-primary">{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  );
}
