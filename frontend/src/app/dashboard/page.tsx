"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Banknote, Clock3, CreditCard, ReceiptText, TrendingUp } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { getDashboard } from "@/lib/admin-api";
import {
  AdminShell,
  DataTable,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";
import { StatCard } from "@/components/ui/stat-card";
import { CloseTillButton } from "@/features/till/CloseTillButton";

type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getDashboard()
      .then((res) => alive && setData(res))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const metrics = [
    { label: "Net sales", value: data?.metrics.net_sales ?? 0, delta: data ? "Live" : "Loading", icon: TrendingUp, tone: "primary" as const },
    { label: "Cash in till", value: data?.metrics.cash_in_till ?? 0, delta: "Open", icon: Banknote, tone: "success" as const },
    { label: "Card + wallet", value: data?.metrics.card_wallet ?? 0, delta: "Synced", icon: CreditCard, tone: "accent" as const },
    { label: "Khata extended", value: data?.metrics.khata_extended ?? 0, delta: data?.receivable_total ? "Receivable open" : "No credit today", icon: ReceiptText, tone: "warning" as const },
  ];

  return (
    <AdminShell title="Dashboard" eyebrow="Today" actions={<CloseTillButton />}>
      {error && (
        <PagePanel className="mb-4 border-danger/30 bg-danger/5 p-3 text-sm font-bold text-danger">
          Backend data load nahi hua. Server check karo.
        </PagePanel>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, delta, icon: Icon, tone }) => (
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

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <PagePanel>
          <PanelHeader title="Recent sales" meta="Live register activity" actions={<StatusPill tone="good">Online sync</StatusPill>} />
          <DataTable
            columns={["Invoice", "Customer", "Amount", "Payment", "Time"]}
            rows={(data?.recent_sales ?? []).map((row) => [
              <span key="invoice" className="font-bold text-foreground">{row.invoice_no}</span>,
              row.customer,
              <span key="amount" className="font-bold tabular-nums text-foreground">{formatMoney(row.amount)}</span>,
              <StatusPill key="payment" tone={row.payment.includes("khata") ? "warn" : "neutral"}>{row.payment || "—"}</StatusPill>,
              row.time,
            ])}
          />
        </PagePanel>

        <div className="grid gap-4">
          <PagePanel>
            <PanelHeader title="Low stock" meta="Items nearest reorder point" actions={<AlertTriangle className="h-4 w-4 text-warning" />} />
            <DataTable
              columns={["Product", "Threshold", "Stock", "State"]}
              rows={(data?.low_stock ?? []).map((row) => [
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
                  {formatMoney(data?.receivable_total ?? 0)}
                </p>
              </div>
            </div>
          </PagePanel>
        </div>
      </div>
    </AdminShell>
  );
}
