"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { useBillingConnection } from "@/lib/connection-status";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { PosTopBar } from "./components/PosTopBar";
import { CartSlideHandle } from "./components/CartSlideHandle";
import { ProductSearch } from "./components/ProductSearch";
import { CategoryChips } from "./components/CategoryChips";
import { ProductGrid } from "./components/ProductGrid";
import { CartPanel } from "./components/CartPanel";
import { PaymentModal } from "./components/PaymentModal";
import { SaleSuccessModal, type SaleResult } from "./components/SaleSuccessModal";
import { fetchCatalog } from "./api/catalog";
import { fetchPosCustomers } from "./api/customers";
import { submitSale } from "./api/sale";
import { formatSyncError, syncCartWithCatalog } from "./api/syncCartPrices";
import { recordSync } from "@/lib/sync-status";
import { getErrorMessage } from "@/lib/api";
import type { CartLine, HeldCart, PaymentMethod, Product, PosCustomer } from "./types";

const CATALOG_CACHE_KEY = "gpos.pos.catalog.v1";
const HELD_CARTS_KEY = "gpos.pos.heldCarts.v1";

interface CatalogCache {
  products: Product[];
  categories: string[];
}

export function PosRegister() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<readonly string[]>(["All"]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customers, setCustomers] = useState<PosCustomer[]>([]);
  const [customer, setCustomer] = useState("Walk-in Customer");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState<PaymentMethod>("cash");
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const { toast, showToast, hideToast } = useAppToast();
  const { connected: billingOnline } = useBillingConnection();
  const [payOpen, setPayOpen] = useState(false);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  // Stable id for the current checkout so a retry can't create a duplicate sale.
  const saleClientId = useRef<string | null>(null);

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const total = Math.max(0, subtotal - discount);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      const inCat = category === "All" || p.category === category;
      const inQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.barcode?.includes(q);
      return inCat && inQuery;
    });
  }, [query, category, products]);

  function addProduct(p: Product) {
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      const step = p.fractional ? 0.5 : 1;
      if (existing) {
        const updated = { ...existing, qty: existing.qty + step };
        return [updated, ...prev.filter((l) => l.product.id !== p.id)];
      }
      return [{ product: p, qty: step }, ...prev];
    });
  }

  function scanBarcode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    if (catalogLoading || catalogError) {
      showToast("Catalog load nahi hua — scan abhi nahi chalega.", "error");
      return;
    }
    const product = products.find(
      (p) => p.barcode && p.barcode.trim().toLowerCase() === code.toLowerCase(),
    );
    if (!product) {
      showToast(`Barcode "${code}" catalog mein nahi mila.`, "error");
      setQuery("");
      searchRef.current?.focus();
      return;
    }
    addProduct(product);
    setQuery("");
    searchRef.current?.focus();
  }

  function changeQty(id: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) =>
          l.product.id === id
            ? { ...l, qty: Math.round((l.qty + delta) * 1000) / 1000 }
            : l,
        )
        .filter((l) => l.qty > 0),
    );
  }

  function setLineQty(id: string, qty: number) {
    const rounded = Math.round(qty * 1000) / 1000;
    if (rounded <= 0) {
      removeLine(id);
      return;
    }
    setLines((prev) =>
      prev.map((l) => (l.product.id === id ? { ...l, qty: rounded } : l)),
    );
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
    persistHeldCarts(heldCarts.filter((h) => h.id !== id));
  }

  async function checkout() {
    if (lines.length === 0) return;
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

  // Online-only: the sale completes only when the server confirms it.
  // No internet => no bill (throws, cart stays, cashier retries).
  async function confirmSale(tendered: number, change: number) {
    if (!billingOnline) {
      showToast("Server se connection nahi — bill save NAHI hoga. Online aane par try karein.", "error");
      throw new Error("sale-offline");
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

    const billSubtotal = billLines.reduce((s, l) => s + l.product.price * l.qty, 0);
    const billTotal = Math.max(0, billSubtotal - discount);

    let invoice: string;
    try {
      const res = await submitSale({
        clientId: saleClientId.current ?? crypto.randomUUID(),
        lines: billLines,
        discount,
        total: billTotal,
        method: payment,
        tendered,
        change,
        customerId,
      });
      invoice = res.invoiceNo;
    } catch (err) {
      showToast(getErrorMessage(err, "Bill save NAHI hua — connection ya server check karke dobara try karein."), "error");
      throw new Error("sale-failed");
    }
    saleClientId.current = null;
    recordSync();

    setPayOpen(false);
    setSaleResult({
      invoice,
      total: billTotal,
      tendered,
      change,
      method: payment,
      customer,
    });
    resetSale();
  }

  function startNewSale() {
    setSaleResult(null);
    searchRef.current?.focus();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (payOpen || saleResult) return; // an open modal owns the keyboard
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "F4") {
        e.preventDefault();
        holdCart();
      } else if (e.key === "F9") {
        e.preventDefault();
        checkout();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, discount, customer, heldCarts, payOpen, saleResult]);

  useEffect(() => {
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
        if (!catalog.categories.includes(category)) setCategory("All");
      })
      .catch(() => {
        if (!alive || hadCachedCatalog) return;
        // Backend down and no cached catalog yet — show a clear empty state
        // instead of fake products (never let cashiers sell items that
        // don't exist in the real inventory).
        setCatalogError(true);
        setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <PosTopBar />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Left: catalog — full width on mobile when cart is slid away */}
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-border/70 p-3 lg:p-3.5">
          <ProductSearch
            value={query}
            onValueChange={setQuery}
            onScan={scanBarcode}
            inputRef={searchRef}
            resultCount={filtered.length}
          />
          <div className="mt-2.5">
            <CategoryChips
              categories={categories}
              active={category}
              onSelect={setCategory}
            />
          </div>
          <div className="mt-2.5 flex-1 overflow-y-auto pr-1">
            {catalogLoading ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-h-[8.75rem] animate-pulse rounded-lg border border-border/80 bg-card p-2.5"
                  >
                    <div className="mb-3 h-9 w-9 rounded-md bg-muted" />
                    <div className="h-4 rounded bg-muted" />
                    <div className="mt-2 h-4 w-2/3 rounded bg-muted" />
                    <div className="mt-8 h-5 w-1/2 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : catalogError ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
                <AlertTriangle className="h-10 w-10 opacity-30" />
                <p className="text-sm font-semibold text-foreground">Catalog load nahi hua</p>
                <p className="max-w-xs text-xs">
                  Internet aur server dono chahiye. Jab online ho jayein tab products load honge —
                  tab hi billing chalegi (offline bill save nahi hota).
                </p>
              </div>
            ) : (
              <ProductGrid products={filtered} onAdd={addProduct} />
            )}
          </div>
        </section>

        {/* Backdrop when cart open on mobile */}
        {cartOpen && (
          <button
            type="button"
            aria-label="Cart band karo"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setCartOpen(false)}
          />
        )}

        {/* Right: cart — fixed slide-in on mobile, always visible on lg+ */}
        <div
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-[min(100%,420px)] overflow-hidden border-l border-border/70 bg-background shadow-xl transition-transform duration-300 ease-out lg:relative lg:z-auto lg:w-[500px] lg:translate-x-0 lg:shadow-none xl:w-[560px] 2xl:w-[620px]",
            cartOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          )}
        >
          <CartPanel
            lines={lines}
            customers={customers}
            customerId={customerId}
            onCustomerChange={selectCustomer}
            discount={discount}
            onDiscountChange={setDiscount}
            payment={payment}
            onPaymentChange={setPayment}
            onQty={changeQty}
            onSetQty={setLineQty}
            onRemove={removeLine}
            onClear={resetSale}
            onHold={holdCart}
            onCheckout={checkout}
            heldCarts={heldCarts}
            onResume={resumeCart}
          />
        </div>

        <CartSlideHandle
          open={cartOpen}
          itemCount={lines.length}
          total={total}
          onToggle={() => setCartOpen((v) => !v)}
        />
      </div>

      {/* Payment calculator */}
      {payOpen && (
        <PaymentModal
          total={total}
          payment={payment}
          customer={customer}
          onConfirm={confirmSale}
          onClose={() => setPayOpen(false)}
        />
      )}

      {/* Change / receipt confirmation — stays open until cashier dismisses */}
      {saleResult && (
        <SaleSuccessModal sale={saleResult} onClose={startNewSale} />
      )}

      <AppToast toast={toast} onDismiss={hideToast} />
    </div>
  );
}
