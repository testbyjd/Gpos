"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Download, Loader2, Printer, Tag, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/filter-chips";
import { cn, formatMoney } from "@/lib/utils";
import { getReports } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { writeOffReasonLabel } from "@/features/inventory/components/WriteOffModal";
import {
  AdminShell,
  DataTable,
  PageLoadError,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";

const RANGES = ["Today", "Yesterday", "This week", "This month", "Custom"] as const;
type Range = (typeof RANGES)[number];
type ReportsData = Awaited<ReturnType<typeof getReports>>;

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetDates(range: Range): { from: string; to: string } {
  const today = new Date();
  if (range === "Yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: ymd(y), to: ymd(y) };
  }
  if (range === "This week") {
    const s = new Date(today);
    const offset = (s.getDay() + 6) % 7; // Monday start
    s.setDate(s.getDate() - offset);
    return { from: ymd(s), to: ymd(today) };
  }
  if (range === "This month") {
    return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
  }
  return { from: ymd(today), to: ymd(today) };
}

export default function ReportsPage() {
  const [range, setRange] = useState<Range>("Today");
  const [customFrom, setCustomFrom] = useState(() => ymd(new Date()));
  const [customTo, setCustomTo] = useState(() => ymd(new Date()));
  const [category, setCategory] = useState("All");
  const [data, setData] = useState<ReportsData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { from, to } = range === "Custom" ? { from: customFrom, to: customTo } : presetDates(range);

  function loadReports() {
    if (!from || !to) return Promise.resolve();
    setLoading(true);
    return getReports(from, to)
      .then((res) => {
        setData(res);
        setLoadError(null);
      })
      .catch((err) => {
        setData(null);
        setLoadError(getErrorMessage(err, "Reports load nahi hue. Server check karo."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let alive = true;
    if (!from || !to) return;
    setLoading(true);
    getReports(from, to)
      .then((res) => {
        if (!alive) return;
        setData(res);
        setLoadError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setData(null);
        setLoadError(getErrorMessage(err, "Reports load nahi hue. Server check karo."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [from, to]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set((data?.profit_by_category ?? []).map((r) => r.category)))],
    [data],
  );
  const filteredProfit = useMemo(
    () => (category === "All" ? data?.profit_by_category ?? [] : (data?.profit_by_category ?? []).filter((r) => r.category === category)),
    [category, data],
  );
  const totalTopSales = (data?.top_items ?? []).reduce((sum, item) => sum + item.amount, 0);
  const showData = !loading && !loadError && data;

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Report", range, `${from} to ${to}`],
      ["Gross sales", data.gross_sales],
      ["Gross profit", data.gross_profit],
      ["Total discount", data.total_discount ?? 0],
      ["Discount bills", data.discount_count ?? 0],
      ["Stock write-off loss", data.total_write_off_loss ?? 0],
      ["Net receivable", data.net_receivable],
      [],
      ["Write-off reason", "Qty", "Loss"],
      ...(data.write_offs_by_reason ?? []).map((r) => [writeOffReasonLabel(r.reason), r.qty, r.loss]),
      [],
      ["Discount reason", "Bills", "Amount"],
      ...(data.discounts_by_reason ?? []).map((r) => [r.reason, r.count, r.amount]),
      [],
      ["Category", "Sales", "Cost", "Profit", "Margin %"],
      ...data.profit_by_category.map((r) => [r.category, r.sales, r.cost, r.profit, r.margin]),
      [],
      ["Top item", "Qty", "Unit", "Amount"],
      ...data.top_items.map((r) => [r.name, r.qty, r.unit, r.amount]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gpos-report-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell
      title="Reports"
      eyebrow="Day-end, P&L and item performance"
      actions={
        <div className="hidden gap-2 sm:flex">
          <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</Button>
          <Button size="sm" onClick={exportCsv} disabled={!data}><Download className="h-4 w-4" />Export</Button>
        </div>
      }
    >
      {loadError && <PageLoadError message={loadError} onRetry={loadReports} />}

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {RANGES.filter((r) => r !== "Custom").map((label) => (
          <button
            key={label}
            onClick={() => setRange(label)}
            className={cn(
              "h-9 rounded-md px-3 text-sm font-bold transition-colors",
              range === label ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "border border-border/80 bg-card text-muted-foreground hover:bg-card-hover hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setRange("Custom")}
          className={cn(
            "flex h-9 items-center gap-2 rounded-md px-3 text-sm font-bold transition-colors",
            range === "Custom" ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "border border-border/80 bg-card text-muted-foreground hover:bg-card-hover hover:text-foreground",
          )}
        >
          <CalendarDays className="h-4 w-4" />Custom
        </button>

        {range === "Custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={customFrom}
              max={customTo}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
            <span className="text-sm text-muted-foreground">se</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={ymd(new Date())}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
          </div>
        )}
      </div>

      {loading && !loadError && (
        <PagePanel className="mb-4 flex items-center justify-center gap-2 p-8 text-sm font-semibold text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Reports load ho rahe hain…
        </PagePanel>
      )}

      {showData && (
      <div className="print-area grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="col-span-full mb-2 hidden print:block">
          <h2 className="text-xl font-black text-foreground">Gondal Traders — Report</h2>
          <p className="text-sm text-muted-foreground">{from} se {to} · {range}</p>
        </div>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Gross sales", data.gross_sales, "Live API"],
              ["Gross profit", data.gross_profit, "Avg cost basis"],
              ["Total discount", data.total_discount ?? 0, `${data.discount_count ?? 0} bill(s)`],
              ["Stock loss", data.total_write_off_loss ?? 0, "Write-offs"],
              ["Net receivable", data.net_receivable, "Khata open"],
            ].map(([label, value, meta]) => {
              const valueTone =
                label === "Stock loss" && Number(value) > 0
                  ? "text-danger"
                  : label === "Total discount" && Number(value) > 0
                    ? "text-warning"
                    : "text-foreground";
              const metaTone =
                label === "Total discount" && Number(value) > 0 ? "text-warning" : "text-primary";

              return (
              <PagePanel key={label} className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className={cn("mt-2 text-2xl font-black tabular-nums", valueTone)}>
                  {formatMoney(Number(value))}
                </p>
                <p className={cn("mt-2 text-xs font-semibold", metaTone)}>
                  {meta}
                </p>
              </PagePanel>
              );
            })}
          </div>

          {(data.total_discount ?? 0) > 0 && (
            <PagePanel>
              <PanelHeader
                title="POS discounts"
                meta="Selected range · reason wise"
                actions={<Tag className="h-4 w-4 text-warning" />}
              />
              <DataTable
                columns={["Reason", "Bills", "Discount amount"]}
                rows={(data.discounts_by_reason ?? []).map((row) => [
                  <span key="reason" className="font-bold text-foreground">{row.reason}</span>,
                  <span key="count" className="tabular-nums text-muted-foreground">{row.count}</span>,
                  <span key="amount" className="font-black tabular-nums text-warning">{formatMoney(row.amount)}</span>,
                ])}
              />
            </PagePanel>
          )}

          {(data.total_write_off_loss ?? 0) > 0 && (
            <PagePanel>
              <PanelHeader
                title="Stock write-offs"
                meta="Expired, damage, gift, theft"
                actions={<AlertTriangle className="h-4 w-4 text-danger" />}
              />
              <DataTable
                columns={["Reason", "Qty removed", "Loss value"]}
                rows={(data.write_offs_by_reason ?? []).map((row) => [
                  <span key="reason" className="font-bold text-foreground">{writeOffReasonLabel(row.reason)}</span>,
                  <span key="qty" className="tabular-nums text-muted-foreground">{row.qty}</span>,
                  <span key="loss" className="font-black tabular-nums text-danger">{formatMoney(row.loss)}</span>,
                ])}
              />
            </PagePanel>
          )}

          <PagePanel>
            <PanelHeader
              title="P&L by category"
              meta="Weighted-average cost basis"
              actions={<FilterChips options={categories} value={category} onChange={setCategory} aria-label="Filter P&L by category" />}
            />
            <DataTable
              columns={["Category", "Sales", "Avg cost", "Gross profit", "Margin"]}
              rows={filteredProfit.map((row) => [
                <span key="category" className="font-bold text-foreground">{row.category}</span>,
                <span key="sales" className="font-bold tabular-nums text-foreground">{formatMoney(row.sales)}</span>,
                <span key="cost" className="tabular-nums text-muted-foreground">{formatMoney(row.cost)}</span>,
                <span key="profit" className="font-bold tabular-nums text-primary">{formatMoney(row.profit)}</span>,
                <StatusPill key="margin" tone="good">{row.margin}%</StatusPill>,
              ])}
            />
          </PagePanel>

          <PagePanel>
            <PanelHeader title="Day-end closing" meta="Expected settlement by payment method" />
            <DataTable
              columns={["Method", "Amount"]}
              rows={(data.payment_breakdown ?? []).map((row) => [
                <span key="method" className="font-bold capitalize text-foreground">{row.method}</span>,
                <span key="amount" className="font-black tabular-nums text-foreground">{formatMoney(row.amount)}</span>,
              ])}
            />
          </PagePanel>
        </div>

        <div className="grid gap-4">
          <PagePanel>
            <PanelHeader title="Top-selling items" meta="By sale amount" actions={<TrendingUp className="h-4 w-4 text-primary" />} />
            <div className="space-y-3 p-4">
              {(data.top_items ?? []).map((item) => {
                const width = `${Math.max(18, totalTopSales ? (item.amount / totalTopSales) * 100 : 18)}%`;
                return (
                  <div key={item.name}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.qty} {item.unit}</p>
                      </div>
                      <p className="font-black tabular-nums text-foreground">{formatMoney(item.amount)}</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width }} />
                    </div>
                  </div>
                );
              })}
              {data.top_items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No sales yet.</p>}
            </div>
          </PagePanel>
        </div>
      </div>
      )}
    </AdminShell>
  );
}
