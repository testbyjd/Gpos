"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { useBillingConnection } from "@/lib/connection-status";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { PosTopBar } from "./components/PosTopBar";
import { CartSlideHandle } from "./components/CartSlideHandle";
import { ProductSearch } from "./components/ProductSearch";
import { SaleQuickAdd } from "./components/SaleQuickAdd";
import { CategoryChips } from "./components/CategoryChips";
import { ProductGrid } from "./components/ProductGrid";
import { CartPanel } from "./components/CartPanel";
import { PaymentModal } from "./components/PaymentModal";
import { SaleSuccessModal, type SaleResult } from "./components/SaleSuccessModal";
import { fetchCatalog } from "./api/catalog";
import { fetchPosCustomers } from "./api/customers";
import { submitSale } from "./api/sale";
import { validateDiscountApproval } from "./discount";
import { formatSyncError, syncCartWithCatalog } from "./api/syncCartPrices";
import { recordSync } from "@/lib/sync-status";
import { getErrorMessage } from "@/lib/api";
import type { CartLine, HeldCart, PaymentMethod, Product, PosCustomer } from "./types";

const CATALOG_CACHE_KEY = "gpos.pos.catalog.v1";
const HELD_CARTS_KEY = "gpos.pos.heldCarts.v1";
const PRODUCTS_PANEL_KEY = "gpos.pos.productsPanelOpen.v1";

function readProductsPanelOpen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PRODUCTS_PANEL_KEY) === "1";
  } catch {
    return false;
  }
}

function productMatchesQuery(p: Product, raw: string) {
  const q = raw.trim().toLowerCase();
  if (!q) return true;
  return (
    p.name.toLowerCase().includes(q) ||
    (p.barcode?.toLowerCase().includes(q) ?? false)
  );
}

function findByBarcode(products: Product[], code: string) {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  return products.find((p) => p.barcode?.trim().toLowerCase() === c);
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
  const [catalogQuery, setCatalogQuery] = useState("");
  const [saleQuery, setSaleQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
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
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(readProductsPanelOpen);
  const [isDesktop, setIsDesktop] = useState(false);

  const saleSearchRef = useRef<HTMLInputElement>(null);
  const catalogSearchRef = useRef<HTMLInputElement>(null);
  // Stable id for the current checkout so a retry can't create a duplicate sale.
  const saleClientId = useRef<string | null>(null);

  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const total = Math.max(0, subtotal - discount);

  const filteredCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return products.filter((p) => {
      const inCat = category === "All" || p.category === category;
      const inQuery = !q || productMatchesQuery(p, q);
      return inCat && inQuery;
    });
  }, [catalogQuery, category, products]);

  const saleSearchResults = useMemo(() => {
    const q = saleQuery.trim();
    if (!q) return [];
    return products.filter((p) => productMatchesQuery(p, q)).slice(0, 20);
  }, [saleQuery, products]);

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

  function pickSaleProduct(p: Product) {
    addProduct(p);
    setSaleQuery("");
    saleSearchRef.current?.focus();
  }

  function submitSaleSearch(raw: string) {
    const code = raw.trim();
    if (!code) return;
    if (catalogLoading || catalogError) {
      showToast("Catalog load nahi hua — abhi add nahi ho sakta.", "error");
      return;
    }
    const byBarcode = findByBarcode(products, code);
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

  function scanCatalogBarcode(raw: string) {
    const code = raw.trim();
    if (!code) return;
    if (catalogLoading || catalogError) {
      showToast("Catalog load nahi hua — scan abhi nahi chalega.", "error");
      return;
    }
    const product = findByBarcode(products, code);
    if (!product) {
      showToast(`Barcode "${code}" catalog mein nahi mila.`, "error");
      setCatalogQuery("");
      catalogSearchRef.current?.focus();
      return;
    }
    addProduct(product);
    setCatalogQuery("");
    catalogSearchRef.current?.focus();
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
      discount,
      discountRecipientName,
      discountReason,
    );
    if (approvalError) {
      showToast(approvalError, "error");
      setCartOpen(true);
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
        discountRecipientName,
        discountReason,
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
      if (payOpen || saleResult) return; // an open modal owns the keyboard
      if (e.key === "F2") {
        e.preventDefault();
        if (!isDesktop) setCartOpen(true);
        saleSearchRef.current?.focus();
        saleSearchRef.current?.select();
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
  }, [lines, discount, customer, heldCarts, payOpen, saleResult, isDesktop]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRODUCTS_PANEL_KEY, productsOpen ? "1" : "0");
    } catch {
      /* ignore quota errors */
    }
  }, [productsOpen]);

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

  const catalogBody = catalogLoading ? (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1.5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-stretch gap-2 rounded-lg border border-border/80 bg-card p-1.5"
        >
          <div className="h-[4.25rem] w-[4.25rem] shrink-0 rounded-md bg-muted" />
          <div className="flex flex-1 flex-col justify-between py-0.5">
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-3 w-16 rounded-full bg-muted" />
            </div>
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
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
    <ProductGrid products={filteredCatalog} onAdd={addProduct} />
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <PosTopBar />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* Desktop: products band — sirf Open tab */}
        {!productsOpen && (
          <button
            type="button"
            onClick={() => setProductsOpen(true)}
            aria-label="Products kholo"
            className="hidden lg:flex w-11 shrink-0 flex-col items-center justify-center gap-2 border-r border-border/70 bg-card text-primary transition-colors hover:bg-card-hover"
          >
            <ChevronRight className="h-5 w-5" />
            <span className="text-[11px] font-black uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
              Open
            </span>
          </button>
        )}

        {/* Products — mobile full width; desktop sidebar jab open ho */}
        <section
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-border/70 p-3 lg:p-3.5",
            productsOpen ? "lg:flex-[3] lg:basis-0 lg:max-w-[30%] lg:flex-none" : "lg:hidden",
          )}
        >
          <div className="mb-2.5 hidden items-center justify-between gap-2 lg:flex">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Products</p>
            <button
              type="button"
              onClick={() => setProductsOpen(false)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border/80 bg-card px-2 text-xs font-bold text-muted-foreground hover:bg-card-hover hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              Band
            </button>
          </div>
          {(isDesktop ? productsOpen : !cartOpen) && (
            <div className="mb-2.5">
              <ProductSearch
                value={catalogQuery}
                onValueChange={setCatalogQuery}
                onScan={scanCatalogBarcode}
                inputRef={catalogSearchRef}
                resultCount={filteredCatalog.length}
                placeholder="Products list filter — naam ya barcode…"
              />
            </div>
          )}
          <div>
            <CategoryChips
              categories={categories}
              active={category}
              onSelect={setCategory}
            />
          </div>
          <div className="mt-2.5 flex-1 overflow-y-auto pr-1">{catalogBody}</div>
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

        {/* Current Sale — search upar (fixed), cart neeche */}
        <div
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-[min(100%,420px)] min-w-0 flex-col overflow-hidden border-l border-border/70 bg-background shadow-xl transition-[transform,flex] duration-300 ease-out lg:relative lg:z-auto lg:min-w-0 lg:translate-x-0 lg:shadow-none",
            productsOpen ? "lg:flex-[7] lg:basis-0" : "lg:flex-1",
            cartOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          )}
        >
          <div className="shrink-0 border-b border-border/70 p-3 lg:p-3.5 lg:pb-3">
            {(isDesktop || cartOpen) && (
              <SaleQuickAdd
                value={saleQuery}
                onValueChange={setSaleQuery}
                onSubmit={submitSaleSearch}
                results={saleSearchResults}
                onPick={pickSaleProduct}
                inputRef={saleSearchRef}
                disabled={catalogLoading || catalogError}
              />
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <CartPanel
              lines={lines}
              customers={customers}
              customerId={customerId}
              onCustomerChange={selectCustomer}
              discount={discount}
              onDiscountChange={setDiscount}
              discountRecipientName={discountRecipientName}
              onDiscountRecipientNameChange={setDiscountRecipientName}
              discountReason={discountReason}
              onDiscountReasonChange={setDiscountReason}
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
