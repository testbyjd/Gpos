"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Download, Printer, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/ui/filter-chips";
import { cn, formatMoney } from "@/lib/utils";
import { getReports } from "@/lib/admin-api";
import {
  AdminShell,
  DataTable,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";

const RANGES = ["Today", "Yesterday", "This week", "This month"] as const;
type ReportsData = Awaited<ReturnType<typeof getReports>>;

export default function ReportsPage() {
  const [range, setRange] = useState<(typeof RANGES)[number]>("Today");
  const [category, setCategory] = useState("All");
  const [data, setData] = useState<ReportsData | null>(null);

  useEffect(() => {
    let alive = true;
    getReports().then((res) => alive && setData(res)).catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, [range]);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set((data?.profit_by_category ?? []).map((r) => r.category)))],
    [data],
  );
  const filteredProfit = useMemo(
    () => (category === "All" ? data?.profit_by_category ?? [] : (data?.profit_by_category ?? []).filter((r) => r.category === category)),
    [category, data],
  );
  const totalTopSales = (data?.top_items ?? []).reduce((sum, item) => sum + item.amount, 0);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Report", range],
      ["Gross sales", data.gross_sales],
      ["Gross profit", data.gross_profit],
      ["Net receivable", data.net_receivable],
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
    a.download = `gpos-report-${range.toLowerCase().replace(/\s+/g, "-")}.csv`;
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
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((label) => (
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
        <button className="flex h-9 items-center gap-2 rounded-md border border-border/80 bg-card px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground">
          <CalendarDays className="h-4 w-4" />Custom
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Gross sales", data?.gross_sales ?? 0, "Live API"],
              ["Gross profit", data?.gross_profit ?? 0, "Avg cost basis"],
              ["Net receivable", data?.net_receivable ?? 0, "Khata open"],
            ].map(([label, value, meta]) => (
              <PagePanel key={label} className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-black tabular-nums text-foreground">{formatMoney(Number(value))}</p>
                <p className="mt-2 text-xs font-semibold text-primary">{meta}</p>
              </PagePanel>
            ))}
          </div>

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
              rows={(data?.payment_breakdown ?? []).map((row) => [
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
              {(data?.top_items ?? []).map((item) => {
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
              {data?.top_items.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No sales yet.</p>}
            </div>
          </PagePanel>
        </div>
      </div>
    </AdminShell>
  );
}
