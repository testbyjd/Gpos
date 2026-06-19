"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Barcode, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import {
  createProduct,
  updateProduct,
  type CategoryRow,
  type ProductInput,
  type ProductRow,
} from "@/lib/admin-api";

const UNITS = ["pcs", "kg", "g", "litre", "dozen", "pack"] as const;

const inputCls =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
const labelCls =
  "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

interface Props {
  product: ProductRow | null;
  categories: CategoryRow[];
  onClose: () => void;
  onSaved: (product: ProductRow) => void;
}

export function ProductFormModal({ product, categories, onClose, onSaved }: Props) {
  useModalDismiss(onClose);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const isEdit = product !== null;

  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ? String(product.category_id) : "");
  const [unit, setUnit] = useState(product?.unit ?? "pcs");
  const [sellPrice, setSellPrice] = useState(product ? String(product.sell_price) : "");
  const [avgCost, setAvgCost] = useState(product ? String(product.avg_cost) : "0");
  const [stockQty, setStockQty] = useState(product ? String(product.stock_qty) : "0");
  const [lowStock, setLowStock] = useState(product ? String(product.low_stock_threshold) : "0");
  const [expiryDate, setExpiryDate] = useState(product?.expiry_date ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  function buildPayload(): ProductInput {
    return {
      name: name.trim(),
      barcode: barcode.trim() || null,
      sku: sku.trim() || null,
      category_id: categoryId ? Number(categoryId) : null,
      unit,
      sell_price: Number(sellPrice),
      avg_cost: Number(avgCost) || 0,
      stock_qty: Number(stockQty) || 0,
      low_stock_threshold: Number(lowStock) || 0,
      expiry_date: expiryDate || null,
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Product name zaroori hai.");
      return;
    }
    if (!sellPrice || Number(sellPrice) <= 0) {
      setError("Sell price 0 se zyada honi chahiye.");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      const res = isEdit
        ? await updateProduct(product.id, payload)
        : await createProduct(payload);
      onSaved(res.data);
      onClose();
    } catch {
      setError("Save failed. Barcode duplicate ho sakta hai — dobara check karo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4 py-8 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center">
          <form
            onSubmit={onSubmit}
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border/80 bg-card p-5 shadow-xl"
          >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-foreground">
              {isEdit ? "Edit product" : "Add product"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Barcode manually type karo ya scanner se scan karo
            </p>
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

        <div className="space-y-3">
          <label className="block">
            <span className={labelCls}>
              <Barcode className="mr-1 inline h-3.5 w-3.5" />
              Barcode (manual / scan)
            </span>
            <input
              ref={barcodeRef}
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="8964000123456"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className={labelCls}>Product name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={inputCls}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>SKU</span>
              <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className={labelCls}>Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Unit</span>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Sell price (Rs)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                required
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Avg cost (Rs)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Opening stock</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelCls}>Low stock alert</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={lowStock}
                onChange={(e) => setLowStock(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Expiry date</span>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add product"}
          </Button>
        </div>
      </form>
        </div>
      </div>
    </ModalPortal>
  );
}
