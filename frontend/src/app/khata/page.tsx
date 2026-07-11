"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Star, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChips } from "@/components/ui/filter-chips";
import { cn, formatMoney } from "@/lib/utils";
import { listCustomers, type CustomerRow } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { CustomerFormModal } from "@/features/admin/components/AdminActionModals";
import { CustomerDetailDrawer } from "@/features/admin/components/DetailDrawers";
import { AdminShell, DataTable, PageLoadError, PagePanel, PanelHeader, StatusPill } from "@/features/admin/components/AdminShell";

const STATES = ["All", "Due", "Clear"] as const;

function ListStars({ ranking }: { ranking: number }) {
  const value = Math.max(0, Math.min(5, Math.round(ranking)));
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={value === 0 ? "Unrated" : `${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn("h-3.5 w-3.5 text-warning", n <= value ? "fill-current" : "fill-transparent text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

export default function KhataPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<(typeof STATES)[number]>("All");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<CustomerRow | null>(null);
  const { toast, showToast, hideToast } = useAppToast();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function loadCustomers() {
    setLoading(true);
    return listCustomers()
      .then((res) => {
        setCustomers(res.data);
        setLoadError(null);
      })
      .catch((err) => {
        setCustomers([]);
        setLoadError(getErrorMessage(err, "Customers load nahi hue. Server check karo."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCustomers();
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
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => loadCustomers()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Customer
          </Button>
        </div>
      }
    >
      {loadError ? (
        <PageLoadError message={loadError} onRetry={loadCustomers} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <PagePanel>
            <PanelHeader title="Customer balances" meta={`${filtered.length} of ${customers.length} customers`} />
            <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3">
              <SearchInput
                label="Search customer, phone, code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64"
                containerClassName="w-full sm:w-auto"
              />
              <FilterChips options={STATES} value={state} onChange={setState} aria-label="Filter khata state" />
            </div>
            <DataTable
              columns={["Customer", "Stars", "Phone", "Code", "Balance", "State"]}
              onRowClick={(i) => setSelected(filtered[i])}
              rows={filtered.map((customer) => [
                <span key="name" className="font-bold text-foreground">
                  {customer.name}
                </span>,
                <ListStars key="stars" ranking={Number(customer.ranking ?? 0)} />,
                customer.phone ?? "—",
                customer.code ?? `C-${customer.id}`,
                <span key="balance" className="font-black tabular-nums text-foreground">
                  {formatMoney(Number(customer.balance))}
                </span>,
                <StatusPill key="state" tone={Number(customer.balance) > 0 ? "warn" : "good"}>
                  {Number(customer.balance) > 0 ? "Due" : "Clear"}
                </StatusPill>,
              ])}
            />
          </PagePanel>
          <PagePanel className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning ring-1 ring-warning/20">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-foreground">{formatMoney(totalDue)}</p>
                <p className="text-xs text-muted-foreground">Total receivable · row click → stars set</p>
              </div>
            </div>
          </PagePanel>
        </div>
      )}

      {showAdd && (
        <CustomerFormModal
          onClose={() => setShowAdd(false)}
          onSaved={(c) => {
            setCustomers((prev) =>
              [...prev, c].sort((a, b) => {
                const rd = Number(b.ranking ?? 0) - Number(a.ranking ?? 0);
                return rd !== 0 ? rd : a.name.localeCompare(b.name);
              }),
            );
            showToast(`"${c.name}" add ho gaya.`, "success");
          }}
        />
      )}

      {selected && (
        <CustomerDetailDrawer
          customer={selected}
          onClose={() => setSelected(null)}
          onChanged={(updated) => {
            setSelected(updated);
            setCustomers((prev) =>
              prev
                .map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
                .sort((a, b) => {
                  const rd = Number(b.ranking ?? 0) - Number(a.ranking ?? 0);
                  return rd !== 0 ? rd : a.name.localeCompare(b.name);
                }),
            );
          }}
          onNotify={(msg) => showToast(msg, "success")}
        />
      )}
      <AppToast toast={toast} onDismiss={hideToast} />
    </AdminShell>
  );
}
