/** Old scanner custom rule: first 3 digits stripped before sending. */
export const LEGACY_BARCODE_PREFIX_SKIP = 3;

/** Truncated barcode must be at least this long to heal safely. */
export const MIN_TRUNCATED_BARCODE_LEN = 8;

export function normalizeBarcode(code: string | null | undefined): string {
  return (code ?? "").trim().toLowerCase();
}

export function barcodesEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeBarcode(a);
  const right = normalizeBarcode(b);
  return left !== "" && left === right;
}

/** Stored barcode that matches full scan after stripping first 3 digits. */
export function legacyTruncatedFromScan(scanned: string): string | null {
  const full = normalizeBarcode(scanned);
  if (full.length <= LEGACY_BARCODE_PREFIX_SKIP + MIN_TRUNCATED_BARCODE_LEN - 1) {
    return null;
  }
  const truncated = full.slice(LEGACY_BARCODE_PREFIX_SKIP);
  return truncated.length >= MIN_TRUNCATED_BARCODE_LEN ? truncated : null;
}

export function findExactBarcodeRow<T extends { barcode?: string | null }>(
  rows: T[],
  code: string,
): T | undefined {
  const c = normalizeBarcode(code);
  if (!c) return undefined;
  return rows.find((row) => normalizeBarcode(row.barcode) === c);
}

export function findLegacySkippedBarcodeRows<T extends { barcode?: string | null }>(
  rows: T[],
  scanned: string,
): T[] {
  const truncated = legacyTruncatedFromScan(scanned);
  if (!truncated) return [];
  return rows.filter((row) => {
    const stored = normalizeBarcode(row.barcode);
    return stored !== "" && stored === truncated;
  });
}

export type BarcodeRowResolveResult<T> =
  | { status: "exact"; row: T }
  | { status: "legacy"; row: T; fullBarcode: string; oldBarcode: string }
  | { status: "ambiguous"; rows: T[] }
  | { status: "miss" };

export function resolveScannedBarcodeRow<T extends { barcode?: string | null }>(
  rows: T[],
  raw: string,
): BarcodeRowResolveResult<T> {
  const code = raw.trim();
  if (!code) return { status: "miss" };

  const exact = findExactBarcodeRow(rows, code);
  if (exact) return { status: "exact", row: exact };

  const legacy = findLegacySkippedBarcodeRows(rows, code);
  if (legacy.length === 1) {
    return {
      status: "legacy",
      row: legacy[0],
      fullBarcode: code,
      oldBarcode: legacy[0].barcode ?? "",
    };
  }
  if (legacy.length > 1) {
    return { status: "ambiguous", rows: legacy };
  }

  return { status: "miss" };
}

/** True when barcode matches query exactly or via skip-3 legacy rule. */
export function barcodeMatchesQuery(
  barcode: string | null | undefined,
  raw: string,
): boolean {
  const q = normalizeBarcode(raw);
  const stored = normalizeBarcode(barcode);
  if (!q || !stored) return false;
  if (stored === q || stored.includes(q) || q.includes(stored)) return true;
  const truncated = legacyTruncatedFromScan(q);
  return truncated !== null && stored === truncated;
}
