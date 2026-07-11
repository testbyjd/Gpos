import type { CartLine } from "./types";

export const DISCOUNT_APPROVAL_THRESHOLD_PERCENT = 5;

export function discountPercent(subtotal: number, discount: number): number {
  if (subtotal <= 0) return 0;
  return (discount / subtotal) * 100;
}

/** True when discount is strictly more than 5% of subtotal. */
export function requiresDiscountApproval(subtotal: number, discount: number): boolean {
  if (subtotal <= 0 || discount <= 0) return false;
  return discount > subtotal * (DISCOUNT_APPROVAL_THRESHOLD_PERCENT / 100);
}

export function validateDiscountApproval(
  subtotal: number,
  discount: number,
  recipientName: string,
  reason: string,
): string | null {
  if (!requiresDiscountApproval(subtotal, discount)) return null;
  if (!recipientName.trim()) return "5% se zyada discount pe naam likhna zaroori hai.";
  if (!reason.trim()) return "5% se zyada discount pe reason likhna zaroori hai.";
  return null;
}

export function lineGross(line: CartLine): number {
  return Math.round(line.product.price * line.qty * 100) / 100;
}

/** Max rupees off so net line stays at/above cost × qty. */
export function maxLineDiscount(line: CartLine): number {
  const gross = lineGross(line);
  const cost = Math.max(0, Number(line.product.cost) || 0);
  const minNet = Math.round(cost * line.qty * 100) / 100;
  return Math.max(0, Math.round((gross - minNet) * 100) / 100);
}

/** ≤ 20% of max margin discount — free, no PIN. */
export const LINE_DISCOUNT_FREE_PERCENT = 20;

export function freeLineDiscountCap(line: CartLine): number {
  const max = maxLineDiscount(line);
  return Math.round(max * (LINE_DISCOUNT_FREE_PERCENT / 100) * 100) / 100;
}

/**
 * - over_max: reject (current behaviour)
 * - needs_pin: above free 20% of max, within max
 * - free: within 20% of max
 */
export function lineDiscountGate(
  line: CartLine,
  amount: number,
): "free" | "needs_pin" | "over_max" {
  const max = maxLineDiscount(line);
  const rounded = Math.max(0, Math.round(amount * 100) / 100);
  if (rounded > max) return "over_max";
  if (rounded > freeLineDiscountCap(line)) return "needs_pin";
  return "free";
}

export function lineDiscountAmount(line: CartLine): number {
  const max = maxLineDiscount(line);
  const raw = Math.max(0, line.discount ?? 0);
  return Math.min(max, Math.round(raw * 100) / 100);
}

export function lineNet(line: CartLine): number {
  return Math.max(0, lineGross(line) - lineDiscountAmount(line));
}

export function cartSubtotal(lines: CartLine[]): number {
  return Math.round(lines.reduce((s, l) => s + lineGross(l), 0) * 100) / 100;
}

export function cartLineDiscountTotal(lines: CartLine[]): number {
  return Math.round(lines.reduce((s, l) => s + lineDiscountAmount(l), 0) * 100) / 100;
}

