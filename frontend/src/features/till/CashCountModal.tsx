"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, Info, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import { DENOMINATIONS } from "./data";
import { getTillSummary, type TillSummary } from "./api";
import { PaymentHandoverPanel } from "./PaymentHandoverPanel";
import { NonCashSettlePanel } from "./NonCashSettlePanel";

interface Props {
  onClose: () => void;
}

const inputCls =
  "h-9 w-full rounded-md border border-border bg-input px-2 text-right text-sm font-bold tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";

/**
 * Cashier-facing blind cash count (Galla).
 *
 * The cashier counts the physical drawer so cash is ready for hand-over, but
 * never sees the expected figure or variance — those are revealed only when a
 * manager/owner closes the till. Read-only on totals; no close action here.
 */
export function CashCountModal({ onClose }: Props) {
  useModalDismiss(onClose);

  const [summary, setSummary] = useState<TillSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [nonCashOk, setNonCashOk] = useState(false);

  useEffect(() => {
    let alive = true;
    getTillSummary()
      .then((res) => alive && setSummary(res))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const countedCash = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d * (parseInt(counts[d] ?? "") || 0), 0),
    [counts],
  );

  function setQty(denom: number, value: string) {
    setCounts((prev) => ({ ...prev, [denom]: value.replace(/[^0-9]/g, "") }));
  }

  const breakdown = useMemo(() => {
    if (summary?.payment_breakdown?.length) return summary.payment_breakdown;
    return [
      { method: "card", amount: summary?.card_total ?? 0 },
      { method: "easypaisa", amount: 0 },
      { method: "jazzcash", amount: 0 },
      { method: "bank_transfer", amount: 0 },
      { method: "khata", amount: summary?.khata_total ?? 0 },
    ];
  }, [summary]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cash-count-title"
      onClick={onClose}
    >
      <section
        className="animate-fade-in flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Banknote className="h-5 w-5" />
            </span>
            <div>
              <h2 id="cash-count-title" className="text-base font-black text-foreground">
                Count Cash — Galla
              </h2>
              <p className="text-xs text-muted-foreground">
                {summary
                  ? `${summary.register_name} · ${summary.sales_count} sales today`
                  : "Loading session…"}
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

        <div className="flex-1 overflow-y-auto">
          {loadError && (
            <p className="m-5 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
              Till summary load nahi hua. Server check karo.
            </p>
          )}

          <div className="grid gap-4 p-5 md:grid-cols-2">
            {/* Count side */}
            <div className="rounded-lg border border-border/80 bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Banknote className="h-3.5 w-3.5" />
                Count physical cash
              </p>
              <div className="mt-3 grid grid-cols-[1fr_64px_1fr] items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                <span>Note</span>
                <span className="text-center">Qty</span>
                <span className="text-right">Amount</span>
              </div>
              <div className="mt-1.5 space-y-1.5">
                {DENOMINATIONS.map((d) => {
                  const qty = parseInt(counts[d] ?? "") || 0;
                  return (
                    <div key={d} className="grid grid-cols-[1fr_64px_1fr] items-center gap-2">
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {formatMoney(d)}
                      </span>
                      <input
                        value={counts[d] ?? ""}
                        onChange={(e) => setQty(d, e.target.value)}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`Quantity of ${formatMoney(d)} notes`}
                        className={inputCls}
                      />
                      <span className="text-right text-sm font-bold tabular-nums text-muted-foreground">
                        {formatMoney(d * qty)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-border/70 pt-3">
                <span className="font-bold text-foreground">Counted cash</span>
                <span className="text-2xl font-black tabular-nums text-primary">
                  {formatMoney(countedCash)}
                </span>
              </div>
            </div>

            {/* Info side */}
            <div className="space-y-4">
              <PaymentHandoverPanel
                rows={breakdown}
                hideCash
                title="Payment methods — expected"
                hint="Session totals. Neeche checklist tick karo jab slips ready hon."
              />

              <NonCashSettlePanel
                rows={breakdown}
                mode="checklist"
                title="Non-cash handover checklist"
                hint="Har method tick = slip / transfer ready. Miss ho to manager ko batao."
                onChange={(_s, ok) => setNonCashOk(ok)}
              />

              <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
                <p className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                  <Info className="h-4 w-4 text-accent" />
                  Hand over to manager
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Counted cash + upar wali confirmed payment list manager/owner ko do. Expected
                  cash aur variance sirf till close pe dikhte hain.
                </p>
                <div className="mt-3 flex items-baseline justify-between rounded-md bg-white/60 px-3 py-2 dark:bg-black/20">
                  <span className="text-xs font-bold text-muted-foreground">Cash to hand over</span>
                  <span className="text-lg font-black tabular-nums text-foreground">
                    {formatMoney(countedCash)}
                  </span>
                </div>
                {!nonCashOk && (
                  <p className="mt-2 text-xs font-bold text-danger">
                    Pehle non-cash methods tick karo — phir Done.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 border-t border-border/80 px-5 py-4">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="lg" onClick={() => window.print()}>
              <Printer className="h-5 w-5" />
              Print
            </Button>
            <Button size="lg" className="col-span-2" onClick={onClose} disabled={!nonCashOk}>
              Done
            </Button>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
