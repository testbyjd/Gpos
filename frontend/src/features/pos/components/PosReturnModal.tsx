"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/utils";
import { formatPkDateTime, pkYmd } from "@/lib/datetime";
import { getErrorMessage } from "@/lib/api";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import { listSales, type SaleRow } from "@/lib/admin-api";
import { SaleDetailModal } from "@/features/admin/components/DetailDrawers";
import { paymentMethodLabel } from "../paymentMethods";

interface Props {
  onClose: () => void;
  onReturned?: () => void;
}

export function PosReturnModal({ onClose, onReturned }: Props) {
  useModalDismiss(onClose, { escape: false });

  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saleId, setSaleId] = useState<number | null>(null);

  async function load(q: string) {
    setLoading(true);
    setError(null);
    try {
      const today = pkYmd(new Date());
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const res = await listSales({
        from: pkYmd(weekAgo),
        to: today,
        q: q.trim() || undefined,
        perPage: 30,
      });
      setRows(res.data ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Bills load nahi hui."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("");
  }, []);

  if (saleId != null) {
    return (
      <SaleDetailModal
        saleId={saleId}
        initialView="return"
        onClose={() => {
          setSaleId(null);
          onClose();
        }}
        onReturned={() => {
          setSaleId(null);
          onReturned?.();
          onClose();
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pos-return-title"
    >
      <section
        className="animate-fade-in flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border/80 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600">
              <RotateCcw className="h-4 w-4" />
            </span>
            <div>
              <h2 id="pos-return-title" className="text-base font-black text-foreground">
                Customer return
              </h2>
              <p className="text-xs text-muted-foreground">Invoice / customer se bill dhoondo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-card-hover"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-border/70 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void load(query);
                }
              }}
              placeholder="INV-… / customer naam / phone"
              className="h-11 w-full rounded-lg border border-border bg-input pl-10 pr-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={() => void load(query)}
              disabled={loading}
            >
              {loading ? "Searching…" : "Search"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setQuery("");
                void load("");
              }}
              disabled={loading}
            >
              Today / week
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {error && (
            <p className="mb-2 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
              {error}
            </p>
          )}
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading bills…</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Koi bill nahi mila — invoice number try karo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {rows.map((sale) => (
                <li key={sale.id}>
                  <button
                    type="button"
                    onClick={() => setSaleId(sale.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 text-left transition hover:bg-card-hover"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-foreground">{sale.invoice_no}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {sale.customer?.name ?? "Walk-in"} ·{" "}
                        {formatPkDateTime(sale.sold_at, {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {(sale.payments ?? [])
                          .map((p) => paymentMethodLabel(p.method))
                          .join(" + ") || "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-black tabular-nums text-emerald-600">
                      {formatMoney(Number(sale.total))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
