import {
  LEGACY_BARCODE_PREFIX_SKIP,
  MIN_TRUNCATED_BARCODE_LEN,
  normalizeBarcode,
} from "@/lib/barcode";

export const MAX_BARCODE_GAP = 10;
export const MAX_BARCODE_CANDIDATES = 10;

export type BarcodeMatchReason = "skip-3" | "suffix of scan" | "prefix of scan" | "substring of scan";

export interface BarcodeCandidateProduct {
  id: number;
  name: string;
  barcode: string | null;
  stock_qty?: number | string;
  sell_price?: number | string;
}

export interface BarcodeCandidate {
  product: BarcodeCandidateProduct;
  storedBarcode: string;
  fullBarcode: string;
  gap: number;
  reason: BarcodeMatchReason;
}

function matchReason(stored: string, scanned: string): BarcodeMatchReason {
  if (scanned.endsWith(stored)) {
    if (
      scanned.length === stored.length + LEGACY_BARCODE_PREFIX_SKIP &&
      scanned.slice(LEGACY_BARCODE_PREFIX_SKIP) === stored
    ) {
      return "skip-3";
    }
    return "suffix of scan";
  }
  if (scanned.startsWith(stored)) return "prefix of scan";
  return "substring of scan";
}

/**
 * Find inventory rows whose stored barcode looks like a truncated form of the scan.
 * Requires explicit approve before updating — not for auto-heal.
 */
export function findPossibleBarcodeCandidates(
  products: BarcodeCandidateProduct[],
  rawScan: string,
): { exact: BarcodeCandidateProduct | null; candidates: BarcodeCandidate[] } {
  const scanned = normalizeBarcode(rawScan);
  if (!scanned) return { exact: null, candidates: [] };

  const exact =
    products.find((p) => normalizeBarcode(p.barcode) === scanned) ?? null;
  if (exact) return { exact, candidates: [] };

  const candidates: BarcodeCandidate[] = [];
  for (const product of products) {
    const stored = normalizeBarcode(product.barcode);
    if (!stored || stored.length < MIN_TRUNCATED_BARCODE_LEN) continue;

    const gap = scanned.length - stored.length;
    if (gap < 1 || gap > MAX_BARCODE_GAP) continue;
    if (!scanned.includes(stored)) continue;

    candidates.push({
      product,
      storedBarcode: product.barcode?.trim() || stored,
      fullBarcode: rawScan.trim(),
      gap,
      reason: matchReason(stored, scanned),
    });
  }

  candidates.sort((a, b) => {
    const lenDiff = b.storedBarcode.length - a.storedBarcode.length;
    if (lenDiff !== 0) return lenDiff;
    const stockDiff = Number(b.product.stock_qty ?? 0) - Number(a.product.stock_qty ?? 0);
    if (stockDiff !== 0) return stockDiff;
    return a.product.name.localeCompare(b.product.name);
  });

  return { exact: null, candidates: candidates.slice(0, MAX_BARCODE_CANDIDATES) };
}
