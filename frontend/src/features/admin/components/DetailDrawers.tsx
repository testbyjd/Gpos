"use client";

import { FormEvent, useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import { formatMoney } from "@/lib/utils";
import { DataTable, StatusPill } from "@/features/admin/components/AdminShell";
import {
  getCustomerLedger,
  getSale,
  getVendorDetail,
  listSales,
  recordCustomerRepayment,
  type CustomerRow,
  type LedgerEntry,
  type PurchaseRow,
  type SaleDetail,
  type SaleRow,
  type VendorPaymentRow,
  type VendorRow,
} from "@/lib/admin-api";

function fmtDate(value: string) {
  return new Date(value).toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ledgerLabel(type: string) {
  if (type === "sale_credit") return "Udhaar (sale)";
  if (type === "repayment") return "Wasooli";
  if (type === "adjustment") return "Adjustment";
  return type;
}

/** Right-side sliding panel rendered on document.body. */
function Drawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useModalDismiss(onClose);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div
          className="flex h-full w-full max-w-xl flex-col border-l border-border/80 bg-card shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border/80 px-5 py-4">
            <div className="min-w-0">
              <h3 className="truncate text-lg font-black text-foreground">{title}</h3>
              {subtitle && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </div>
      </div>
    </ModalPortal>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "warn" | "good" }) {
  return (
    <div className="rounded-lg border border-border/80 bg-background p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg font-black tabular-nums ${
          tone === "warn" ? "text-warning" : tone === "good" ? "text-success" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="mb-2 mt-5 text-sm font-black text-foreground">{children}</h4>;
}

export function CustomerDetailDrawer({
  customer,
  onClose,
  onChanged,
}: {
  customer: CustomerRow;
  onClose: () => void;
  onChanged?: (customer: CustomerRow) => void;
}) {
  const [balance, setBalance] = useState(Number(customer.balance));
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRepay, setShowRepay] = useState(false);
  const [openSaleId, setOpenSaleId] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [ledger, saleList] = await Promise.all([
        getCustomerLedger(customer.id),
        listSales(customer.id),
      ]);
      setEntries(ledger.entries);
      setBalance(Number(ledger.customer.balance));
      setSales(saleList.data);
      onChanged?.(ledger.customer);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id]);

  return (
    <Drawer
      title={customer.name}
      subtitle={`${customer.phone ?? "No phone"} · ${customer.code ?? `C-${customer.id}`}`}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Outstanding balance" value={formatMoney(balance)} tone={balance > 0 ? "warn" : "good"} />
        <div className="flex items-end">
          <Button className="w-full" disabled={balance <= 0} onClick={() => setShowRepay(true)}>
            Wasooli karo
          </Button>
        </div>
      </div>

      <SectionTitle>Bill history</SectionTitle>
      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
      ) : (
        <DataTable
          minWidth="420px"
          columns={["Invoice", "Date", "Total"]}
          emptyLabel="Koi bill nahi."
          onRowClick={(i) => setOpenSaleId(sales[i].id)}
          rows={sales.map((s) => [
            <span key="inv" className="font-bold text-primary">{s.invoice_no}</span>,
            <span key="date" className="text-muted-foreground">{fmtDate(s.sold_at)}</span>,
            <span key="total" className="font-black tabular-nums text-foreground">{formatMoney(Number(s.total))}</span>,
          ])}
        />
      )}

      <SectionTitle>Ledger (udhaar + wasooli)</SectionTitle>
      {loading ? null : (
        <DataTable
          minWidth="420px"
          columns={["Type", "Date", "Amount", "Balance"]}
          emptyLabel="Koi ledger entry nahi."
          rows={entries.map((e) => [
            ledgerLabel(e.type),
            <span key="date" className="text-muted-foreground">{fmtDate(e.created_at)}</span>,
            <span key="amt" className={`font-bold tabular-nums ${Number(e.amount) < 0 ? "text-success" : "text-warning"}`}>{formatMoney(Number(e.amount))}</span>,
            <span key="bal" className="tabular-nums text-foreground">{formatMoney(Number(e.balance_after))}</span>,
          ])}
        />
      )}

      {showRepay && (
        <RepaymentModal
          customer={customer}
          maxAmount={balance}
          onClose={() => setShowRepay(false)}
          onSaved={() => {
            setShowRepay(false);
            refresh();
          }}
        />
      )}
      {openSaleId !== null && <SaleDetailModal saleId={openSaleId} onClose={() => setOpenSaleId(null)} />}
    </Drawer>
  );
}

function RepaymentModal({
  customer,
  maxAmount,
  onClose,
  onSaved,
}: {
  customer: CustomerRow;
  maxAmount: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  useModalDismiss(onClose);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return setError("Sahi amount likho.");
    if (value > maxAmount) return setError(`Max ${formatMoney(maxAmount)} wasool ho sakta hai.`);
    setSaving(true);
    setError(null);
    try {
      await recordCustomerRepayment(customer.id, value, note.trim() || undefined);
      onSaved();
    } catch {
      setError("Wasooli fail. Dobara try karo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/50 p-4 py-8 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center">
          <form onSubmit={onSubmit} className="w-full max-w-md rounded-xl border border-border/80 bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-foreground">Wasooli — {customer.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">Outstanding: {formatMoney(maxAmount)}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Amount</span>
              <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" />
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">Note (optional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25" />
            </label>
            {error && <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">{error}</p>}
            <div className="mt-5 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Saving..." : "Wasool karo"}</Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

export function SaleDetailModal({ saleId, onClose }: { saleId: number; onClose: () => void }) {
  useModalDismiss(onClose);
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getSale(saleId)
      .then((res) => alive && setSale(res.data))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [saleId]);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/55 p-4 py-8 backdrop-blur-sm" onClick={onClose}>
        <div className="flex min-h-full items-center justify-center">
          <section className="w-full max-w-2xl rounded-xl border border-border/80 bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-foreground">{sale?.invoice_no ?? "Invoice"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {sale ? fmtDate(sale.sold_at) : ""}{sale?.cashier ? ` · ${sale.cashier.name}` : ""}
                </p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            {loading || !sale ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
            ) : (
              <>
                <DataTable
                  minWidth="460px"
                  columns={["Product", "Qty", "Rate", "Total"]}
                  rows={sale.lines.map((l) => [
                    <span key="p" className="font-semibold text-foreground">{l.product?.name ?? "Product"}</span>,
                    <span key="q" className="tabular-nums">{Number(l.qty)}</span>,
                    <span key="r" className="tabular-nums text-muted-foreground">{formatMoney(Number(l.unit_price))}</span>,
                    <span key="t" className="font-bold tabular-nums text-foreground">{formatMoney(Number(l.line_total))}</span>,
                  ])}
                />
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <SummaryCard label="Subtotal" value={formatMoney(Number(sale.subtotal))} />
                  <SummaryCard label="Discount" value={formatMoney(Number(sale.discount))} />
                  <SummaryCard label="Total" value={formatMoney(Number(sale.total))} />
                </div>
                <SectionTitle>Payments</SectionTitle>
                <DataTable
                  minWidth="320px"
                  columns={["Method", "Amount"]}
                  emptyLabel="Koi payment record nahi."
                  rows={(sale.payments ?? []).map((p) => [
                    <span key="m" className="font-semibold capitalize text-foreground">{p.method}</span>,
                    <span key="a" className="font-bold tabular-nums text-foreground">{formatMoney(Number(p.amount))}</span>,
                  ])}
                />
              </>
            )}
          </section>
        </div>
      </div>
    </ModalPortal>
  );
}

export function VendorDetailDrawer({
  vendor,
  onClose,
}: {
  vendor: VendorRow;
  onClose: () => void;
}) {
  const [balance, setBalance] = useState(Number(vendor.balance));
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [payments, setPayments] = useState<VendorPaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPurchase, setOpenPurchase] = useState<PurchaseRow | null>(null);

  useEffect(() => {
    let alive = true;
    getVendorDetail(vendor.id)
      .then((res) => {
        if (!alive) return;
        setBalance(Number(res.vendor.balance));
        setPurchases(res.purchases);
        setPayments(res.payments);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [vendor.id]);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <Drawer title={vendor.name} subtitle={vendor.phone ?? "No phone"} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Payable balance" value={formatMoney(balance)} tone={balance > 0 ? "warn" : "good"} />
        <SummaryCard label="Total paid" value={formatMoney(totalPaid)} />
      </div>

      <SectionTitle>Purchase history (GRNs)</SectionTitle>
      {loading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
      ) : (
        <DataTable
          minWidth="460px"
          columns={["GRN", "Date", "Total", "Balance"]}
          emptyLabel="Koi purchase nahi."
          onRowClick={(i) => setOpenPurchase(purchases[i])}
          rows={purchases.map((p) => [
            <span key="grn" className="font-bold text-primary">{p.grn_no}</span>,
            <span key="date" className="text-muted-foreground">{new Date(p.received_at).toLocaleDateString("en-PK")}</span>,
            <span key="total" className="tabular-nums text-foreground">{formatMoney(Number(p.subtotal))}</span>,
            <span key="bal" className="font-black tabular-nums text-foreground">{formatMoney(Number(p.balance_amount))}</span>,
          ])}
        />
      )}

      <SectionTitle>Payment history</SectionTitle>
      {loading ? null : (
        <DataTable
          minWidth="460px"
          columns={["Date", "GRN", "Amount", "Note"]}
          emptyLabel="Koi payment nahi."
          rows={payments.map((p) => [
            <span key="date" className="text-muted-foreground">{fmtDate(p.created_at)}</span>,
            p.purchase?.grn_no ?? "—",
            <span key="amt" className="font-bold tabular-nums text-success">{formatMoney(Number(p.amount))}</span>,
            p.note ?? "—",
          ])}
        />
      )}

      {openPurchase && <PurchaseDetailModal purchase={openPurchase} onClose={() => setOpenPurchase(null)} />}
    </Drawer>
  );
}

export function PurchaseDetailModal({ purchase, onClose }: { purchase: PurchaseRow; onClose: () => void }) {
  useModalDismiss(onClose);
  const balance = Number(purchase.balance_amount);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] overflow-y-auto bg-black/55 p-4 py-8 backdrop-blur-sm" onClick={onClose}>
        <div className="flex min-h-full items-center justify-center">
          <section className="w-full max-w-2xl rounded-xl border border-border/80 bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <StatusPill tone={balance > 0 ? "warn" : "good"}>{balance > 0 ? "Partial" : "Paid"}</StatusPill>
                <h3 className="mt-2 text-lg font-black text-foreground">{purchase.grn_no} · {purchase.vendor?.name ?? "Vendor"}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{new Date(purchase.received_at).toLocaleString("en-PK")}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <SummaryCard label="Total" value={formatMoney(Number(purchase.subtotal))} />
              <SummaryCard label="Paid" value={formatMoney(Number(purchase.paid_amount))} />
              <SummaryCard label="Balance" value={formatMoney(balance)} tone={balance > 0 ? "warn" : "good"} />
            </div>
            <div className="mt-4">
              <DataTable
                minWidth="460px"
                columns={["Product", "Qty", "Unit cost", "Line total"]}
                rows={purchase.lines.map((l) => [
                  l.product?.name ?? "Product",
                  Number(l.qty),
                  formatMoney(Number(l.unit_cost)),
                  formatMoney(Number(l.qty) * Number(l.unit_cost)),
                ])}
              />
            </div>
          </section>
        </div>
      </div>
    </ModalPortal>
  );
}
