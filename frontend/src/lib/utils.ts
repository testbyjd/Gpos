import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PKR = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format a number as PKR currency, e.g. Rs 1,250 */
export function formatMoney(amount: number): string {
  return PKR.format(amount).replace("PKR", "Rs").trim();
}

/** Format a quantity respecting fractional units (kg, g, etc.). */
export function formatQty(qty: number, unit: string): string {
  const isWhole = Number.isInteger(qty);
  const value = isWhole ? qty.toString() : qty.toFixed(3).replace(/\.?0+$/, "");
  return `${value} ${unit}`;
}
