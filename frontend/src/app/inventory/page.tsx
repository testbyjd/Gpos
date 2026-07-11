"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Download, Loader2, MinusCircle, Pencil, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChips } from "@/components/ui/filter-chips";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/api";
import {
  listCategories,
  listProducts,
  type CategoryRow,
  type ProductRow,
  type ProductsListResponse,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { CategoryFormModal } from "@/features/admin/components/AdminActionModals";
import { ProductFormModal } from "@/features/admin/components/ProductFormModal";
import { WriteOffModal } from "@/features/inventory/components/WriteOffModal";
import {
  AdminShell,
  DataTable,
  PageLoadError,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";

const PER_PAGE = 100;

function exportProductsCsv(rows: ProductRow[]) {
  const header = ["Name", "SKU", "Barcode", "Category", "Unit", "Stock", "Avg cost", "Sell price"];
  const body = rows.map((p) => [
    p.name,
    p.sku ?? `P-${p.id}`,
    p.barcode ?? "",
    p.category ?? "",
    p.unit,
    Number(p.stock_qty),
    Number(p.avg_cost),
    Number(p.sell_price),
  ]);
  const csv = [header, ...body].map((row) => row.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gpos-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATES = ["All", "OK", "Low", "Expiring"] as const;
const SOON_DAYS = 30;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function expiryPill(expiry: string | null) {
  if (!expiry) return <span className="text-muted-foreground">—</span>;
  const days = daysUntil(expiry);
  if (days === null) return <span className="text-muted-foreground">—</span>;
  if (days < 0) return <StatusPill tone="danger">Expired</StatusPill>;
  if (days <= SOON_DAYS) return <StatusPill tone="warn">{days}d left</StatusPill>;
  return <span className="text-muted-foreground">{new Date(expiry).toLocaleDateString("en-PK")}</span>;
}

type InventorySummary = NonNullable<ProductsListResponse["summary"]>;

async function rollupInventorySummary(lastPage: number): Promise<InventorySummary> {
  const pages = await Promise.all(
    Array.from({ length: lastPage }, (_, i) => listProducts({ page: i + 1, perPage: PER_PAGE })),
  );
  const all = pages.flatMap((p) => p.data);
  let inventoryValue = 0;
  let lowStock = 0;
  let expiringSoon = 0;
  for (const p of all) {
    inventoryValue += Number(p.stock_qty) * Number(p.avg_cost ?? 0);
    if (Number(p.stock_qty) <= Number(p.low_stock_threshold)) lowStock++;
    const days = daysUntil(p.expiry_date);
    if (days !== null && days <= SOON_DAYS) expiringSoon++;
  }
  return {
    total: pages[0]?.meta.total ?? all.length,
    low_stock: lowStock,
    expiring_soon: expiringSoon,
    inventory_value: inventoryValue,
  };
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [state, setState] = useState<(typeof STATES)[number]>("All");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, per_page: PER_PAGE, total: 0 });
  const [summary, setSummary] = useState({
    total: 0,
    low_stock: 0,
    expiring_soon: 0,
    inventory_value: 0,
  });
  const [expiringSoon, setExpiringSoon] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useAppToast();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [formProduct, setFormProduct] = useState<ProductRow | null | "new">(null);
  const [writeOffProduct, setWriteOffProduct] = useState<ProductRow | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);

  const categoryId = useMemo(() => {
    if (category === "All") return undefined;
    return categories.find((c) => c.name === category)?.id;
  }, [category, categories]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, state, category]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await listProducts({ page: 1, perPage: 1 });
      if (res.summary) {
        setSummary(res.summary);
        return;
      }
      if (res.meta.total > 0) {
        setSummary((prev) => ({ ...prev, total: res.meta.total }));
        const rolled = await rollupInventorySummary(res.meta.last_page);
        setSummary(rolled);
      }
    } catch {
      /* sidebar stats optional */
    }
  }, []);

  const loadProducts = useCallback(() => {
    setLoading(true);
    return listProducts({
      page,
      perPage: PER_PAGE,
      q: searchDebounced || undefined,
      categoryId,
      lowStock: state === "Low" ? true : undefined,
      stockOk: state === "OK" ? true : undefined,
      expiringWithin: state === "Expiring" ? SOON_DAYS : undefined,
    })
      .then((res) => {
        setProducts(res.data);
        setMeta(res.meta);
        if (res.summary) {
          setSummary(res.summary);
        } else {
          setSummary((prev) => ({
            ...prev,
            total: res.meta.total,
          }));
        }
        setLoadError(null);
      })
      .catch((err) => {
        setProducts([]);
        setLoadError(getErrorMessage(err, "Products load nahi hue. Server check karo."));
      })
      .finally(() => setLoading(false));
  }, [page, searchDebounced, categoryId, state]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    listCategories()
      .then((res) => setCategories(res.data))
      .catch((err) => setLoadError(getErrorMessage(err, "Categories load nahi hui. Server check karo.")));
  }, []);

  useEffect(() => {
    listProducts({ expiringWithin: SOON_DAYS, perPage: 8, page: 1 })
      .then((res) => setExpiringSoon(res.data))
      .catch(() => setExpiringSoon([]));
  }, []);

  function handleCategorySaved(cat: CategoryRow) {
    setCategories((prev) => [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)));
    showToast(`"${cat.name}" category add ho gayi.`, "success");
  }

  function handleSaved(product: ProductRow) {
    loadProducts();
    loadSummary();
    showToast(formProduct === "new" ? `"${product.name}" add ho gaya.` : `"${product.name}" update ho gaya.`, "success");
    setFormProduct(null);
  }

  function handleWriteOffSaved(product: ProductRow, lossValue: number) {
    loadProducts();
    loadSummary();
    showToast(`"${product.name}" write-off — loss ${formatMoney(lossValue)}`, "success");
    setWriteOffProduct(null);
  }

  const filterCategories = useMemo(
    () => ["All", ...categories.map((c) => c.name)],
    [categories],
  );

  return (
    <AdminShell
      title="Inventory"
      eyebrow="Products, stock and costing"
      actions={
        <div className="hidden gap-2 sm:flex">
          <Button variant="secondary" size="sm" disabled title="Import agle update mein aayega">
            <Upload className="h-4 w-4" />Import (soon)
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowAddCategory(true)}><Plus className="h-4 w-4" />Category</Button>
          <Button size="sm" onClick={() => setFormProduct("new")}><Plus className="h-4 w-4" />Product</Button>
        </div>
      }
    >
      {loadError ? (
        <PageLoadError message={loadError} onRetry={loadProducts} />
      ) : (
      <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PagePanel>
          <PanelHeader
            title="Product master"
            meta={`Page ${meta.current_page} of ${meta.last_page} · ${meta.total} products · ${PER_PAGE}/page`}
          />
          <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3">
            <SearchInput
              label="Search SKU, barcode, product"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-60"
              containerClassName="w-full sm:w-auto"
            />
            <FilterChips
              options={STATES}
              value={state}
              onChange={(v) => setState(v)}
              aria-label="Filter by stock or expiry"
            />
            <div className="ml-auto">
              <FilterChips
                options={filterCategories}
                value={category}
                onChange={setCategory}
                aria-label="Filter by category"
              />
            </div>
          </div>
          <div className="flex gap-2 border-b border-border/80 px-4 pb-3 sm:hidden">
            <Button className="flex-1" size="sm" onClick={() => setFormProduct("new")}>
              <Plus className="h-4 w-4" />Add product
            </Button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-10 text-sm font-semibold text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Products load ho rahe hain…
            </div>
          ) : (
            <>
              <DataTable
                columns={["Product", "SKU", "Category", "Stock", "Avg cost", "Price", "Expiry", "Vendor", "State", ""]}
                minWidth="1040px"
                emptyLabel="Is filter pe koi product nahi."
                rows={products.map((p) => {
                  const isLow = Number(p.stock_qty) <= Number(p.low_stock_threshold);
                  return [
                    <div key="product" className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-muted text-lg">
                        {p.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={resolveAssetUrl(p.image_url)} alt="" className="h-full w-full object-cover" />
                        ) : (
                          "📦"
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-foreground">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.barcode ?? "No barcode"}</div>
                      </div>
                    </div>,
                    <span key="sku" className="font-mono text-xs text-muted-foreground">{p.sku ?? `P-${p.id}`}</span>,
                    p.category ?? "Uncategorized",
                    <span key="stock" className="font-bold tabular-nums text-foreground">{Number(p.stock_qty)} {p.unit}</span>,
                    <span key="cost" className="tabular-nums text-muted-foreground">{formatMoney(Number(p.avg_cost))}</span>,
                    <span key="price" className="font-bold tabular-nums text-primary">{formatMoney(Number(p.sell_price))}</span>,
                    <span key="expiry">{expiryPill(p.expiry_date)}</span>,
                    <span key="vendor" className="max-w-[140px] truncate text-sm text-muted-foreground" title={p.vendor_name ?? undefined}>
                      {p.vendor_name?.trim() || "—"}
                    </span>,
                    <StatusPill key="statepill" tone={isLow ? "warn" : "good"}>{isLow ? "Low" : "OK"}</StatusPill>,
                    <div key="actions" className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setWriteOffProduct(p)}
                        aria-label={`Write off ${p.name}`}
                        title="Write-off (expire / gift / damage)"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <MinusCircle className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormProduct(p)}
                        aria-label={`Edit ${p.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>,
                  ];
                })}
              />
              <PaginationBar
                page={meta.current_page}
                lastPage={meta.last_page}
                total={meta.total}
                perPage={meta.per_page}
                onPageChange={setPage}
              />
            </>
          )}
        </PagePanel>

        <div className="grid content-start gap-4 self-start">
          <StatCard label="Inventory value" value={formatMoney(summary.inventory_value)} className="!p-3">
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Products</div><div className="mt-1 font-black text-foreground">{summary.total}</div></div>
              <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Low stock</div><div className="mt-1 font-black text-warning">{summary.low_stock}</div></div>
              <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Expiring</div><div className="mt-1 font-black text-danger">{summary.expiring_soon}</div></div>
            </div>
          </StatCard>

          <PagePanel>
            <PanelHeader title="Expiring soon" meta={`Within ${SOON_DAYS} days`} actions={<CalendarClock className="h-4 w-4 text-warning" />} />
            <div className="divide-y divide-border/70">
              {expiringSoon.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.expiry_date}</p>
                  </div>
                  {expiryPill(p.expiry_date)}
                </div>
              ))}
              {expiringSoon.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing expiring soon.</p>}
            </div>
          </PagePanel>

          <PagePanel className="p-4">
            <Button className="w-full" onClick={() => exportProductsCsv(products)} disabled={products.length === 0}>
              <Download className="h-4 w-4" />Export this page (CSV)
            </Button>
          </PagePanel>
        </div>
      </div>
      </>
      )}

      <AppToast toast={toast} onDismiss={hideToast} />
      {formProduct !== null && (
        <ProductFormModal
          product={formProduct === "new" ? null : formProduct}
          categories={categories}
          onClose={() => setFormProduct(null)}
          onSaved={handleSaved}
          onCategoryAdded={handleCategorySaved}
        />
      )}

      {writeOffProduct && (
        <WriteOffModal
          product={writeOffProduct}
          onClose={() => setWriteOffProduct(null)}
          onSaved={handleWriteOffSaved}
        />
      )}

      {showAddCategory && (
        <CategoryFormModal
          onClose={() => setShowAddCategory(false)}
          onSaved={handleCategorySaved}
        />
      )}
    </AdminShell>
  );
}
