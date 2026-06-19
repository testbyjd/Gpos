"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChips } from "@/components/ui/filter-chips";
import { formatMoney } from "@/lib/utils";
import { listCustomers, type CustomerRow } from "@/lib/admin-api";
import { CustomerFormModal } from "@/features/admin/components/AdminActionModals";
import { AdminShell, DataTable, PagePanel, PanelHeader, StatusPill } from "@/features/admin/components/AdminShell";

const STATES = ["All", "Due", "Clear"] as const;

export default function KhataPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<(typeof STATES)[number]>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listCustomers().then((res) => alive && setCustomers(res.data)).catch(() => alive && setCustomers([]));
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers.filter((c) => {
      const due = Number(c.balance) > 0;
      if (state === "Due" && !due) return false;
      if (state === "Clear" && due) return false;
      return !q || [c.name, c.phone ?? "", c.code ?? ""].some((x) => x.toLowerCase().includes(q));
    });
  }, [customers, search, state]);
  const totalDue = customers.reduce((sum, c) => sum + Number(c.balance), 0);

  return (
    <AdminShell
      title="Khata"
      eyebrow="Customer credit ledger"
      actions={<Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4" />Customer</Button>}
    >
      {notice && (
        <div className="mb-4 rounded-lg border border-border/80 bg-muted/60 px-4 py-3 text-sm font-semibold text-foreground">{notice}</div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PagePanel>
          <PanelHeader title="Customer balances" meta={`${filtered.length} of ${customers.length} customers`} />
          <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3">
            <SearchInput label="Search customer, phone, code" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" containerClassName="w-full sm:w-auto" />
            <FilterChips options={STATES} value={state} onChange={setState} aria-label="Filter khata state" />
          </div>
          <DataTable
            columns={["Customer", "Phone", "Code", "Balance", "State"]}
            rows={filtered.map((customer) => [
              <span key="name" className="font-bold text-foreground">{customer.name}</span>,
              customer.phone ?? "—",
              customer.code ?? `C-${customer.id}`,
              <span key="balance" className="font-black tabular-nums text-foreground">{formatMoney(Number(customer.balance))}</span>,
              <StatusPill key="state" tone={Number(customer.balance) > 0 ? "warn" : "good"}>{Number(customer.balance) > 0 ? "Due" : "Clear"}</StatusPill>,
            ])}
          />
        </PagePanel>
        <PagePanel className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning ring-1 ring-warning/20"><Users className="h-5 w-5" /></div>
            <div><p className="font-black text-foreground">{formatMoney(totalDue)}</p><p className="text-xs text-muted-foreground">Total receivable from backend</p></div>
          </div>
        </PagePanel>
      </div>

      {showAdd && (
        <CustomerFormModal
          onClose={() => setShowAdd(false)}
          onSaved={(c) => {
            setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
            setNotice(`"${c.name}" add ho gaya.`);
          }}
        />
      )}
    </AdminShell>
  );
}
