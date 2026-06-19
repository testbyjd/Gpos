"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { formatMoney } from "@/lib/utils";
import { listVendors, type VendorRow } from "@/lib/admin-api";
import { VendorFormModal } from "@/features/admin/components/AdminActionModals";
import { VendorDetailDrawer } from "@/features/admin/components/DetailDrawers";
import { AdminShell, DataTable, PagePanel, PanelHeader, StatusPill } from "@/features/admin/components/AdminShell";

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<VendorRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listVendors().then((res) => alive && setVendors(res.data)).catch(() => alive && setVendors([]));
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vendors.filter((v) => !q || [v.name, v.phone ?? ""].some((x) => x.toLowerCase().includes(q)));
  }, [vendors, search]);

  return (
    <AdminShell
      title="Vendors"
      eyebrow="Supplier directory"
      actions={<Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" />Vendor</Button>}
    >
      {notice && (
        <div className="mb-4 rounded-lg border border-border/80 bg-muted/60 px-4 py-3 text-sm font-semibold text-foreground">{notice}</div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PagePanel>
          <PanelHeader title="Vendor directory" meta={`${filtered.length} of ${vendors.length} vendors`} actions={<SearchInput label="Search vendor or phone" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" containerClassName="hidden sm:block" />} />
          <DataTable
            columns={["Vendor", "Phone", "Balance", "State"]}
            onRowClick={(i) => setSelected(filtered[i])}
            rows={filtered.map((vendor) => [
              <span key="name" className="font-bold text-foreground">{vendor.name}</span>,
              vendor.phone ?? "—",
              <span key="balance" className="font-black tabular-nums text-foreground">{formatMoney(Number(vendor.balance))}</span>,
              <StatusPill key="state" tone={Number(vendor.balance) > 0 ? "warn" : "good"}>{Number(vendor.balance) > 0 ? "Payable" : "Clear"}</StatusPill>,
            ])}
          />
        </PagePanel>
        <PagePanel className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20"><Truck className="h-5 w-5" /></div>
            <div><p className="font-black text-foreground">{vendors.length} vendors</p><p className="text-xs text-muted-foreground">Loaded from backend API</p></div>
          </div>
        </PagePanel>
      </div>

      {showAdd && (
        <VendorFormModal
          onClose={() => setShowAdd(false)}
          onSaved={(v) => {
            setVendors((prev) => [...prev, v].sort((a, b) => a.name.localeCompare(b.name)));
            setNotice(`"${v.name}" add ho gaya.`);
          }}
        />
      )}

      {selected && <VendorDetailDrawer vendor={selected} onClose={() => setSelected(null)} />}
    </AdminShell>
  );
}
