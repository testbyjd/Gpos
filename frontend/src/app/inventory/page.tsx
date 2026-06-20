"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChips } from "@/components/ui/filter-chips";
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney } from "@/lib/utils";
import { deleteProduct, listCategories, listProducts, type CategoryRow, type ProductRow } from "@/lib/admin-api";
import { CategoryFormModal } from "@/features/admin/components/AdminActionModals";
import { ProductFormModal } from "@/features/admin/components/ProductFormModal";
import {
  AdminShell,
  DataTable,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";

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

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<(typeof STATES)[number]>("All");
  const [category, setCategory] = useState("All");
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [formProduct, setFormProduct] = useState<ProductRow | null | "new">(null);
  const [showAddCategory, setShowAddCategory] = useState(false);

  const loadProducts = useCallback(() => {
    listProducts()
      .then((res) => setProducts(res.data))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    loadProducts();
    listCategories()
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]));
  }, [loadProducts]);

  function handleCategorySaved(category: CategoryRow) {
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
    setNotice(`"${category.name}" category add ho gayi.`);
  }

  function handleSaved(product: ProductRow) {
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx === -1) return [...prev, product].sort((a, b) => a.name.localeCompare(b.name));
      return prev.map((p) => (p.id === product.id ? product : p));
    });
    setNotice(formProduct === "new" ? `"${product.name}" add ho gaya.` : `"${product.name}" update ho gaya.`);
    setFormProduct(null);
  }

  async function handleDelete(product: ProductRow) {
    const usedHint = "Agar ye product kahin use ho chuka hai to sirf inactive hoga.";
    if (!window.confirm(`"${product.name}" delete karna hai?\n\n${usedHint}`)) return;

    setDeletingId(product.id);
    setNotice(null);
    try {
      const res = await deleteProduct(product.id);
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setNotice(res.message);
    } catch {
      setNotice("Delete failed. Try again.");
    } finally {
      setDeletingId(null);
    }
  }

  const filterCategories = useMemo(
    () => ["All", ...categories.map((c) => c.name)],
    [categories],
  );
  const expiringSoon = useMemo(
    () => products.filter((p) => {
      const days = daysUntil(p.expiry_date);
      return days !== null && days <= SOON_DAYS;
    }).sort((a, b) => (daysUntil(a.expiry_date) ?? 9999) - (daysUntil(b.expiry_date) ?? 9999)),
    [products],
  );
  const lowStock = products.filter((p) => Number(p.stock_qty) <= Number(p.low_stock_threshold)).length;
  const inventoryValue = products.reduce((sum, p) => sum + Number(p.stock_qty) * Number(p.avg_cost), 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      const pCategory = p.category ?? "Uncategorized";
      const isLow = Number(p.stock_qty) <= Number(p.low_stock_threshold);
      const days = daysUntil(p.expiry_date);
      if (state === "Low" && !isLow) return false;
      if (state === "OK" && isLow) return false;
      if (state === "Expiring" && (days === null || days > SOON_DAYS)) return false;
      if (category !== "All" && pCategory !== category) return false;
      if (q && ![p.name, p.sku ?? "", p.barcode ?? "", pCategory].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [products, search, state, category]);

  return (
    <AdminShell
      title="Inventory"
      eyebrow="Products, stock and costing"
      actions={
        <div className="hidden gap-2 sm:flex">
          <Button variant="secondary" size="sm" onClick={() => setNotice("CSV import agle update mein aayega.")}><Upload className="h-4 w-4" />Import</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowAddCategory(true)}><Plus className="h-4 w-4" />Category</Button>
          <Button size="sm" onClick={() => setFormProduct("new")}><Plus className="h-4 w-4" />Product</Button>
        </div>
      }
    >
      {notice && (
        <div className="mb-4 rounded-lg border border-border/80 bg-muted/60 px-4 py-3 text-sm font-semibold text-foreground">
          {notice}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PagePanel>
          <PanelHeader title="Product master" meta={`${filtered.length} of ${products.length} products · live API`} />
          <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3">
            <SearchInput label="Search SKU, barcode, product" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-60" containerClassName="w-full sm:w-auto" />
            <FilterChips options={STATES} value={state} onChange={setState} aria-label="Filter by stock or expiry" />
            <div className="ml-auto"><FilterChips options={filterCategories} value={category} onChange={setCategory} aria-label="Filter by category" /></div>
          </div>
          <div className="flex gap-2 border-b border-border/80 px-4 pb-3 sm:hidden">
            <Button className="flex-1" size="sm" onClick={() => setFormProduct("new")}>
              <Plus className="h-4 w-4" />Add product
            </Button>
          </div>
          <DataTable
            columns={["Product", "SKU", "Category", "Stock", "Avg cost", "Price", "Expiry", "State", ""]}
            minWidth="960px"
            rows={filtered.map((p) => {
              const isLow = Number(p.stock_qty) <= Number(p.low_stock_threshold);
              return [
                <div key="product"><div className="font-bold text-foreground">{p.name}</div><div className="text-xs text-muted-foreground">{p.barcode ?? "No barcode"}</div></div>,
                <span key="sku" className="font-mono text-xs text-muted-foreground">{p.sku ?? `P-${p.id}`}</span>,
                p.category ?? "Uncategorized",
                <span key="stock" className="font-bold tabular-nums text-foreground">{Number(p.stock_qty)} {p.unit}</span>,
                <span key="cost" className="tabular-nums text-muted-foreground">{formatMoney(Number(p.avg_cost))}</span>,
                <span key="price" className="font-bold tabular-nums text-primary">{formatMoney(Number(p.sell_price))}</span>,
                <span key="expiry">{expiryPill(p.expiry_date)}</span>,
                <StatusPill key="state" tone={isLow ? "warn" : "good"}>{isLow ? "Low" : "OK"}</StatusPill>,
                <div key="actions" className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setFormProduct(p)}
                    aria-label={`Edit ${p.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    aria-label={`Delete ${p.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>,
              ];
            })}
          />
        </PagePanel>

        <div className="grid gap-4">
          <StatCard label="Inventory value" value={formatMoney(inventoryValue)}>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Products</div><div className="mt-1 font-black text-foreground">{products.length}</div></div>
              <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Low stock</div><div className="mt-1 font-black text-warning">{lowStock}</div></div>
              <div className="rounded-md bg-muted p-3"><div className="text-xs text-muted-foreground">Expiring</div><div className="mt-1 font-black text-danger">{expiringSoon.length}</div></div>
            </div>
          </StatCard>

          <PagePanel>
            <PanelHeader title="Expiring soon" meta={`Within ${SOON_DAYS} days`} actions={<CalendarClock className="h-4 w-4 text-warning" />} />
            <div className="divide-y divide-border/70">
              {expiringSoon.map((p) => <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.expiry_date}</p></div>{expiryPill(p.expiry_date)}</div>)}
              {expiringSoon.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing expiring soon.</p>}
            </div>
          </PagePanel>

          <PagePanel className="p-4"><Button className="w-full"><Download className="h-4 w-4" />Export stock sheet</Button></PagePanel>
        </div>
      </div>

      {formProduct !== null && (
        <ProductFormModal
          product={formProduct === "new" ? null : formProduct}
          categories={categories}
          onClose={() => setFormProduct(null)}
          onSaved={handleSaved}
          onCategoryAdded={handleCategorySaved}
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
