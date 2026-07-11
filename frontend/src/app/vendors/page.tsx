"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { SearchInput } from "@/components/ui/search-input";
import { cn, formatSignedBalance } from "@/lib/utils";
import { listVendors, type VendorRow } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { VendorFormModal } from "@/features/admin/components/AdminActionModals";
import { AdminShell, DataTable, PageLoadError, PagePanel, PanelHeader, StatusPill } from "@/features/admin/components/AdminShell";

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

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const { toast, showToast, hideToast } = useAppToast();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function loadVendors() {
    setLoading(true);
    return listVendors()
      .then((res) => {
        setVendors(res.data);
        setLoadError(null);
      })
      .catch((err) => {
        setVendors([]);
        setLoadError(getErrorMessage(err, "Vendors load nahi hue. Server check karo."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadVendors();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return vendors.filter((v) => !q || [v.name, v.phone ?? ""].some((x) => x.toLowerCase().includes(q)));
  }, [vendors, search]);

  return (
    <AdminShell
      title="Vendors"
      eyebrow="Supplier directory"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => loadVendors()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Vendor
          </Button>
        </div>
      }
    >
      {loadError ? (
        <PageLoadError message={loadError} onRetry={loadVendors} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <PagePanel>
            <PanelHeader
              title="Vendor directory"
              meta={`${filtered.length} of ${vendors.length} vendors`}
              actions={
                <SearchInput
                  label="Search vendor or phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                  containerClassName="hidden sm:block"
                />
              }
            />
            <DataTable
              columns={["Vendor", "Stars", "Phone", "Balance", "State"]}
              onRowClick={(i) => router.push(`/vendors/${filtered[i].id}`)}
              rows={filtered.map((vendor) => [
                <span key="name" className="font-bold text-foreground">
                  {vendor.name}
                </span>,
                <ListStars key="stars" ranking={Number(vendor.ranking ?? 0)} />,
                vendor.phone ?? "—",
                <span key="balance" className="font-black tabular-nums text-foreground">
                  {formatSignedBalance(Number(vendor.balance))}
                </span>,
                <StatusPill
                  key="state"
                  tone={Number(vendor.balance) > 0 ? "warn" : Number(vendor.balance) < 0 ? "info" : "good"}
                >
                  {Number(vendor.balance) > 0 ? "Payable" : Number(vendor.balance) < 0 ? "Credit" : "Clear"}
                </StatusPill>,
              ])}
            />
          </PagePanel>
          <PagePanel className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-foreground">{vendors.length} vendors</p>
                <p className="text-xs text-muted-foreground">Row click → details / edit</p>
              </div>
            </div>
          </PagePanel>
        </div>
      )}

      {showAdd && (
        <VendorFormModal
          onClose={() => setShowAdd(false)}
          onSaved={(v) => {
            setVendors((prev) =>
              [...prev, v].sort((a, b) => {
                const rd = Number(b.ranking ?? 0) - Number(a.ranking ?? 0);
                return rd !== 0 ? rd : a.name.localeCompare(b.name);
              }),
            );
            showToast(`"${v.name}" add ho gaya.`, "success");
            router.push(`/vendors/${v.id}`);
          }}
        />
      )}

      <AppToast toast={toast} onDismiss={hideToast} />
    </AdminShell>
  );
}
