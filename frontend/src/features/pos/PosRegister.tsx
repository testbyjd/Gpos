"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { useBillingConnection } from "@/lib/connection-status";
import { PosTopBar } from "./components/PosTopBar";
import { PosToolbar } from "./components/PosToolbar";
import { PosFooter } from "./components/PosFooter";
import { BillingWorkspace } from "./components/BillingWorkspace";
import { MeriShelf } from "./components/MeriShelf";
import { PaymentModal } from "./components/PaymentModal";
import { MorePayModal } from "./components/MorePayModal";
import { SaleSuccessModal, type SaleResult } from "./components/SaleSuccessModal";
import { fetchCatalog } from "./api/catalog";
import {
  healProductBarcode,
  normalizeBarcode,
  productMatchesBarcode,
  resolveScannedBarcode,
} from "./api/barcode";
import { fetchPosCustomers } from "./api/customers";
import { submitSale } from "./api/sale";
import { validateDiscountApproval, cartSubtotal, cartLineDiscountTotal, maxLineDiscount, freeLineDiscountCap, lineDiscountGate } from "./discount";
import { formatSyncError, syncCartWithCatalog } from "./api/syncCartPrices";
import { recordSync } from "@/lib/sync-status";
import { getErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import type { CartLine, HeldCart, PaymentMethod, Product, PosCustomer } from "./types";
import { DiscountPinModal } from "./components/DiscountPinModal";
import { PosReturnModal } from "./components/PosReturnModal";

const CATALOG_CACHE_KEY = "gpos.pos.catalog.v3";
const HELD_CARTS_KEY = "gpos.pos.heldCarts.v1";
const PRODUCTS_PANEL_KEY = "gpos.pos.productsPanelOpen.v1";
const SHELF_KEY = "gpos.pos.shelf.v1";

function readProductsPanelOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRODUCTS_PANEL_KEY) === "1";
  } catch {
    return false;
  }
}

function readShelfIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SHELF_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function productMatchesQuery(p: Product, raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  return p.name.toLowerCase().includes(q) || productMatchesBarcode(p, q);
}

interface CatalogCache {
  products: Product[];
  categories: string[];
}

export function PosRegister() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<readonly string[]>(["All"]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [saleQuery, setSaleQuery] = useState("");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [customer, setCustomer] = useState("Walk-in Customer");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [discount, setDiscount] = useState(0);
  const [discountRecipientName, setDiscountRecipientName] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const { toast, showToast, hideToast } = useAppToast();
  const { connected: billingOnline } = useBillingConnection();
  const [payOpen, setPayOpen] = useState(false);
  const [morePayOpen, setMorePayOpen] = useState(false);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [pendingLineDiscount, setPendingLineDiscount] = useState<{
    id: string;
    amount: number;
    productName: string;
    max: number;
    freeCap: number;
  } | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(readProductsPanelOpen);
  const [shelfIds, setShelfIds] = useState<string[]>([]);
  const [isDesktop, setIsDesktop] = useState(false);

  const saleSearchRef = useRef<HTMLInputElement>(null);
  // Stable id for the current checkout so a retry can't create a duplicate sale.
  const saleClientId = useRef<string | null>(null);
  const autoScanHandled = useRef<string>("");

  const subtotal = cartSubtotal(lines);
  const lineDiscountTotal = cartLineDiscountTotal(lines);
  const billDiscount = Math.min(discount, Math.max(0, subtotal - lineDiscountTotal));
  const totalDiscount = Math.round((lineDiscountTotal + billDiscount) * 100) / 100;
  const total = Math.max(0, subtotal - totalDiscount);

  useEffect(() => {
    const maxBill = Math.max(0, subtotal - lineDiscountTotal);
    if (discount > maxBill) setDiscount(maxBill);
  }, [subtotal, lineDiscountTotal, discount]);

  const saleSearchResults = useMemo(() => {
    const q = saleQuery.trim();
    if (!q) return [];
    const resolved = resolveScannedBarcode(products, q);
    if (resolved.status === "exact" || resolved.status === "legacy") {
      return [resolved.product];
    }
    if (resolved.status === "ambiguous") {
      return resolved.products.slice(0, 20);
    }
    return products.filter((p) => productMatchesQuery(p, q)).slice(0, 20);
  }, [saleQuery, products]);

  function toggleShelfId(id: string) {
    setShelfIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(SHELF_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      // kg: pehli add 0.200 (200g); dubara add pe +0.200. Baqi units: 1.
      const step = p.fractional ? 0.2 : 1;
      if (existing) {
        const updated = { ...existing, qty: Math.round((existing.qty + step) * 1000) / 1000 };
        return [updated, ...prev.filter((l) => l.product.id !== p.id)];
      }
      return [{ product: p, qty: step }, ...prev];
    });
  }

  function pickSaleProduct(p: Product) {
    const scanned = saleQuery.trim();
    if (scanned && normalizeBarcode(p.barcode ?? "") !== normalizeBarcode(scanned)) {
      const resolved = resolveScannedBarcode(products, scanned);
      if (resolved.status === "legacy" && resolved.product.id === p.id) {
        void applyLegacyBarcodeHeal(p, resolved.fullBarcode, resolved.oldBarcode).then((healed) => {
          addProduct(healed);
        });
        autoScanHandled.current = scanned;
        setSaleQuery("");
        saleSearchRef.current?.focus();
        return;
      }
    }
    addProduct(p);
    autoScanHandled.current = scanned;
    setSaleQuery("");
    saleSearchRef.current?.focus();
  }

  function patchLocalBarcode(productId: string, fullBarcode: string) {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, barcode: fullBarcode } : p)),
    );
    setLines((prev) =>
      prev.map((l) =>
        l.product.id === productId
          ? { ...l, product: { ...l.product, barcode: fullBarcode } }
          : l,
      ),
    );
    try {
      const raw = localStorage.getItem(CATALOG_CACHE_KEY);
      if (!raw) return;
      const cache = JSON.parse(raw) as CatalogCache;
      localStorage.setItem(
        CATALOG_CACHE_KEY,
        JSON.stringify({
          ...cache,
          products: cache.products.map((p) =>
            p.id === productId ? { ...p, barcode: fullBarcode } : p,
          ),
        }),
      );
    } catch {
      /* ignore cache write errors */
    }
  }

  async function applyLegacyBarcodeHeal(product: Product, fullBarcode: string, oldBarcode: string) {
    const healed: Product = { ...product, barcode: fullBarcode };
    patchLocalBarcode(product.id, fullBarcode);
    try {
      await healProductBarcode(product.id, fullBarcode);
      showToast(`Barcode update: ${oldBarcode || "…"} → ${fullBarcode}`, "success");
    } catch (err) {
      showToast(
        getErrorMessage(err, "Product mil gaya, lekin barcode auto-update fail hua."),
        "error",
      );
    }
    return healed;
  }

  async function resolveBarcodeForPos(raw: string): Promise<Product | null> {
    const resolved = resolveScannedBarcode(products, raw);
    if (resolved.status === "exact") return resolved.product;
    if (resolved.status === "legacy") {
      return applyLegacyBarcodeHeal(resolved.product, resolved.fullBarcode, resolved.oldBarcode);
    }
    if (resolved.status === "ambiguous") {
      showToast(
        `Barcode 3-digit skip se ${resolved.products.length} products mile — manually select karo.`,
        "error",
      );
      return null;
    }
    return null;
  }

  async function submitSaleSearch(raw: string) {
    const code = raw.trim();
    if (!code) return;
    if (catalogLoading || catalogError) {
      showToast("Catalog load nahi hua — abhi add nahi ho sakta.", "error");
      return;
    }
    const byBarcode = await resolveBarcodeForPos(code);
    if (byBarcode) {
      pickSaleProduct(byBarcode);
      return;
    }
    const matches = products.filter((p) => productMatchesQuery(p, code));
    if (matches.length === 1) {
      pickSaleProduct(matches[0]);
      return;
    }
    setSaleQuery(code);
  }

  function setLineQty(id: string, qty: number) {
    const rounded = Math.round(qty * 1000) / 1000;
    if (rounded <= 0) {
      removeLine(id);
      return;
    }
    setLines((prev) =>
      prev.map((l) => {
        if (l.product.id !== id) return l;
        const next = { ...l, qty: rounded };
        const max = maxLineDiscount(next);
        const disc = Math.min(max, Math.max(0, l.discount ?? 0));
        return { ...next, discount: disc > 0 ? disc : undefined };
      }),
    );
  }

  function applyLineDiscount(id: string, amount: number) {
    const rounded = Math.max(0, Math.round(amount * 100) / 100);
    setLines((prev) =>
      prev.map((l) => {
        if (l.product.id !== id) return l;
        return { ...l, discount: rounded > 0 ? rounded : undefined };
      }),
    );
  }

  function setLineDiscount(id: string, amount: number) {
    const line = lines.find((l) => l.product.id === id);
    if (!line) return;
    const max = maxLineDiscount(line);
    const freeCap = freeLineDiscountCap(line);
    const rounded = Math.max(0, Math.round(amount * 100) / 100);
    const gate = lineDiscountGate(line, rounded);

    if (gate === "over_max") {
      showToast(
        max > 0
          ? `"${line.product.name}" pe max discount ${formatMoney(max)} hai — cost se neeche nahi ja sakta.`
          : `"${line.product.name}" pe discount nahi — cost/margin allow nahi karti.`,
        "error",
      );
      return;
    }

    if (gate === "needs_pin") {
      setPendingLineDiscount({
        id,
        amount: rounded,
        productName: line.product.name,
        max,
        freeCap,
      });
      return;
    }

    applyLineDiscount(id, rounded);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.product.id !== id));
  }

  function selectCustomer(id: number | null) {
    setCustomerId(id);
    setCustomer(id === null ? "Walk-in Customer" : customers.find((c) => c.id === id)?.name ?? "Customer");
  }

  function resetSale() {
    setLines([]);
    setDiscount(0);
    setDiscountRecipientName("");
    setDiscountReason("");
    setCustomer("Walk-in Customer");
    setCustomerId(null);
    setPayment("cash");
  }

  function persistHeldCarts(next: HeldCart[]) {
    setHeldCarts(next);
    try {
      window.localStorage.setItem(HELD_CARTS_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota errors */
    }
  }

  function holdCart() {
    if (lines.length === 0) return;
    persistHeldCarts([
      ...heldCarts,
      {
        id: crypto.randomUUID(),
        label: `#${heldCarts.length + 1}`,
        lines,
        customer,
        customerId,
        discount,
        discountRecipientName,
        discountReason,
        heldAt: Date.now(),
      },
    ]);
    resetSale();
    showToast("Cart hold ho gaya — is device pe yaad rahega (server pe save nahi).", "info");
  }

  function resumeCart(id: string) {
    const held = heldCarts.find((h) => h.id === id);
    if (!held) return;
    setLines(held.lines);
    setCustomer(held.customer);
    setCustomerId(held.customerId);
    setDiscount(held.discount ?? 0);
    setDiscountRecipientName(held.discountRecipientName ?? "");
    setDiscountReason(held.discountReason ?? "");
    persistHeldCarts(heldCarts.filter((h) => h.id !== id));
  }

  async function checkout() {
    if (lines.length === 0) return;
    const approvalError = validateDiscountApproval(
      subtotal,
      totalDiscount,
      discountRecipientName,
      discountReason,
    );
    if (approvalError) {
      showToast(approvalError, "error");
      return;
    }
    if (!billingOnline) {
      showToast("Server se connection nahi — billing band. Online aane par dobara try karein.", "error");
      return;
    }
    try {
      const { lines: synced, priceChanges } = await syncCartWithCatalog(lines);
      setLines(synced);
      setProducts((prev) => {
        const merged = new Map(prev.map((p) => [p.id, p]));
        synced.forEach((l) => merged.set(l.product.id, l.product));
        return Array.from(merged.values());
      });
      if (priceChanges.length > 0) {
        showToast(`${priceChanges.length} item ki price server rate pe update ho gayi.`, "info");
      }
    } catch (err) {
      showToast(formatSyncError(err), "error");
      return;
    }
    saleClientId.current = crypto.randomUUID();
    setPayOpen(true);
  }

  async function openMorePay() {
    if (lines.length === 0) return;
    const approvalError = validateDiscountApproval(
      subtotal,
      totalDiscount,
      discountRecipientName,
      discountReason,
    );
    if (approvalError) {
      showToast(approvalError, "error");
      return;
    }
    if (!billingOnline) {
      showToast("Server se connection nahi — billing band. Online aane par dobara try karein.", "error");
      return;
    }
    try {
      const { lines: synced, priceChanges } = await syncCartWithCatalog(lines);
      setLines(synced);
      setProducts((prev) => {
        const merged = new Map(prev.map((p) => [p.id, p]));
        synced.forEach((l) => merged.set(l.product.id, l.product));
        return Array.from(merged.values());
      });
      if (priceChanges.length > 0) {
        showToast(`${priceChanges.length} item ki price server rate pe update ho gayi.`, "info");
      }
    } catch (err) {
      showToast(formatSyncError(err), "error");
      return;
    }
    saleClientId.current = crypto.randomUUID();
    setMorePayOpen(true);
  }

  async function pickMorePayMethod(method: PaymentMethod, referenceId?: string) {
    setMorePayOpen(false);
    setPayment(method);
    if (method === "cash") {
      setPayOpen(true);
      return;
    }
    try {
      await confirmSale(total, 0, method, referenceId);
    } catch {
      /* confirmSale already toasts; keep cart for retry */
    }
  }

  // Online-only: the sale completes only when the server confirms it.
  // No internet => no bill (throws, cart stays, cashier retries).
  async function confirmSale(
    tendered: number,
    change: number,
    methodOverride?: PaymentMethod,
    referenceId?: string,
  ) {
    if (!billingOnline) {
      showToast("Server se connection nahi — bill save NAHI hoga. Online aane par try karein.", "error");
      throw new Error("sale-offline");
    }
    const payMethod = methodOverride ?? payment;
    if (payMethod === "khata" && !customerId) {
      showToast("Khata / udhar ke liye pehle customer select karo.", "error");
      throw new Error("khata-no-customer");
    }
    if (payMethod !== "cash" && !referenceId?.trim()) {
      showToast("Cash ke ilawa payment pe reference ID lazmi hai.", "error");
      throw new Error("missing-reference");
    }
    let billLines = lines;
    try {
      const { lines: synced, priceChanges } = await syncCartWithCatalog(lines);
      billLines = synced;
      setLines(synced);
      if (priceChanges.length > 0) {
        showToast(`${priceChanges.length} item ki price bill se pehle server rate pe set hui.`, "info");
      }
    } catch (err) {
      showToast(formatSyncError(err), "error");
      throw new Error("sale-sync-failed");
    }

    const billSubtotal = cartSubtotal(billLines);
    const billLineDisc = cartLineDiscountTotal(billLines);
    const billExtraDisc = Math.min(discount, Math.max(0, billSubtotal - billLineDisc));
    const billDiscountTotal = Math.round((billLineDisc + billExtraDisc) * 100) / 100;
    const billTotal = Math.max(0, billSubtotal - billDiscountTotal);

    let invoice: string;
    let saleId: number;
    try {
      const res = await submitSale({
        clientId: saleClientId.current ?? crypto.randomUUID(),
        lines: billLines,
        discount: billDiscountTotal,
        discountRecipientName,
        discountReason,
        total: billTotal,
        method: payMethod,
        tendered,
        change,
        customerId,
        referenceId: referenceId?.trim() || undefined,
      });
      invoice = res.invoiceNo;
      saleId = res.saleId;
    } catch (err) {
      showToast(getErrorMessage(err, "Bill save NAHI hua — connection ya server check karke dobara try karein."), "error");
      throw new Error("sale-failed");
    }
    saleClientId.current = null;
    recordSync();

    setPayOpen(false);
    setMorePayOpen(false);
    setSaleResult({
      saleId,
      invoice,
      total: billTotal,
      tendered,
      change,
      method: payMethod,
      customer,
      referenceId: referenceId?.trim() || undefined,
    });
    resetSale();
  }

  function startNewSale() {
    setSaleResult(null);
    saleSearchRef.current?.focus();
  }

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (payOpen || morePayOpen || saleResult || pendingLineDiscount || returnOpen) return;
      if (e.key === "F2") {
        e.preventDefault();
        saleSearchRef.current?.focus();
        saleSearchRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        holdCart();
      } else if (e.key === "F6") {
        e.preventDefault();
        setReturnOpen(true);
      } else if (e.key === "F9") {
        e.preventDefault();
        void checkout();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, discount, customer, heldCarts, payOpen, morePayOpen, saleResult, pendingLineDiscount, returnOpen, isDesktop]);

  useEffect(() => {
    const q = saleQuery.trim();
    if (!q) {
      autoScanHandled.current = "";
      return;
    }
    // Scanner often leaves digits without Enter — auto-add when barcode resolves.
    if (!/^\d{10,}$/.test(q)) return;
    if (catalogLoading || catalogError) return;
    if (autoScanHandled.current === q) return;
    const resolved = resolveScannedBarcode(products, q);
    if (resolved.status !== "exact" && resolved.status !== "legacy") return;
    const timer = window.setTimeout(() => {
      if (autoScanHandled.current === q) return;
      autoScanHandled.current = q;
      void submitSaleSearch(q);
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleQuery, products, catalogLoading, catalogError]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRODUCTS_PANEL_KEY, productsOpen ? "1" : "0");
    } catch {
      /* ignore quota errors */
    }
  }, [productsOpen]);

  useEffect(() => {
    setShelfIds(readShelfIds());
    try {
      const raw = window.localStorage.getItem(HELD_CARTS_KEY);
      if (raw) setHeldCarts(JSON.parse(raw) as HeldCart[]);
    } catch {
      window.localStorage.removeItem(HELD_CARTS_KEY);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let hadCachedCatalog = false;

    Promise.resolve().then(() => {
      const cached = window.localStorage.getItem(CATALOG_CACHE_KEY);
      if (!cached || !alive) return;

      try {
        const parsed = JSON.parse(cached) as CatalogCache;
        if (parsed.products.length === 0) return;
        hadCachedCatalog = true;
        setProducts(parsed.products);
        setCategories(parsed.categories);
        setCatalogLoading(false);
      } catch {
        window.localStorage.removeItem(CATALOG_CACHE_KEY);
      }
    });

    fetchCatalog()
      .then((catalog) => {
        if (!alive) return;
        setProducts(catalog.products);
        setCategories(catalog.categories);
        setCatalogError(false);
        window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(catalog));
        setCatalogLoading(false);
      })
      .catch(() => {
        if (!alive || hadCachedCatalog) return;
        setCatalogError(true);
        setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Khata customers for the cart selector (best-effort — POS still bills without it).
  useEffect(() => {
    let alive = true;
    fetchPosCustomers()
      .then((res) => alive && setCustomers(res))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  function startKhataCheckout() {
    if (!customerId) {
      showToast("Khata / udhar ke liye pehle customer select karo.", "error");
      return;
    }
    setPayment("khata");
    void checkout();
  }

  return (
    <div className="pos-shell flex h-dvh flex-col overflow-hidden bg-background">
      <PosTopBar />
      <PosToolbar
        shelfOpen={productsOpen}
        onToggleShelf={() => setProductsOpen((v) => !v)}
        onReturn={() => setReturnOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <BillingWorkspace
            lines={lines}
            customers={customers}
            customerId={customerId}
            onCustomerChange={selectCustomer}
            saleQuery={saleQuery}
            onSaleQueryChange={setSaleQuery}
            onSaleSubmit={submitSaleSearch}
            saleResults={saleSearchResults}
            onPickSale={pickSaleProduct}
            saleInputRef={saleSearchRef}
            searchDisabled={catalogLoading || catalogError}
            discount={discount}
            onDiscountChange={setDiscount}
            discountRecipientName={discountRecipientName}
            onDiscountRecipientNameChange={setDiscountRecipientName}
            discountReason={discountReason}
            onDiscountReasonChange={setDiscountReason}
            onSetQty={setLineQty}
            onSetLineDiscount={setLineDiscount}
            onRemove={removeLine}
            onClear={resetSale}
            onHold={holdCart}
            onCheckout={() => {
              setPayment("cash");
              void checkout();
            }}
            onMorePay={() => {
              void openMorePay();
            }}
            onKhata={startKhataCheckout}
            heldCarts={heldCarts}
            onResume={resumeCart}
          />
        </div>

        <MeriShelf
          open={isDesktop ? productsOpen : false}
          onToggle={() => setProductsOpen((v) => !v)}
          products={products}
          shelfIds={shelfIds}
          onToggleShelf={toggleShelfId}
          onAdd={addProduct}
        />
      </div>

      <PosFooter />

      {morePayOpen && (
        <MorePayModal
          total={total}
          onPick={(method, referenceId) => {
            void pickMorePayMethod(method, referenceId);
          }}
          onClose={() => setMorePayOpen(false)}
        />
      )}

      {returnOpen && (
        <PosReturnModal
          onClose={() => setReturnOpen(false)}
          onReturned={() => {
            showToast("Customer return record ho gaya — stock wapas aa gaya.", "success");
          }}
        />
      )}

      {pendingLineDiscount && (
        <DiscountPinModal
          productName={pendingLineDiscount.productName}
          amount={pendingLineDiscount.amount}
          maxDiscount={pendingLineDiscount.max}
          freeCap={pendingLineDiscount.freeCap}
          onApproved={() => {
            applyLineDiscount(pendingLineDiscount.id, pendingLineDiscount.amount);
            setPendingLineDiscount(null);
            showToast("Discount PIN se approve ho gaya.", "success");
          }}
          onClose={() => setPendingLineDiscount(null)}
        />
      )}

      {payOpen && (
        <PaymentModal
          total={total}
          payment={payment}
          customer={customer}
          onConfirm={(tendered, change, referenceId) => confirmSale(tendered, change, payment, referenceId)}
          onClose={() => setPayOpen(false)}
        />
      )}

      {saleResult && <SaleSuccessModal sale={saleResult} onClose={startNewSale} />}

      <AppToast toast={toast} onDismiss={hideToast} />
    </div>
  );
}
