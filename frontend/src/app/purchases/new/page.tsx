"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  PackagePlus,
  Plus,
  ScanLine,
  Trash2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { cn, formatMoney } from "@/lib/utils";
import {
  AdminShell,
  PageAlert,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";
import {
  ReceiveItemModal,
  type DraftLine,
} from "@/features/vendors/components/ReceiveItemModal";
import { apiFetch, getErrorMessage } from "@/lib/api";
import {
  appendPurchaseLines,
  getPurchase,
  listCategories,
  listProducts,
  listVendors,
  type CategoryRow,
  type ProductRow,
  type PurchaseRow,
  type VendorRow,
} from "@/lib/admin-api";
import type { PurchaseProduct } from "@/features/vendors/data/purchasing";
import {
  PURCHASE_PAYMENT_TERMS,
  clampPaidAmount,
  purchaseTermLabel,
  type PurchasePaymentTerm,
} from "@/features/vendors/data/payment-terms";

type ScanTarget = { barcode: string; existing?: PurchaseProduct };

const inputCls =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";

export default function NewPurchasePage() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [vendor, setVendor] = useState("");
  const [barcode, setBarcode] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [scan, setScan] = useState<ScanTarget | null>(null);
  const [terms, setTerms] = useState<PurchasePaymentTerm>("on_account");
  const [paidInput, setPaidInput] = useState("0");
  const [keepGrnOpen, setKeepGrnOpen] = useState(false);
  const [extendPurchase, setExtendPurchase] = useState<PurchaseRow | null>(null);
  const [extendLoading, setExtendLoading] = useState(false);
  const { toast, showToast, hideToast } = useAppToast();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const postClientId = useRef<string | null>(null);

  const subtotal = lines.reduce((s, l) => s + l.qty * l.cost, 0);
  const paidAmount = clampPaidAmount(subtotal, paidInput);
  const balanceDue = Math.max(0, subtotal - paidAmount);
  const canPost = vendor !== "" && lines.length > 0 && paidAmount <= subtotal;
  const hasDraft = lines.length > 0;
  const isExtend = extendPurchase !== null;

  useEffect(() => {
    const option = PURCHASE_PAYMENT_TERMS.find((t) => t.value === terms);
    if (option?.payFull) {
      setPaidInput(subtotal > 0 ? String(subtotal) : "0");
    }
  }, [terms, subtotal]);

  useEffect(() => {
    if (!hasDraft) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasDraft]);

  function confirmLeave(): boolean {
    if (!hasDraft) return true;
    return window.confirm(
      "Draft abhi save nahi hui — sirf list mein hai.\n\nBahar jao ge to items kho jayenge. Post purchase pehle karein ya Cancel karein.",
    );
  }

  function handleBackClick(e: MouseEvent<HTMLAnchorElement>) {
    if (!confirmLeave()) e.preventDefault();
  }

  useEffect(() => {
    let alive = true;
    Promise.all([listVendors(), listProducts(), listCategories()])
      .then(([vendorRes, productRes, categoryRes]) => {
        if (!alive) return;
        setVendors(vendorRes.data);
        setProducts(productRes.data);
        setCategories(categoryRes.data);
      })
      .catch((err) => {
        if (!alive) return;
        setVendors([]);
        setProducts([]);
        setCategories([]);
        setLoadError(getErrorMessage(err, "Vendors/products load nahi hue. Server check karo."));
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const extendId = new URLSearchParams(window.location.search).get("extend");
    if (!extendId) return;

    setExtendLoading(true);
    getPurchase(Number(extendId))
      .then((res) => {
        const purchase = res.data;
        if (purchase.receiving_status !== "open") {
          setLoadError(`${purchase.grn_no} band hai — aur items add nahi ho sakte.`);
          return;
        }
        setExtendPurchase(purchase);
        if (purchase.vendor?.id) {
          setVendor(String(purchase.vendor.id));
        }
      })
      .catch((err) => {
        setLoadError(getErrorMessage(err, "GRN load nahi hui — extend nahi ho sakta."));
      })
      .finally(() => setExtendLoading(false));
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
    showToast(`"${line.name}" list mein add ho gaya — Post purchase dabao.`, "info");
    setTimeout(() => barcodeRef.current?.focus(), 0);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  async function postPurchase() {
    if (!canPost || posting) return;
    if (!isExtend && !postClientId.current) {
      postClientId.current = crypto.randomUUID();
    }
    setPosting(true);
    const linePayload = lines.map((line) => {
      const existing = products.find((product) => product.barcode && product.barcode === line.barcode);
      return {
        product_id: existing?.id,
        barcode: line.barcode || undefined,
        name: line.name,
        category_id: existing ? undefined : line.category_id ?? null,
        unit: line.unit,
        qty: line.qty,
        unit_cost: line.cost,
        sell_price: line.sellPrice,
        expiry_date: line.expiry,
        promotion: line.promo,
      };
    });
    try {
      if (isExtend && extendPurchase) {
        await appendPurchaseLines(extendPurchase.id, {
          paid_amount: paidAmount,
          lines: linePayload,
        });
        showToast(`${extendPurchase.grn_no} mein aur items add ho gaye · ${formatMoney(subtotal)}`, "success");
      } else {
        await apiFetch("/purchases", {
          method: "POST",
          body: JSON.stringify({
            client_id: postClientId.current,
            vendor_id: Number(vendor),
            payment_terms: terms,
            paid_amount: paidAmount,
            receiving_open: keepGrnOpen,
            lines: linePayload,
          }),
        });
        const termNote = paidAmount > 0 ? " · paid" : " · on account";
        const openNote = keepGrnOpen ? " · GRN open" : "";
        showToast(`Purchase posted · ${formatMoney(subtotal)}${termNote}${openNote}`, "success");
        postClientId.current = null;
      }
      setLines([]);
      window.setTimeout(() => router.push("/purchases?posted=1"), 900);
    } catch (err) {
      showToast(getErrorMessage(err, isExtend ? "GRN extend nahi hui." : "Purchase post nahi hui. Backend/API check karo."), "error");
    } finally {
      setPosting(false);
    }
  }

  return (
    <AdminShell
      title={isExtend ? `Extend ${extendPurchase?.grn_no ?? "GRN"}` : "New Purchase"}
      eyebrow={isExtend ? "Add more items to same GRN" : "Goods received (GRN)"}
      actions={
        <Link
          href="/purchases"
          onClick={handleBackClick}
          className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      }
    >
      {loadError && <PageAlert message={loadError} tone="error" />}
      {extendLoading && (
        <PageAlert message="GRN load ho rahi hai…" tone="info" />
      )}
      {isExtend && extendPurchase && !loadError && (
        <PageAlert
          message={`${extendPurchase.grn_no} — pehle se ${extendPurchase.lines.length} line(s), total ${formatMoney(Number(extendPurchase.subtotal))}. Naye items yahan add karo.`}
          tone="info"
        />
      )}
      {hasDraft && !loadError && (
        <PageAlert
          message={isExtend ? "Naye items list mein hain — Add to GRN dabao." : "Draft list mein hai — stock tab tak update nahi hoga jab tak Post purchase na dabao."}
          tone="info"
        />
      )}
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
                  disabled={isExtend}
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
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid now</span>
                <span className="font-bold tabular-nums text-success">{formatMoney(paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance due</span>
                <span className={cn("font-bold tabular-nums", balanceDue > 0 ? "text-warning" : "text-success")}>
                  {formatMoney(balanceDue)}
                </span>
              </div>
            </div>
          </PagePanel>

          <PagePanel className="p-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Payment terms
              </span>
              <select
                value={terms}
                onChange={(e) => setTerms(e.target.value as PurchasePaymentTerm)}
                className={inputCls}
              >
                {PURCHASE_PAYMENT_TERMS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Paid now (Rs)
              </span>
              <input
                type="number"
                min={0}
                max={subtotal}
                step="0.01"
                value={paidInput}
                onChange={(e) => setPaidInput(e.target.value)}
                className={inputCls}
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              {terms === "on_account"
                ? isExtend
                  ? "Is batch ka jo abhi pay kiya us ki amount likho — GRN total update hoga."
                  : "Jitna abhi diya us ki amount likho — baqi vendor balance (udhar) mein jayega."
                : `${purchaseTermLabel(terms)} — default poora amount paid; kam zyada adjust kar sakte ho.`}
            </p>
            {!isExtend && (
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-border/80 bg-muted/40 p-3">
                <input
                  type="checkbox"
                  checked={keepGrnOpen}
                  onChange={(e) => setKeepGrnOpen(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-border"
                />
                <span className="text-xs leading-relaxed text-muted-foreground">
                  <span className="font-bold text-foreground">GRN khuli rakho</span> — baad mein aur items same GRN mein add kar sakte ho (250 ka bill, aaj 100, kal 150).
                </span>
              </label>
            )}
            <Button size="lg" className="mt-4 w-full" disabled={!canPost || posting || extendLoading} onClick={postPurchase}>
              <PackagePlus className="h-5 w-5" />
              {posting ? "Saving…" : isExtend ? "Add to GRN" : "Post purchase"}
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
          categories={categories}
          onAdd={addLine}
          onClose={() => setScan(null)}
        />
      )}

      <AppToast toast={toast} onDismiss={hideToast} />
    </AdminShell>
  );
}
