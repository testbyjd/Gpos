"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { cn, formatMoney, formatSignedBalance } from "@/lib/utils";
import { formatPkDateTime } from "@/lib/datetime";
import { getErrorMessage } from "@/lib/api";
import {
  getVendorDetail,
  updateVendor,
  type PurchaseRow,
  type PurchaseReturnRow,
  type VendorContact,
  type VendorContactRole,
  type VendorPaymentRow,
  type VendorRow,
} from "@/lib/admin-api";
import {
  AdminShell,
  DataTable,
  PageLoadError,
  PagePanel,
  PanelHeader,
} from "@/features/admin/components/AdminShell";
import { PurchaseDetailModal } from "@/features/admin/components/DetailDrawers";

const CONTACT_ROLES: { value: VendorContactRole; label: string }[] = [
  { value: "salesperson", label: "Salesperson" },
  { value: "delivery", label: "Delivery" },
  { value: "accounts", label: "Accounts" },
  { value: "owner", label: "Owner" },
  { value: "other", label: "Other" },
];

type ContactDraft = VendorContact & { key: string };

function fmtDate(value: string) {
  return formatPkDateTime(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RankingStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Vendor ranking">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={filled && (n === value || (value > 0 && n === value))}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => onChange(value === n ? 0 : n)}
            className="rounded p-0.5 text-warning transition hover:scale-110"
          >
            <Star className={cn("h-6 w-6", filled ? "fill-current" : "fill-transparent text-muted-foreground/50")} />
          </button>
        );
      })}
      <span className="ml-2 text-xs font-semibold text-muted-foreground">
        {value === 0 ? "Unrated" : `${value}/5`}
      </span>
    </div>
  );
}

function fieldClass() {
  return "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary";
}

export default function VendorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const { toast, showToast, hideToast } = useAppToast();

  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [ranking, setRanking] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [contacts, setContacts] = useState<ContactDraft[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<VendorPaymentRow[]>([]);
  const [returns, setReturns] = useState<PurchaseReturnRow[]>([]);
  const [openPurchase, setOpenPurchase] = useState<PurchaseRow | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    if (!Number.isFinite(id) || id <= 0) {
      setLoadError("Invalid vendor id.");
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    return getVendorDetail(id)
      .then((res) => {
        const v = res.vendor;
        setVendor(v);
        setName(v.name);
        setPhone(v.phone ?? "");
        setAddress(v.address ?? "");
        setRanking(Number(v.ranking ?? 0));
        setIsActive(Boolean(v.is_active));
        setContacts(
          (v.contacts ?? []).map((c, i) => ({
            ...c,
            key: c.id ? `id-${c.id}` : `new-${i}`,
          })),
        );
        setPurchases(res.purchases);
        setPayments(res.payments);
        setReturns(res.returns ?? []);
        setLoadError(null);
      })
      .catch((err) => {
        setVendor(null);
        setLoadError(getErrorMessage(err, "Vendor detail load nahi hui."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const balance = Number(vendor?.balance ?? 0);
  const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + Number(p.amount), 0), [payments]);

  function addContact() {
    setContacts((prev) => [
      ...prev,
      { key: `new-${Date.now()}`, name: "", phone: "", role: "salesperson", note: "" },
    ]);
  }

  function updateContact(key: string, patch: Partial<VendorContact>) {
    setContacts((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function removeContact(key: string) {
    setContacts((prev) => prev.filter((c) => c.key !== key));
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setSaveError("Vendor name zaroori hai.");
      return;
    }
    for (const c of contacts) {
      if (!c.name.trim()) {
        setSaveError("Har contact ka name zaroori hai.");
        return;
      }
      if (!c.phone?.trim()) {
        setSaveError("Har contact ka phone zaroori hai.");
        return;
      }
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await updateVendor(id, {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        ranking,
        is_active: isActive,
        contacts: contacts.map((c) => ({
          id: c.id,
          name: c.name.trim(),
          phone: c.phone?.trim() || null,
          role: c.role,
          note: c.note?.trim() || null,
        })),
      });
      setVendor(res.data);
      setContacts(
        (res.data.contacts ?? []).map((c, i) => ({
          ...c,
          key: c.id ? `id-${c.id}` : `saved-${i}`,
        })),
      );
      showToast("Vendor save ho gaya.", "success");
    } catch (err) {
      setSaveError(getErrorMessage(err, "Vendor save nahi hua."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell
      title={vendor?.name ?? "Vendor"}
      eyebrow="Vendor details"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => router.push("/vendors")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <Button size="sm" form="vendor-edit-form" type="submit" disabled={saving || loading || !vendor}>
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      {loadError ? (
        <PageLoadError message={loadError} onRetry={load} />
      ) : loading || !vendor ? (
        <PagePanel>
          <p className="p-8 text-center text-sm text-muted-foreground">Loading vendor…</p>
        </PagePanel>
      ) : (
        <div className="space-y-4">
          <form id="vendor-edit-form" onSubmit={onSave} className="grid gap-4 xl:grid-cols-2">
            <PagePanel>
              <PanelHeader title="Profile" meta="Edit vendor details" />
              <div className="space-y-3 p-4 pt-0">
                <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Name
                  <input className={fieldClass()} value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Phone
                  <input className={fieldClass()} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Address
                  <input className={fieldClass()} value={address} onChange={(e) => setAddress(e.target.value)} />
                </label>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ranking</p>
                  <div className="mt-2">
                    <RankingStars value={ranking} onChange={setRanking} />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  Active vendor
                </label>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-lg border border-border/80 bg-background p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {balance < 0 ? "Vendor credit" : "Payable balance"}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-lg font-black tabular-nums",
                        balance > 0 ? "text-warning" : "text-success",
                      )}
                    >
                      {formatSignedBalance(balance)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-background p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Total paid</p>
                    <p className="mt-1 text-lg font-black tabular-nums text-foreground">{formatMoney(totalPaid)}</p>
                  </div>
                </div>
                {saveError && (
                  <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
                    {saveError}
                  </p>
                )}
              </div>
            </PagePanel>

            <PagePanel>
              <PanelHeader
                title="People"
                meta={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}`}
                actions={
                  <Button type="button" size="sm" variant="secondary" onClick={addContact}>
                    <Plus className="h-4 w-4" />
                    Add
                  </Button>
                }
              />
              <div className="space-y-3 p-4 pt-0">
                {contacts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Abhi koi contact nahi. Salesperson / delivery add karo.
                  </p>
                ) : (
                  contacts.map((c) => (
                    <div key={c.key} className="space-y-2 rounded-lg border border-border/80 bg-background p-3">
                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                        <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Name
                          <input
                            className={fieldClass()}
                            value={c.name}
                            onChange={(e) => updateContact(c.key, { name: e.target.value })}
                            required
                          />
                        </label>
                        <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Phone
                          <input
                            className={fieldClass()}
                            value={c.phone ?? ""}
                            onChange={(e) => updateContact(c.key, { phone: e.target.value })}
                            required
                          />
                        </label>
                        <div className="flex items-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="text-danger"
                            onClick={() => removeContact(c.key)}
                            aria-label="Remove contact"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Role
                          <select
                            className={fieldClass()}
                            value={c.role}
                            onChange={(e) => updateContact(c.key, { role: e.target.value as VendorContactRole })}
                          >
                            {CONTACT_ROLES.map((r) => (
                              <option key={r.value} value={r.value}>
                                {r.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Note
                          <input
                            className={fieldClass()}
                            value={c.note ?? ""}
                            onChange={(e) => updateContact(c.key, { note: e.target.value })}
                            placeholder={c.role === "other" ? "Optional detail" : "Optional"}
                          />
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </PagePanel>
          </form>

          <PagePanel>
            <PanelHeader title="Purchase history (GRNs)" meta={`${purchases.length} GRNs`} />
            <div className="p-4 pt-0">
              <DataTable
                minWidth="460px"
                columns={["GRN", "Date", "Total", "Balance"]}
                emptyLabel="Koi purchase nahi."
                onRowClick={(i) => setOpenPurchase({ ...purchases[i], vendor })}
                rows={purchases.map((p) => [
                  <span key="grn" className="font-bold text-primary">
                    {p.grn_no}
                  </span>,
                  <span key="date" className="text-muted-foreground">
                    {new Date(p.received_at).toLocaleDateString("en-PK")}
                  </span>,
                  <span key="total" className="tabular-nums text-foreground">
                    {formatMoney(Number(p.subtotal))}
                  </span>,
                  <span key="bal" className="font-black tabular-nums text-foreground">
                    {formatMoney(Number(p.balance_amount))}
                  </span>,
                ])}
              />
            </div>
          </PagePanel>

          <PagePanel>
            <PanelHeader title="Payment history" meta={`${payments.length} payments`} />
            <div className="p-4 pt-0">
              <DataTable
                minWidth="460px"
                columns={["Date", "GRN", "Amount", "Note"]}
                emptyLabel="Koi payment nahi."
                rows={payments.map((p) => [
                  <span key="date" className="text-muted-foreground">
                    {fmtDate(p.created_at)}
                  </span>,
                  p.purchase?.grn_no ?? "—",
                  <span key="amt" className="font-bold tabular-nums text-success">
                    {formatMoney(Number(p.amount))}
                  </span>,
                  p.note ?? "—",
                ])}
              />
            </div>
          </PagePanel>

          <PagePanel>
            <PanelHeader title="Return history" meta={`${returns.length} returns`} />
            <div className="p-4 pt-0">
              <DataTable
                minWidth="460px"
                columns={["Date", "Return#", "Items", "Value"]}
                emptyLabel="Koi return nahi."
                rows={returns.map((r) => [
                  <span key="date" className="text-muted-foreground">
                    {fmtDate(r.returned_at)}
                  </span>,
                  <span key="no" className="font-bold text-foreground">
                    {r.return_no}
                  </span>,
                  r.lines.map((l) => l.product?.name).filter(Boolean).join(", ") || `${r.lines.length} items`,
                  <span key="val" className="font-bold tabular-nums text-warning">
                    {formatMoney(Number(r.subtotal))}
                  </span>,
                ])}
              />
            </div>
          </PagePanel>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/vendors" className="font-semibold text-primary hover:underline">
              ← Vendors list
            </Link>
          </p>
        </div>
      )}

      {openPurchase && (
        <PurchaseDetailModal
          purchase={openPurchase}
          onClose={() => setOpenPurchase(null)}
          onReturned={() => load()}
        />
      )}
      <AppToast toast={toast} onDismiss={hideToast} />
    </AdminShell>
  );
}
