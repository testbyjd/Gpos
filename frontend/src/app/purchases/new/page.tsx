"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  PackagePlus,
  Plus,
  ScanLine,
  Trash2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatMoney } from "@/lib/utils";
import {
  AdminShell,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";
import {
  ReceiveItemModal,
  type DraftLine,
} from "@/features/vendors/components/ReceiveItemModal";
import { apiFetch } from "@/lib/api";
import { listProducts, listVendors, type ProductRow, type VendorRow } from "@/lib/admin-api";
import type { PurchaseProduct } from "@/features/vendors/data/purchasing";

type ScanTarget = { barcode: string; existing?: PurchaseProduct };

const inputCls =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";

export default function NewPurchasePage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [vendor, setVendor] = useState("");
  const [barcode, setBarcode] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [scan, setScan] = useState<ScanTarget | null>(null);
  const [terms, setTerms] = useState("On account");
  const [toast, setToast] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);

  const subtotal = lines.reduce((s, l) => s + l.qty * l.cost, 0);
  const canPost = vendor !== "" && lines.length > 0;

  useEffect(() => {
    let alive = true;
    Promise.all([listVendors(), listProducts()])
      .then(([vendorRes, productRes]) => {
        if (!alive) return;
        setVendors(vendorRes.data);
        setProducts(productRes.data);
      })
      .catch(() => {
        if (!alive) return;
        setVendors([]);
        setProducts([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  function toPurchaseProduct(product: ProductRow): PurchaseProduct {
    return {
      barcode: product.barcode ?? "",
      name: product.name,
      category: product.category ?? "Uncategorized",
      unit: product.unit as PurchaseProduct["unit"],
      avgCost: Number(product.avg_cost),
      lastCost: Number(product.avg_cost),
      stock: Number(product.stock_qty),
      sellPrice: Number(product.sell_price),
    };
  }

  function handleScan(code: string) {
    const trimmed = code.trim();
    if (!vendor || !trimmed) return;
    const existing = products.find((product) => product.barcode === trimmed);
    setScan({ barcode: trimmed, existing: existing ? toPurchaseProduct(existing) : undefined });
    setBarcode("");
  }

  function addLine(line: Omit<DraftLine, "id">) {
    setLines((prev) => [...prev, { ...line, id: crypto.randomUUID() }]);
    setScan(null);
    setTimeout(() => barcodeRef.current?.focus(), 0);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function postPurchase() {
    if (!canPost || posting) return;
    setPosting(true);
    try {
      await apiFetch("/purchases", {
        method: "POST",
        body: JSON.stringify({
          vendor_id: Number(vendor),
          payment_terms: terms.toLowerCase().replaceAll(" ", "_"),
          paid_amount: 0,
          lines: lines.map((line) => {
            const existing = products.find((product) => product.barcode && product.barcode === line.barcode);
            return {
              product_id: existing?.id,
              barcode: line.barcode || undefined,
              name: line.name,
              unit: line.unit,
              qty: line.qty,
              unit_cost: line.cost,
              sell_price: line.sellPrice,
              expiry_date: line.expiry,
              promotion: line.promo,
            };
          }),
        }),
      });
      setToast(`Purchase posted · ${formatMoney(subtotal)}`);
      setLines([]);
      router.push("/purchases");
    } catch {
      setToast("Purchase post nahi hui. Backend/API check karo.");
    } finally {
      setPosting(false);
      setTimeout(() => setToast(null), 2600);
    }
  }

  return (
    <AdminShell
      title="New Purchase"
      eyebrow="Goods received (GRN)"
      actions={
        <Link
          href="/purchases"
          className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      }
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4">
          {/* Step 1: vendor + barcode */}
          <PagePanel className="p-4">
            <div className="grid gap-3 sm:grid-cols-[260px_1fr]">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <Truck className="h-3.5 w-3.5" />
                  Vendor
                </span>
                <select
                  value={vendor}
                  onChange={(e) => {
                    setVendor(e.target.value);
                    setTimeout(() => barcodeRef.current?.focus(), 0);
                  }}
                  className={inputCls}
                >
                  <option value="">Select vendor…</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <ScanLine className="h-3.5 w-3.5" />
                  Scan / enter barcode
                </span>
                <div className="relative">
                  <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={barcodeRef}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleScan(e.currentTarget.value);
                    }}
                    disabled={!vendor}
                    placeholder={vendor ? "Scan barcode and it opens automatically…" : "Select a vendor first"}
                    className={cn(inputCls, "pl-9 disabled:cursor-not-allowed disabled:opacity-60")}
                  />
                </div>
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
              <p className="text-xs text-muted-foreground">
                Scan a packaged item, or add loose / unbarcoded goods manually.
              </p>
              <Button
                variant="secondary"
                size="sm"
                disabled={!vendor}
                onClick={() => setScan({ barcode: "", existing: undefined })}
              >
                <Plus className="h-4 w-4" />
                Add manually
              </Button>
            </div>
          </PagePanel>

          {/* Lines */}
          <PagePanel>
            <PanelHeader
              title="Received items"
              meta={lines.length ? `${lines.length} line${lines.length > 1 ? "s" : ""}` : "Nothing scanned yet"}
            />
            {lines.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-muted-foreground">
                <ScanLine className="h-10 w-10 opacity-30" />
                <p className="text-sm font-semibold">Scan a barcode to start receiving</p>
                <p className="text-xs">Existing products prefill last price; new ones can be created on the spot.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="bg-muted/70 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3">Cost</th>
                      <th className="px-4 py-3">Line total</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70">
                    {lines.map((l) => (
                      <tr key={l.id} className="hover:bg-card-hover">
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-foreground">{l.name}</span>
                            {l.isNew && <StatusPill tone="info">New</StatusPill>}
                            {l.promo && <StatusPill tone="warn">Promo {formatMoney(l.promo.price)}</StatusPill>}
                            {l.expiry && <StatusPill tone="neutral">Exp {l.expiry}</StatusPill>}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {l.barcode || "no barcode"} · {l.category}
                            {l.newAvg !== undefined && ` · new avg ${formatMoney(l.newAvg)}`}
                          </p>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-foreground">{l.qty} {l.unit}</td>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatMoney(l.cost)}</td>
                        <td className="px-4 py-3 font-black tabular-nums text-foreground">{formatMoney(l.qty * l.cost)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => removeLine(l.id)}
                            aria-label={`Remove ${l.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PagePanel>
        </div>

        {/* Summary */}
        <div className="grid content-start gap-4">
          <PagePanel className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <PackagePlus className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-black text-foreground">{vendors.find((v) => String(v.id) === vendor)?.name || "No vendor selected"}</p>
                <p className="text-xs text-muted-foreground">{lines.length} items received</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 border-t border-border/70 pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span className="font-bold tabular-nums text-foreground">{lines.length}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-semibold text-foreground">Subtotal</span>
                <span className="text-2xl font-black tabular-nums text-primary">{formatMoney(subtotal)}</span>
              </div>
            </div>
          </PagePanel>

          <PagePanel className="p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Payment terms
              </span>
              <select value={terms} onChange={(e) => setTerms(e.target.value)} className={inputCls}>
                <option>On account</option>
                <option>Pay now (cash)</option>
                <option>Bank transfer</option>
              </select>
            </label>
            <Button size="lg" className="mt-4 w-full" disabled={!canPost || posting} onClick={postPurchase}>
              <CheckCircle2 className="h-5 w-5" />
              {posting ? "Posting..." : "Post purchase"}
            </Button>
            {!canPost && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {vendor ? "Add at least one item" : "Select a vendor and scan items"}
              </p>
            )}
          </PagePanel>
        </div>
      </div>

      {scan && (
        <ReceiveItemModal
          barcode={scan.barcode}
          existing={scan.existing}
          onAdd={addLine}
          onClose={() => setScan(null)}
        />
      )}

      {toast && (
        <div className="animate-fade-in fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-success/30 bg-success px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          <CheckCircle2 className="h-5 w-5" />
          {toast}
        </div>
      )}
    </AdminShell>
  );
}
