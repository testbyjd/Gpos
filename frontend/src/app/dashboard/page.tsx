"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, Clock3, CreditCard, Loader2, ReceiptText, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getDashboard } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { SaleDetailModal } from "@/features/admin/components/DetailDrawers";
import {
  AdminShell,
  DataTable,
  PageAlert,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";
import { StatCard } from "@/components/ui/stat-card";
import { CloseTillButton } from "@/features/till/CloseTillButton";

type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openSaleId, setOpenSaleId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getDashboard()
      .then((res) => {
        if (!alive) return;
        setData(res);
        setLoadError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setData(null);
        setLoadError(getErrorMessage(err, "Dashboard data load nahi hua. Server check karo."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <AdminShell title="Dashboard" eyebrow="Today" actions={<CloseTillButton />}>
      {loadError && <PageAlert message={loadError} tone="error" />}

      {loading && !loadError && (
        <PagePanel className="flex items-center justify-center gap-2 p-10 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Dashboard load ho raha hai…
        </PagePanel>
      )}

      {!loading && !loadError && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                { label: "Net sales", value: data.metrics.net_sales, delta: "Live", icon: TrendingUp, tone: "primary" as const },
                { label: "Cash in till", value: data.metrics.cash_in_till, delta: "Open", icon: Banknote, tone: "success" as const },
                { label: "Card + wallet", value: data.metrics.card_wallet, delta: "Synced", icon: CreditCard, tone: "accent" as const },
                {
                  label: "Khata extended",
                  value: data.metrics.khata_extended,
                  delta: data.receivable_total ? "Receivable open" : "No credit today",
                  icon: ReceiptText,
                  tone: "warning" as const,
                },
              ] as const
            ).map(({ label, value, delta, icon: Icon, tone }) => (
              <StatCard key={label} label={label} value={formatMoney(value)} icon={Icon} tone={tone}>
                <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 text-xs">
                  <span className="font-semibold text-muted-foreground">Session status</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    {delta}
                  </span>
                </div>
              </StatCard>
            ))}
          </div>

          <PagePanel className="mt-4">
            <PanelHeader
              title="Aaj ki sales"
              meta={`${data.sales_today_count} bills · ${formatMoney(data.sales_today_total)} total`}
              actions={
                <Link href="/sales" className="text-xs font-bold text-primary hover:underline">
                  Saari dekho / print →
                </Link>
              }
            />
            <DataTable
              minWidth="560px"
              columns={["Invoice", "Customer", "Amount", "Payment", "Time"]}
              emptyLabel="Aaj abhi koi sale nahi."
              onRowClick={(i) => setOpenSaleId(data.sales_today[i].id)}
              rows={data.sales_today.map((row) => [
                <span key="inv" className="font-bold text-primary">{row.invoice_no}</span>,
                <span key="cust" className="font-semibold text-foreground">{row.customer}</span>,
                <span key="amt" className="font-bold tabular-nums text-foreground">{formatMoney(row.amount)}</span>,
                <StatusPill key="pay" tone={row.payment.includes("khata") ? "warn" : "neutral"}>{row.payment || "—"}</StatusPill>,
                <span key="time" className="text-muted-foreground">
                  {new Date(row.sold_at).toLocaleString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                </span>,
              ])}
            />
          </PagePanel>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <PagePanel>
              <PanelHeader title="Low stock" meta="Items nearest reorder point" actions={<AlertTriangle className="h-4 w-4 text-warning" />} />
              <DataTable
                columns={["Product", "Threshold", "Stock", "State"]}
                rows={data.low_stock.map((row) => [
                  <span key="product" className="font-bold text-foreground">{row.name}</span>,
                  `${Number(row.low_stock_threshold)} ${row.unit}`,
                  `${Number(row.stock_qty)} ${row.unit}`,
                  <StatusPill key="state" tone="warn">Reorder</StatusPill>,
                ])}
                minWidth="460px"
              />
            </PagePanel>

            <PagePanel className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total khata receivable
                  </p>
                  <p className="text-xl font-black tabular-nums text-foreground">
                    {formatMoney(data.receivable_total)}
                  </p>
                  <Link href="/khata" className="mt-1 inline-block text-xs font-bold text-primary hover:underline">
                    Khata / wasooli →
                  </Link>
                </div>
              </div>
            </PagePanel>
          </div>
        </>
      )}

      {openSaleId !== null && (
        <SaleDetailModal
          saleId={openSaleId}
          onClose={() => setOpenSaleId(null)}
          onReturned={() => {
            setOpenSaleId(null);
            getDashboard().then((res) => setData(res)).catch(() => {});
          }}
        />
      )}
    </AdminShell>
  );
}
