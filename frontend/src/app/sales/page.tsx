"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Printer, Receipt, RefreshCw, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { FilterChips } from "@/components/ui/filter-chips";
import { SearchInput } from "@/components/ui/search-input";
import { formatMoney } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import { listSales, type SaleRow } from "@/lib/admin-api";
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

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetDates(range: Range): { from?: string; to?: string } {
  const today = new Date();
  if (range === "All") return {};
  if (range === "Yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: ymd(y), to: ymd(y) };
  }
  if (range === "This week") {
    const s = new Date(today);
    const offset = (s.getDay() + 6) % 7;
    s.setDate(s.getDate() - offset);
    return { from: ymd(s), to: ymd(today) };
  }
  if (range === "This month") {
    return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
  }
  return { from: ymd(today), to: ymd(today) };
}

function fmtSoldAt(iso: string) {
  return new Date(iso).toLocaleString("en-PK", {
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

export default function SalesPage() {
  const [range, setRange] = useState<Range>("Today");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saleModal, setSaleModal] = useState<{ id: number; view?: "return" | "print" } | null>(null);
  const { toast, showToast, hideToast } = useAppToast();

  const dates = presetDates(range);

  function loadSales() {
    setLoading(true);
    return listSales({ ...dates, perPage: 200 })
      .then((res) => {
        setRows(res.data);
        setTotalCount(res.meta.total);
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
    if (!q) return rows;
    return rows.filter((r) =>
      [r.invoice_no, r.customer?.name ?? "", r.customer?.phone ?? ""].some((x) =>
        x.toLowerCase().includes(q),
      ),
    );
  }, [rows, search]);

  const salesTotal = filtered.reduce((sum, r) => sum + Number(r.total), 0);

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
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <PagePanel className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bills</p>
                <p className="text-xl font-black tabular-nums text-foreground">{totalCount}</p>
              </div>
            </PagePanel>
            <PagePanel className="flex items-center gap-3 p-4 sm:col-span-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Sales total ({range})
                </p>
                <p className="text-xl font-black tabular-nums text-foreground">{formatMoney(salesTotal)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bill dhundo → <strong>Return</strong> se customer return, <strong>Print</strong> se receipt dubara.
                </p>
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
                minWidth="720px"
                columns={["Invoice", "Customer", "Amount", "Payment", "Time", "Actions"]}
                emptyLabel="Is range mein koi sale nahi."
                onRowClick={(i) => setSaleModal({ id: filtered[i].id })}
                rows={filtered.map((row) => [
                  <span key="inv" className="font-bold text-primary">{row.invoice_no}</span>,
                  <span key="cust" className="font-semibold text-foreground">
                    {row.customer?.name ?? "Walk-in Customer"}
                  </span>,
                  <span key="amt" className="font-black tabular-nums text-foreground">{formatMoney(Number(row.total))}</span>,
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
