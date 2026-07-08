import {
  healProductBarcode as persistHealedBarcode,
} from "@/lib/admin-api";
import {
  LEGACY_BARCODE_PREFIX_SKIP,
  barcodeMatchesQuery,
  findExactBarcodeRow,
  findLegacySkippedBarcodeRows,
  legacyTruncatedFromScan,
  normalizeBarcode,
  resolveScannedBarcodeRow,
} from "@/lib/barcode";
import type { Product } from "../types";

export {
  LEGACY_BARCODE_PREFIX_SKIP,
  legacyTruncatedFromScan,
  normalizeBarcode,
};

export function findExactBarcode(products: Product[], code: string): Product | undefined {
  return findExactBarcodeRow(products, code);
}

export function findLegacySkippedBarcodeMatches(products: Product[], scanned: string): Product[] {
  return findLegacySkippedBarcodeRows(products, scanned);
}

export function productMatchesBarcode(p: Product, raw: string): boolean {
  return barcodeMatchesQuery(p.barcode, raw);
}

export type BarcodeResolveResult =
  | { status: "exact"; product: Product }
  | { status: "legacy"; product: Product; fullBarcode: string; oldBarcode: string }
  | { status: "ambiguous"; products: Product[] }
  | { status: "miss" };

export function resolveScannedBarcode(products: Product[], raw: string): BarcodeResolveResult {
  const resolved = resolveScannedBarcodeRow(products, raw);
  if (resolved.status === "exact") return { status: "exact", product: resolved.row };
  if (resolved.status === "legacy") {
    return {
      status: "legacy",
      product: resolved.row,
      fullBarcode: resolved.fullBarcode,
      oldBarcode: resolved.oldBarcode,
    };
  }
  if (resolved.status === "ambiguous") {
    return { status: "ambiguous", products: resolved.rows };
  }
  return { status: "miss" };
}

/** Persist healed barcode when old truncated code is found via full scan. */
export async function healProductBarcode(productId: string, fullBarcode: string): Promise<void> {
  await persistHealedBarcode(Number(productId), fullBarcode);
}
