"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { SearchInput } from "@/components/ui/search-input";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney } from "@/lib/utils";
import { listPurchases, type PurchaseRow } from "@/lib/admin-api";
import { PurchaseDetailModal } from "@/features/admin/components/DetailDrawers";
import { AdminShell, DataTable, PagePanel, PanelHeader, StatusPill } from "@/features/admin/components/AdminShell";

function stateTone(balance: number) {
  return balance > 0 ? "warn" : "good";
}

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [selected, setSelected] = useState<PurchaseRow | null>(null);
  const [search, setSearch] = useState("");

  function load() {
    return listPurchases().then((res) => setPurchases(res.data));
  }

  useEffect(() => {
    let alive = true;
    load().catch(() => alive && setPurchases([]));
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

      {selected && (
        <PurchaseDetailModal
          purchase={selected}
          onClose={() => setSelected(null)}
          onReturned={() => load()}
        />
      )}
    </AdminShell>
  );
}
