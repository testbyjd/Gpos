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
