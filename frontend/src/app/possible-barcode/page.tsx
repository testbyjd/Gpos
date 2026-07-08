"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  Loader2,
  PackageCheck,
  RotateCcw,
  ScanLine,
  ScanSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import {
  AdminShell,
  PageAlert,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";
import {
  listAllProducts,
  updateProduct,
  type ProductRow,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import {
  findPossibleBarcodeCandidates,
  type BarcodeCandidate,
} from "@/lib/barcode-candidates";
import { cn, formatMoney } from "@/lib/utils";

const CHECKED_KEY = "gpos.possible-barcode.checked.v1";

const inputCls =
  "h-14 w-full rounded-xl border border-border bg-input px-12 text-center text-lg font-bold tracking-wide text-foreground outline-none placeholder:text-sm placeholder:font-semibold placeholder:tracking-normal focus:border-primary focus:ring-2 focus:ring-ring/25";

function readCheckedIds(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(CHECKED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is number => typeof id === "number"));
  } catch {
    return new Set();
  }
}

function writeCheckedIds(ids: Set<number>) {
  try {
    window.localStorage.setItem(CHECKED_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota */
  }
}

export default function PossibleBarcodePage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [scanned, setScanned] = useState("");
  const [exact, setExact] = useState<ProductRow | null>(null);
  const [candidates, setCandidates] = useState<BarcodeCandidate[]>([]);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(() => new Set());
  const [listFilter, setListFilter] = useState("");
  const { toast, showToast, hideToast } = useAppToast();

  const inputRef = useRef<HTMLInputElement>(null);
  const autoScanHandled = useRef("");
  const scanInFlight = useRef(false);

  function loadProducts() {
    setLoading(true);
    return listAllProducts()
      .then((rows) => {
        setProducts(rows);
        setLoadError(null);
        return rows;
      })
      .catch((err) => {
        setProducts([]);
        setLoadError(getErrorMessage(err, "Products load nahi hue."));
        return [] as ProductRow[];
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setCheckedIds(readCheckedIds());
    void loadProducts();
    inputRef.current?.focus();
  }, []);

  function markChecked(...ids: number[]) {
    if (ids.length === 0) return;
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      writeCheckedIds(next);
      return next;
    });
  }

  function resetChecked() {
    if (!window.confirm("Checked list reset? Saari items dubara dikhengi.")) return;
    const empty = new Set<number>();
    setCheckedIds(empty);
    writeCheckedIds(empty);
    showToast("Checklist reset ho gayi.", "info");
  }

  const unchecked = useMemo(() => {
    const q = listFilter.trim().toLowerCase();
    return products
      .filter((p) => !checkedIds.has(p.id))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.barcode?.toLowerCase().includes(q) ?? false)
        );
      });
  }, [products, checkedIds, listFilter]);

  const checkedCount = useMemo(
    () => products.filter((p) => checkedIds.has(p.id)).length,
    [products, checkedIds],
  );

  function runLookup(code: string, catalog: ProductRow[] = products) {
    const trimmed = code.trim();
    if (!trimmed) return;
    scanInFlight.current = true;
    autoScanHandled.current = trimmed;
    setScanned(trimmed);
    setBarcode("");

    const result = findPossibleBarcodeCandidates(catalog, trimmed);
    const exactRow = result.exact
      ? catalog.find((p) => p.id === result.exact!.id) ?? null
      : null;
    setExact(exactRow);
    setCandidates(result.candidates);

    if (exactRow) {
      markChecked(exactRow.id);
    }

    scanInFlight.current = false;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  useEffect(() => {
    const q = barcode.trim();
    if (!q) {
      autoScanHandled.current = "";
      return;
    }
    if (!/^\d{10,}$/.test(q)) return;
    if (loading || scanInFlight.current) return;
    if (autoScanHandled.current === q) return;

    const timer = window.setTimeout(() => {
      if (autoScanHandled.current === q || scanInFlight.current) return;
      runLookup(q);
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barcode, loading, products]);

  async function approve(candidate: BarcodeCandidate) {
    if (approvingId !== null) return;
    setApprovingId(candidate.product.id);
    try {
      const res = await updateProduct(candidate.product.id, {
        barcode: candidate.fullBarcode,
      });
      showToast(
        `Barcode update: ${candidate.storedBarcode} → ${candidate.fullBarcode}`,
        "success",
      );
      markChecked(candidate.product.id);
      const next = products.map((p) => (p.id === res.data.id ? res.data : p));
      setProducts(next);
      runLookup(candidate.fullBarcode, next);
    } catch (err) {
      showToast(getErrorMessage(err, "Barcode update fail ho gaya."), "error");
    } finally {
      setApprovingId(null);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  return (
    <AdminShell
      title="Possible barcode"
      eyebrow="Truncated / broken barcodes fix — scan full code, approve match"
      allowedRoles={["owner", "manager"]}
    >
      {loadError && <PageAlert message={loadError} tone="error" />}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 xl:mx-0 xl:max-w-none">
          <PagePanel className="p-6">
            <div className="mb-4 flex flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <ScanSearch className="h-6 w-6" />
              </span>
              <h2 className="text-lg font-black text-foreground">Scan full barcode</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                Jo items skip-3 rule se match nahi hue, un ke truncated barcodes yahan se milenge.
                Approve / already-correct pe item checklist se hide ho jayegi.
              </p>
            </div>

            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                value={barcode}
                disabled={loading}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runLookup(e.currentTarget.value);
                  }
                }}
                placeholder={loading ? "Products load ho rahe hain…" : "Scanner se barcode scan karo…"}
                className={cn(inputCls, "disabled:opacity-60")}
              />
            </div>
            {loading && (
              <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Catalog load…
              </p>
            )}
          </PagePanel>

          {scanned && (
            <PagePanel className="overflow-hidden">
              <div className="border-b border-border/70 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Scanned
                </p>
                <p className="mt-0.5 font-mono text-base font-black text-foreground">{scanned}</p>
              </div>

              {exact ? (
                <div className="flex items-start gap-3 px-4 py-5 text-sm">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
                  <div>
                    <p className="font-bold text-foreground">Already correct</p>
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-semibold text-foreground">{exact.name}</span>
                      {" "}pe yeh barcode pehle se set hai — checklist se hide.
                    </p>
                  </div>
                </div>
              ) : candidates.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Koi possible match nahi mila. Manual inventory edit se barcode set karo, ya
                  re-scan check karo.
                </div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {candidates.map((c) => {
                    const product = products.find((p) => p.id === c.product.id) ?? c.product;
                    const busy = approvingId === c.product.id;
                    return (
                      <li
                        key={c.product.id}
                        className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="truncate font-bold text-foreground">{product.name}</p>
                            <StatusPill tone="info">{c.reason}</StatusPill>
                          </div>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">
                            {c.storedBarcode}
                            <span className="mx-1 text-border">→</span>
                            <span className="font-semibold text-foreground">{c.fullBarcode}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Stock {Number(product.stock_qty ?? 0)} ·{" "}
                            {formatMoney(Number(product.sell_price ?? 0))}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          disabled={approvingId !== null}
                          onClick={() => void approve(c)}
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PackageCheck className="h-4 w-4" />
                          )}
                          {busy ? "Updating…" : "Approve"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PagePanel>
          )}
        </div>

        <PagePanel className="flex max-h-[calc(100vh-10rem)] flex-col overflow-hidden self-start">
          <PanelHeader
            title="Unchecked items"
            meta={`${unchecked.length} left · ${checkedCount} checked`}
            actions={
              <button
                type="button"
                onClick={resetChecked}
                title="Reset checklist"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            }
          />
          <div className="border-b border-border/70 px-3 py-2">
            <input
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              placeholder="Filter unchecked…"
              className="h-9 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
          </div>
          {loading ? (
            <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </p>
          ) : unchecked.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {products.length === 0
                ? "Koi product nahi."
                : listFilter.trim()
                  ? "Filter se koi unchecked match nahi."
                  : "Sab check ho gaye ✅"}
            </div>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-border/70 overflow-y-auto">
              {unchecked.map((p) => (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-foreground">{p.name}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {p.barcode || "no barcode"}
                    </p>
                  </div>
                  <button
                    type="button"
                    title="Mark checked (hide)"
                    onClick={() => markChecked(p.id)}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-success/10 hover:text-success"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PagePanel>
      </div>

      <AppToast toast={toast} onDismiss={hideToast} />
    </AdminShell>
  );
}
