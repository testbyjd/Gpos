"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, X } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney } from "@/lib/utils";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import { listPurchases, type PurchaseRow } from "@/lib/admin-api";
import { AdminShell, DataTable, PagePanel, PanelHeader, StatusPill } from "@/features/admin/components/AdminShell";

function stateTone(balance: number) {
  return balance > 0 ? "warn" : "good";
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [selected, setSelected] = useState<PurchaseRow | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    listPurchases().then((res) => alive && setPurchases(res.data)).catch(() => alive && setPurchases([]));
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return purchases.filter((p) => !q || [p.grn_no, p.vendor?.name ?? ""].some((x) => x.toLowerCase().includes(q)));
  }, [purchases, search]);
  const total = purchases.reduce((sum, p) => sum + Number(p.subtotal), 0);

  return (
    <AdminShell
      title="Purchases"
      eyebrow="Goods received and cost updates"
      actions={<Link href="/purchases/new" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover"><Plus className="h-4 w-4" />New Purchase</Link>}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PagePanel>
          <PanelHeader title="Purchase register" meta={`${filtered.length} GRNs from backend`} actions={<SearchInput label="Search GRN or vendor" value={search} onChange={(e) => setSearch(e.target.value)} className="w-60" containerClassName="hidden sm:block" />} />
          <DataTable
            columns={["GRN", "Date", "Vendor", "Items", "Amount", "Balance", "State"]}
            minWidth="760px"
            rows={filtered.map((purchase) => {
              const balance = Number(purchase.balance_amount);
              return [
                <button key="grn" onClick={() => setSelected(purchase)} className="text-left font-black text-primary hover:underline">{purchase.grn_no}</button>,
                new Date(purchase.received_at).toLocaleDateString("en-PK"),
                <span key="vendor" className="font-bold text-foreground">{purchase.vendor?.name ?? "—"}</span>,
                purchase.lines.map((l) => l.product?.name).filter(Boolean).join(", ") || `${purchase.lines.length} lines`,
                <span key="amount" className="font-black tabular-nums text-foreground">{formatMoney(Number(purchase.subtotal))}</span>,
                <span key="balance" className="font-bold tabular-nums text-foreground">{formatMoney(balance)}</span>,
                <StatusPill key="state" tone={stateTone(balance)}>{balance > 0 ? "Partial" : "Paid"}</StatusPill>,
              ];
            })}
          />
        </PagePanel>

        <div className="grid gap-4">
          <StatCard label="Purchases total" value={formatMoney(total)} icon={Plus} tone="primary" />
          <PagePanel className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20"><CalendarDays className="h-5 w-5" /></div>
              <div><p className="font-black text-foreground">Cost engine</p><p className="text-xs text-muted-foreground">Moving-average cost is applied in backend service.</p></div>
            </div>
          </PagePanel>
        </div>
      </div>

      {selected && <PurchaseModal purchase={selected} onClose={() => setSelected(null)} />}
    </AdminShell>
  );
}

function PurchaseModal({ purchase, onClose }: { purchase: PurchaseRow; onClose: () => void }) {
  useModalDismiss(onClose);
  const balance = Number(purchase.balance_amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>
      <section className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-surface shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border/80 px-5 py-4">
          <div><StatusPill tone={stateTone(balance)}>{balance > 0 ? "Partial" : "Paid"}</StatusPill><h2 className="mt-2 text-xl font-black text-foreground">{purchase.grn_no} · {purchase.vendor?.name ?? "Vendor"}</h2><p className="mt-1 text-sm text-muted-foreground">{new Date(purchase.received_at).toLocaleString("en-PK")}</p></div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground" aria-label="Close purchase details"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[calc(90vh-5rem)] overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Total", purchase.subtotal], ["Paid", purchase.paid_amount], ["Balance", purchase.balance_amount]].map(([label, value]) => <div key={label} className="rounded-lg border border-border/80 bg-card p-3"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-xl font-black tabular-nums text-foreground">{formatMoney(Number(value))}</p></div>)}
          </div>
          <div className="mt-4"><DataTable columns={["Product", "Qty", "Unit cost", "Line total"]} rows={purchase.lines.map((line) => [line.product?.name ?? "Product", Number(line.qty), formatMoney(Number(line.unit_cost)), formatMoney(Number(line.qty) * Number(line.unit_cost))])} /></div>
        </div>
      </section>
    </div>
  );
}
