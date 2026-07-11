"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { cn, formatMoney } from "@/lib/utils";
import { paymentMethodLabel } from "@/features/pos/paymentMethods";
import type { PaymentBreakdownRow } from "./PaymentHandoverPanel";

export interface PaymentSettlement {
  method: string;
  expected: number;
  settled: number;
  confirmed: boolean;
  variance: number;
}

interface Props {
  rows: PaymentBreakdownRow[];
  /** Interactive settle mode (manager close). */
  mode?: "settle" | "checklist";
  onChange?: (settlements: PaymentSettlement[], allOk: boolean) => void;
  title?: string;
  hint?: string;
}

type Draft = Record<string, { settled: string; confirmed: boolean }>;

function rowSignature(rows: PaymentBreakdownRow[]): string {
  return rows
    .filter((r) => r.method !== "cash")
    .map((r) => `${r.method}:${Number(r.amount) || 0}`)
    .sort()
    .join("|");
}

function settlementsSignature(settlements: PaymentSettlement[], allOk: boolean): string {
  return `${allOk}::${settlements
    .map((s) => `${s.method}:${s.expected}:${s.settled}:${s.confirmed ? 1 : 0}`)
    .join("|")}`;
}

export function NonCashSettlePanel({
  rows,
  mode = "settle",
  onChange,
  title = "Non-cash settle",
  hint,
}: Props) {
  const signature = useMemo(() => rowSignature(rows), [rows]);
  const items = useMemo(() => {
    return rows
      .filter((r) => r.method !== "cash")
      .map((r) => ({ method: r.method, amount: Number(r.amount) || 0 }));
    // signature captures content; avoid depending on unstable rows[] reference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const active = useMemo(() => items.filter((r) => r.amount > 0), [items]);
  const [draft, setDraft] = useState<Draft>({});
  const seededFor = useRef<string>("");
  const onChangeRef = useRef(onChange);
  const lastEmitted = useRef<string>("");
  onChangeRef.current = onChange;

  // Seed once per breakdown signature — never on every parent re-render.
  useEffect(() => {
    if (seededFor.current === signature) return;
    seededFor.current = signature;
    const next: Draft = {};
    for (const row of items) {
      next[row.method] = {
        settled: String(Math.round(row.amount * 100) / 100),
        confirmed: row.amount <= 0,
      };
    }
    setDraft(next);
  }, [signature, items]);

  const settlements: PaymentSettlement[] = useMemo(() => {
    return items.map((row) => {
      const expected = Math.round(row.amount * 100) / 100;
      const raw = draft[row.method]?.settled ?? String(expected);
      const settled = Math.max(0, Math.round((parseFloat(raw) || 0) * 100) / 100);
      const confirmed = draft[row.method]?.confirmed ?? expected <= 0;
      return {
        method: row.method,
        expected,
        settled,
        confirmed,
        variance: Math.round((settled - expected) * 100) / 100,
      };
    });
  }, [items, draft]);

  const allOk = useMemo(
    () => settlements.every((s) => (s.expected <= 0 ? true : s.confirmed)),
    [settlements],
  );

  const hasVariance = settlements.some((s) => s.expected > 0 && s.variance !== 0);

  // Emit to parent only when values actually change (breaks setState loops).
  useEffect(() => {
    const key = settlementsSignature(settlements, allOk);
    if (lastEmitted.current === key) return;
    lastEmitted.current = key;
    onChangeRef.current?.(settlements, allOk);
  }, [settlements, allOk]);

  function setSettled(method: string, value: string) {
    const cleaned = value.replace(/[^0-9.]/g, "");
    setDraft((prev) => ({
      ...prev,
      [method]: {
        settled: cleaned,
        confirmed: prev[method]?.confirmed ?? false,
      },
    }));
  }

  function toggleConfirm(method: string) {
    setDraft((prev) => ({
      ...prev,
      [method]: {
        settled: prev[method]?.settled ?? "0",
        confirmed: !(prev[method]?.confirmed ?? false),
      },
    }));
  }

  if (active.length === 0) {
    return (
      <div className="rounded-lg border border-border/80 bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Is session mein koi non-cash payment nahi — settle ki zaroorat nahi.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/80 bg-card p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>}

      <div className="mt-3 space-y-2.5">
        {active.map((row) => {
          const s = settlements.find((x) => x.method === row.method)!;
          const draftRow = draft[row.method];
          const off = mode === "settle" && s.variance !== 0;
          return (
            <div
              key={row.method}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                s.confirmed && !off
                  ? "border-success/35 bg-success/5"
                  : off
                    ? "border-warning/40 bg-warning/5"
                    : "border-border/70 bg-background/40",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {paymentMethodLabel(row.method)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Expected {formatMoney(s.expected)}
                    {off ? ` · Diff ${s.variance > 0 ? "+" : ""}${formatMoney(s.variance)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleConfirm(row.method)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition",
                    s.confirmed
                      ? "border-success/40 bg-success/15 text-success"
                      : "border-border bg-card text-muted-foreground hover:bg-card-hover",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  {s.confirmed ? "Settled" : "Confirm"}
                </button>
              </div>

              {mode === "settle" && (
                <label className="mt-2 flex items-center gap-2">
                  <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                    Settled amount
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftRow?.settled ?? ""}
                    onChange={(e) => setSettled(row.method, e.target.value)}
                    className="h-9 w-full rounded-md border border-border bg-input px-2 text-right text-sm font-bold tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {!allOk && (
        <p className="mt-3 text-xs font-bold text-danger">
          {mode === "checklist"
            ? "Har non-cash method tick karo — phir manager ko handover."
            : "Har non-cash method confirm karo — warna till close nahi hoga."}
        </p>
      )}
      {hasVariance && mode === "settle" && (
        <p className="mt-2 text-xs font-bold text-warning">
          Kisi method mein farq hai — notes mein reason likhna lazmi hai.
        </p>
      )}
    </div>
  );
}

export function settlementsNeedNotes(settlements: PaymentSettlement[]): boolean {
  return settlements.some((s) => s.expected > 0 && s.variance !== 0);
}
