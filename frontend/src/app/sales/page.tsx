"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer, Receipt, RefreshCw, RotateCcw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { FilterChips } from "@/components/ui/filter-chips";
import { SearchInput } from "@/components/ui/search-input";
import { cn, formatMoney } from "@/lib/utils";
import { formatPkDateTime, pkYmd } from "@/lib/datetime";
import { getErrorMessage } from "@/lib/api";
import { getSalesDiscountSummary, listSales, type SaleDiscountSummary, type SaleRow } from "@/lib/admin-api";
import { SaleDetailModal } from "@/features/admin/components/DetailDrawers";
import {
  AdminShell,
  DataTable,
  PageLoadError,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";

const RANGES = ["Today", "Yesterday", "This week", "This month", "All"] as const;
type Range = (typeof RANGES)[number];

function presetDates(range: Range): { from?: string; to?: string } {
  const today = new Date();
  if (range === "All") return {};
  if (range === "Yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: pkYmd(y), to: pkYmd(y) };
  }
  if (range === "This week") {
    const s = new Date(today);
    const offset = (s.getDay() + 6) % 7;
    s.setDate(s.getDate() - offset);
    return { from: pkYmd(s), to: pkYmd(today) };
  }
  if (range === "This month") {
    const parts = pkYmd(today).split("-");
    return { from: `${parts[0]}-${parts[1]}-01`, to: pkYmd(today) };
  }
  return { from: pkYmd(today), to: pkYmd(today) };
}

function fmtSoldAt(iso: string) {
  return formatPkDateTime(iso, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentLabel(sale: SaleRow) {
  return (sale.payments ?? []).map((p) => p.method).join(" + ") || "—";
}

function hasKhata(sale: SaleRow) {
  return (sale.payments ?? []).some((p) => p.method === "khata");
}

function hasDiscount(sale: SaleRow) {
  return Number(sale.discount) > 0;
}

export default function SalesPage() {
  const [range, setRange] = useState<Range>("Today");
  const [discountOnly, setDiscountOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [discountSummary, setDiscountSummary] = useState<SaleDiscountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saleModal, setSaleModal] = useState<{ id: number; view?: "return" | "print" } | null>(null);
  const { toast, showToast, hideToast } = useAppToast();

  const dates = presetDates(range);

  function loadSales() {
    setLoading(true);
    return Promise.all([
      listSales({ ...dates, perPage: 200 }),
      getSalesDiscountSummary().catch(() => null),
    ])
      .then(([res, summary]) => {
        setRows(res.data);
        setTotalCount(res.meta.total);
        setDiscountSummary(summary);
        setLoadError(null);
      })
      .catch((err) => {
        setRows([]);
        setTotalCount(0);
        setLoadError(getErrorMessage(err, "Sales load nahi hui."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (discountOnly && !hasDiscount(r)) return false;
      if (!q) return true;
      return [r.invoice_no, r.customer?.name ?? "", r.customer?.phone ?? "", r.discount_recipient_name ?? "", r.discount_reason ?? ""]
        .some((x) => x.toLowerCase().includes(q));
    });
  }, [rows, search, discountOnly]);

  const salesTotal = filtered.reduce((sum, r) => sum + Number(r.total), 0);
  const filteredDiscountTotal = filtered.reduce((sum, r) => sum + Number(r.discount), 0);

  return (
    <AdminShell
      title="Sales"
      eyebrow="Saari bills · receipt dubara print"
      actions={
        <Button size="sm" variant="secondary" onClick={() => loadSales()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      {loadError ? (
        <PageLoadError message={loadError} onRetry={loadSales} />
      ) : (
        <>
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px]">
            <PagePanel className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bills</p>
                <p className="text-xl font-black tabular-nums text-foreground">{totalCount}</p>
              </div>
            </PagePanel>
            <PagePanel className="flex items-center gap-3 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sales total ({range}{discountOnly ? " · discount" : ""})
                </p>
                <p className="text-xl font-black tabular-nums text-foreground">{formatMoney(salesTotal)}</p>
                {discountOnly && filteredDiscountTotal > 0 && (
                  <p className="mt-1 text-xs font-bold text-warning">
                    Discount in list: {formatMoney(filteredDiscountTotal)}
                  </p>
                )}
              </div>
            </PagePanel>
            <PagePanel className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning ring-1 ring-warning/20">
                  <Tag className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discounts</p>
                  <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Aaj</p>
                      <p className="font-black tabular-nums text-foreground">
                        {formatMoney(discountSummary?.today.discount_total ?? 0)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {discountSummary?.today.count ?? 0} bill(s)
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Is mahine</p>
                      <p className="font-black tabular-nums text-foreground">
                        {formatMoney(discountSummary?.month.discount_total ?? 0)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {discountSummary?.month.count ?? 0} bill(s)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </PagePanel>
          </div>

          <PagePanel>
            <PanelHeader
              title="Sales list"
              meta={`${filtered.length} shown${totalCount !== filtered.length ? ` · ${totalCount} total` : ""}`}
            />
            <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3">
              <FilterChips options={RANGES} value={range} onChange={setRange} aria-label="Filter sales by date" />
              <button
                type="button"
                onClick={() => setDiscountOnly((v) => !v)}
                className={cn(
                  "h-9 rounded-md px-3 text-sm font-bold transition-colors",
                  discountOnly
                    ? "bg-warning/15 text-warning ring-1 ring-warning/30"
                    : "border border-border/80 bg-card text-muted-foreground hover:bg-card-hover hover:text-foreground",
                )}
              >
                Discount wali
              </button>
              <SearchInput
                label="Invoice, customer, phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64"
                containerClassName="w-full sm:w-auto sm:ml-auto"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 p-10 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Sales load ho rahi hain…
              </div>
            ) : (
              <DataTable
                minWidth="860px"
                columns={["Invoice", "Customer", "Amount", "Discount", "Payment", "Time", "Actions"]}
                emptyLabel="Is range mein koi sale nahi."
                onRowClick={(i) => setSaleModal({ id: filtered[i].id })}
                rows={filtered.map((row) => [
                  <span key="inv" className="font-bold text-primary">{row.invoice_no}</span>,
                  <div key="cust" className="min-w-0">
                    <p className="font-semibold text-foreground">{row.customer?.name ?? "Walk-in Customer"}</p>
                    {hasDiscount(row) && (row.discount_recipient_name || row.discount_reason) && (
                      <p className="truncate text-[11px] text-warning">
                        {[row.discount_recipient_name, row.discount_reason].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>,
                  <span key="amt" className="font-black tabular-nums text-foreground">{formatMoney(Number(row.total))}</span>,
                  <span key="disc" className={cn("font-bold tabular-nums", hasDiscount(row) ? "text-warning" : "text-muted-foreground")}>
                    {hasDiscount(row) ? formatMoney(Number(row.discount)) : "—"}
                  </span>,
                  <StatusPill key="pay" tone={hasKhata(row) ? "warn" : "neutral"}>
                    {paymentLabel(row)}
                  </StatusPill>,
                  <span key="time" className="text-muted-foreground">{fmtSoldAt(row.sold_at)}</span>,
                  <div key="actions" className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 px-2 text-xs"
                      onClick={() => setSaleModal({ id: row.id, view: "return" })}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Return
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 px-2 text-xs"
                      onClick={() => setSaleModal({ id: row.id, view: "print" })}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print
                    </Button>
                  </div>,
                ])}
              />
            )}
          </PagePanel>
        </>
      )}

      {saleModal && (
        <SaleDetailModal
          saleId={saleModal.id}
          initialView={saleModal.view}
          onClose={() => setSaleModal(null)}
          onReturned={() => {
            showToast("Customer return record ho gaya — stock wapas aa gaya.", "success");
            loadSales();
            setSaleModal(null);
          }}
        />
      )}

      <AppToast toast={toast} onDismiss={hideToast} />
    </AdminShell>
  );
}
