import { healProductBarcode as persistHealedBarcode } from "@/lib/admin-api";
import type { Product } from "../types";

/** Old scanner custom rule: first 3 digits stripped before sending. */
export const LEGACY_BARCODE_PREFIX_SKIP = 3;

/** Truncated barcode must be at least this long to heal safely. */
const MIN_TRUNCATED_LEN = 8;

export function normalizeBarcode(code: string): string {
  return code.trim().toLowerCase();
}

export function findExactBarcode(products: Product[], code: string): Product | undefined {
  const c = normalizeBarcode(code);
  if (!c) return undefined;
  return products.find((p) => normalizeBarcode(p.barcode ?? "") === c);
}

/** Stored barcode that matches full scan after stripping first 3 digits. */
export function legacyTruncatedFromScan(scanned: string): string | null {
  const full = normalizeBarcode(scanned);
  if (full.length <= LEGACY_BARCODE_PREFIX_SKIP + MIN_TRUNCATED_LEN - 1) {
    return null;
  }
  const truncated = full.slice(LEGACY_BARCODE_PREFIX_SKIP);
  return truncated.length >= MIN_TRUNCATED_LEN ? truncated : null;
}

/**
 * Match products stored with the old scanner rule (first 3 digits missing).
 * scanned "8961014258348" ↔ stored "1014258348"
 */
export function findLegacySkippedBarcodeMatches(products: Product[], scanned: string): Product[] {
  const truncated = legacyTruncatedFromScan(scanned);
  if (!truncated) return [];

  return products.filter((p) => {
    const stored = normalizeBarcode(p.barcode ?? "");
    return stored !== "" && stored === truncated;
  });
}

/** True when product barcode matches query exactly or via skip-3 legacy rule. */
export function productMatchesBarcode(p: Product, raw: string): boolean {
  const q = normalizeBarcode(raw);
  const stored = normalizeBarcode(p.barcode ?? "");
  if (!q || !stored) return false;
  if (stored === q || stored.includes(q) || q.includes(stored)) return true;
  const truncated = legacyTruncatedFromScan(q);
  return truncated !== null && stored === truncated;
}

export type BarcodeResolveResult =
  | { status: "exact"; product: Product }
  | { status: "legacy"; product: Product; fullBarcode: string; oldBarcode: string }
  | { status: "ambiguous"; products: Product[] }
  | { status: "miss" };

export function resolveScannedBarcode(products: Product[], raw: string): BarcodeResolveResult {
  const code = raw.trim();
  if (!code) return { status: "miss" };

  const exact = findExactBarcode(products, code);
  if (exact) return { status: "exact", product: exact };

  const legacy = findLegacySkippedBarcodeMatches(products, code);
  if (legacy.length === 1) {
    return {
      status: "legacy",
      product: legacy[0],
      fullBarcode: code,
      oldBarcode: legacy[0].barcode ?? "",
    };
  }
  if (legacy.length > 1) {
    return { status: "ambiguous", products: legacy };
  }

  return { status: "miss" };
}

/** Persist healed barcode when old truncated code is found via full scan. */
export async function healProductBarcode(productId: string, fullBarcode: string): Promise<void> {
  await persistHealedBarcode(Number(productId), fullBarcode);
}
