"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Banknote, CheckCircle2, Lock, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMoney } from "@/lib/utils";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import { DENOMINATIONS } from "./data";
import { closeTill, getTillSummary, type ClosedTill, type TillSummary } from "./api";

interface Props {
  onClose: () => void;
}

const inputCls =
  "h-9 w-full rounded-md border border-border bg-input px-2 text-right text-sm font-bold tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";

/**
 * Manager/owner till close (Galla). Driven entirely by the live session from
 * GET /api/v1/till/current and finalised via POST /api/v1/till/close.
 */
export function CloseTillModal({ onClose }: Props) {
  useModalDismiss(onClose);

  const [summary, setSummary] = useState<TillSummary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  const [retain, setRetain] = useState("");
  const [result, setResult] = useState<ClosedTill | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getTillSummary()
      .then((res) => alive && setSummary(res))
      .catch(() => alive && setLoadError(true));
    return () => {
      alive = false;
    };
  }, []);

  const expected = summary?.expected_cash ?? 0;
  const countedCash = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + d * (parseInt(counts[d] ?? "") || 0), 0),
    [counts],
  );
  const variance = countedCash - expected;
  const counting = countedCash > 0;

  const retainNum = parseInt(retain || "") || 0;
  const retainTooHigh = retainNum > countedCash;
  const handover = Math.max(0, countedCash - retainNum);

  const varianceTone =
    variance === 0 ? "text-success" : variance > 0 ? "text-warning" : "text-danger";
  const varianceLabel =
    variance === 0 ? "Balanced" : variance > 0 ? "Over (extra)" : "Short";

  function setQty(denom: number, value: string) {
    setCounts((prev) => ({ ...prev, [denom]: value.replace(/[^0-9]/g, "") }));
  }

  async function submit() {
    if (!counting || retainTooHigh || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const denominations: Record<string, number> = {};
    for (const d of DENOMINATIONS) {
      const qty = parseInt(counts[d] ?? "") || 0;
      if (qty > 0) denominations[d] = qty;
    }
    try {
      const closed = await closeTill({
        counted_cash: countedCash,
        retained_float: retainNum,
        denominations,
        notes: notes.trim() || undefined,
      });
      setResult(closed);
    } catch {
      setSubmitError("Till close fail hua. Server check karo.");
    } finally {
      setSubmitting(false);
    }
  }

  const expectedRows: [string, number][] = [
    ["Opening float", summary?.opening_float ?? 0],
    ["Cash sales", summary?.cash_sales ?? 0],
  ];

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-till-title"
      onClick={onClose}
    >
      <section
        className="animate-fade-in flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 id="close-till-title" className="text-base font-black text-foreground">
                Close Till — Galla
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

        {result ? (
          /* ---------- Success state (server-authoritative figures) ---------- */
          <div className="overflow-y-auto px-6 py-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-xl font-black text-foreground">Session closed</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Day-end recorded for {summary?.register_name ?? "the register"}.
            </p>

            <div className="mx-auto mt-5 max-w-sm space-y-2 rounded-lg border border-border/80 bg-card p-4 text-left text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected cash</span>
                <span className="font-bold tabular-nums text-foreground">{formatMoney(Number(result.expected_cash))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Counted cash</span>
                <span className="font-bold tabular-nums text-foreground">{formatMoney(Number(result.counted_cash))}</span>
              </div>
              <div className="flex justify-between border-t border-border/70 pt-2">
                <span className="font-semibold text-foreground">Variance</span>
                <span
                  className={cn(
                    "font-black tabular-nums",
                    Number(result.variance) === 0
                      ? "text-success"
                      : Number(result.variance) > 0
                        ? "text-warning"
                        : "text-danger",
                  )}
                >
                  {Number(result.variance) > 0 ? "+" : ""}
                  {formatMoney(Number(result.variance))}
                </span>
              </div>
              <div className="flex justify-between border-t border-border/70 pt-2">
                <span className="text-muted-foreground">Handed over / banked</span>
                <span className="font-bold tabular-nums text-foreground">{formatMoney(Number(result.handed_over))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Float for tomorrow</span>
                <span className="font-bold tabular-nums text-primary">{formatMoney(Number(result.retained_float))}</span>
              </div>
            </div>

            <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2">
              <Button variant="secondary" size="lg" onClick={() => window.print()}>
                <Printer className="h-5 w-5" />
                Print summary
              </Button>
              <Button size="lg" onClick={onClose} autoFocus>
                Done
              </Button>
            </div>
          </div>
        ) : (
          /* ---------- Cash-up form ---------- */
          <>
            <div className="flex-1 overflow-y-auto">
              {loadError && (
                <p className="m-5 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
                  Till summary load nahi hua. Server check karo.
                </p>
              )}

              <div className="grid gap-4 p-5 md:grid-cols-2">
                {/* Expected side */}
                <div className="space-y-4">
                  <div className="rounded-lg border border-border/80 bg-card p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Expected cash in drawer
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      {expectedRows.map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-bold tabular-nums text-foreground">{formatMoney(value)}</span>
                        </div>
                      ))}
                      <div className="flex items-baseline justify-between border-t border-border/70 pt-2">
                        <span className="font-bold text-foreground">Expected</span>
                        <span className="text-xl font-black tabular-nums text-primary">
                          {formatMoney(expected)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-card p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Other settlements (for record)
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      {[
                        ["Card", summary?.card_total ?? 0],
                        ["Wallet / QR", summary?.wallet_total ?? 0],
                        ["Khata extended", summary?.khata_total ?? 0],
                      ].map(([label, value]) => (
                        <div key={label as string} className="flex justify-between">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-bold tabular-nums text-foreground">
                            {formatMoney(value as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Counted side */}
                <div className="space-y-4">
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
                      <span className="text-xl font-black tabular-nums text-foreground">
                        {formatMoney(countedCash)}
                      </span>
                    </div>
                  </div>

                  {/* Variance */}
                  <div
                    className={cn(
                      "rounded-lg border p-4",
                      variance === 0
                        ? "border-success/30 bg-success/5"
                        : variance > 0
                          ? "border-warning/30 bg-warning/5"
                          : "border-danger/30 bg-danger/5",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Variance</span>
                      <span className={cn("text-2xl font-black tabular-nums", varianceTone)}>
                        {counting ? `${variance > 0 ? "+" : ""}${formatMoney(variance)}` : "—"}
                      </span>
                    </div>
                    <p className={cn("mt-1 text-xs font-bold", counting ? varianceTone : "text-muted-foreground")}>
                      {counting ? varianceLabel : "Enter counted notes to see variance"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cash handover / float carry-forward */}
              <div className="px-5 pb-1">
                <div className="rounded-lg border border-border/80 bg-card p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Cash handover
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                        Retain as tomorrow&apos;s float
                      </span>
                      <input
                        value={retain}
                        onChange={(e) => setRetain(e.target.value.replace(/[^0-9]/g, ""))}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label="Retain as tomorrow's float"
                        className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-bold tabular-nums text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                      />
                    </label>
                    <div className="rounded-md bg-muted px-3 py-2">
                      <p className="text-xs font-semibold text-muted-foreground">Hand over / bank now</p>
                      <p className="mt-1 text-xl font-black tabular-nums text-foreground">
                        {formatMoney(handover)}
                      </p>
                    </div>
                  </div>
                  {retainTooHigh ? (
                    <p className="mt-2 text-xs font-bold text-danger">
                      Retained float cannot exceed counted cash.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Counted {formatMoney(countedCash)} = Handover {formatMoney(handover)} + Float{" "}
                      {formatMoney(retainNum)} (carried to next day)
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Notes + actions */}
            <div className="shrink-0 border-t border-border/80 px-5 py-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Notes (optional)
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Reason for variance, cash drops, etc."
                  className="w-full resize-none rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </label>
              {submitError && (
                <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
                  {submitError}
                </p>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button variant="secondary" size="lg" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  size="lg"
                  className="col-span-2"
                  disabled={!counting || retainTooHigh || submitting || !summary}
                  onClick={submit}
                >
                  <Lock className="h-5 w-5" />
                  {submitting ? "Closing…" : "Close session"}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
