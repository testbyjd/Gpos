"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChips } from "@/components/ui/filter-chips";
import { cn, formatMoney } from "@/lib/utils";
import { getPayables, type PurchaseRow } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { VendorPaymentModal } from "@/features/admin/components/AdminActionModals";
import { PurchaseDetailModal } from "@/features/admin/components/DetailDrawers";
import { AdminShell, DataTable, PageLoadError, PagePanel, PanelHeader, StatusPill } from "@/features/admin/components/AdminShell";

const STATES = ["All", "Due", "Clear"] as const;
type PayablesData = Awaited<ReturnType<typeof getPayables>>;

export default function PayablesPage() {
  const [data, setData] = useState<PayablesData | null>(null);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<(typeof STATES)[number]>("All");
  const [showPayment, setShowPayment] = useState(false);
  const [selected, setSelected] = useState<PurchaseRow | null>(null);
  const { toast, showToast, hideToast } = useAppToast();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function loadPayables() {
    setLoading(true);
    return getPayables()
      .then((res) => {
        setData(res);
        setLoadError(null);
      })
      .catch((err) => {
        setData(null);
        setLoadError(getErrorMessage(err, "Payables load nahi hue. Server check karo."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPayables();
  }, []);

  const filtered = useMemo(() => {
    const invoices = data?.open_invoices ?? [];
    const q = search.toLowerCase().trim();
    return invoices.filter((p: PurchaseRow) => {
      const due = Number(p.balance_amount) > 0;
      if (state === "Due" && !due) return false;
      if (state === "Clear" && due) return false;
      return !q || [p.grn_no, p.vendor?.name ?? ""].some((x) => x.toLowerCase().includes(q));
    });
  }, [data, search, state]);

  return (
    <AdminShell
      title="Payables"
      eyebrow="Vendor balances and open GRNs"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => loadPayables()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowPayment(true)}><Plus className="h-4 w-4" />Payment</Button>
        </div>
      }
    >
      {loadError ? (
        <PageLoadError message={loadError} onRetry={loadPayables} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <PagePanel>
            <PanelHeader title="Open purchase invoices" meta={`${filtered.length} invoices`} />
            <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3">
              <SearchInput label="Search GRN or vendor" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" containerClassName="w-full sm:w-auto" />
              <FilterChips options={STATES} value={state} onChange={setState} aria-label="Filter payable state" />
            </div>
            <DataTable
              columns={["GRN", "Vendor", "Total", "Paid", "Balance", "State"]}
              onRowClick={(i) => setSelected(filtered[i])}
              rows={filtered.map((p) => [
                <span key="grn" className="font-bold text-foreground">{p.grn_no}</span>,
                p.vendor?.name ?? "—",
                <span key="total" className="tabular-nums text-muted-foreground">{formatMoney(Number(p.subtotal))}</span>,
                <span key="paid" className="tabular-nums text-muted-foreground">{formatMoney(Number(p.paid_amount))}</span>,
                <span key="balance" className="font-black tabular-nums text-foreground">{formatMoney(Number(p.balance_amount))}</span>,
                <StatusPill key="state" tone={Number(p.balance_amount) > 0 ? "warn" : "good"}>{Number(p.balance_amount) > 0 ? "Due" : "Clear"}</StatusPill>,
              ])}
            />
          </PagePanel>
          <PagePanel className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 text-danger ring-1 ring-danger/20"><Banknote className="h-5 w-5" /></div>
              <div><p className="font-black text-foreground">{formatMoney(data?.total_payable ?? 0)}</p><p className="text-xs text-muted-foreground">Total vendor payable</p></div>
            </div>
          </PagePanel>
        </div>
      )}

      {showPayment && (
        <VendorPaymentModal
          invoices={data?.open_invoices ?? []}
          onClose={() => setShowPayment(false)}
          onSaved={(msg) => {
            showToast(msg, "success");
            loadPayables();
          }}
        />
      )}

      {selected && (
        <PurchaseDetailModal
          purchase={selected}
          onClose={() => setSelected(null)}
          onReturned={() => {
            showToast("Vendor return record ho gaya.", "success");
            loadPayables();
          }}
        />
      )}
      <AppToast toast={toast} onDismiss={hideToast} />
    </AdminShell>
  );
}
