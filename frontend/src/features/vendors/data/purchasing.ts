import type { UnitType } from "@/features/pos/types";

export const PURCHASE_CATEGORIES = [
  "Grains & Pulses",
  "Cooking",
  "Dairy",
  "Beverages",
  "Snacks",
  "Household",
] as const;

export const UNITS: UnitType[] = ["pcs", "kg", "g", "dozen", "litre", "pack"];

export interface PurchaseProduct {
  barcode: string;
  name: string;
  category: string;
  unit: UnitType;
  /** current moving-average cost */
  avgCost: number;
  /** cost on the previous goods-received */
  lastCost: number;
  stock: number;
  sellPrice: number;
}

/** Moving (weighted) average — plan §2.3. */
export function newAverageCost(
  oldQty: number,
  oldAvg: number,
  receivedQty: number,
  receivedCost: number,
): number {
  const totalQty = oldQty + receivedQty;
  if (totalQty <= 0) return receivedCost;
  return (oldQty * oldAvg + receivedQty * receivedCost) / totalQty;
}
