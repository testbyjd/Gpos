export const PURCHASE_PAYMENT_TERMS = [
  { label: "On account (udhar)", value: "on_account", payFull: false },
  { label: "Pay now (cash)", value: "cash", payFull: true },
  { label: "Bank transfer", value: "bank_transfer", payFull: true },
] as const;

export type PurchasePaymentTerm = (typeof PURCHASE_PAYMENT_TERMS)[number]["value"];

export function purchasePaidAmount(subtotal: number, terms: PurchasePaymentTerm): number {
  const option = PURCHASE_PAYMENT_TERMS.find((t) => t.value === terms);
  return option?.payFull ? subtotal : 0;
}

export function purchaseTermLabel(value: string): string {
  return PURCHASE_PAYMENT_TERMS.find((t) => t.value === value)?.label ?? value;
}

/** Suggested paid amount when terms change (user can override). */
export function purchaseSuggestedPaid(subtotal: number, terms: PurchasePaymentTerm): number {
  const option = PURCHASE_PAYMENT_TERMS.find((t) => t.value === terms);
  return option?.payFull ? subtotal : 0;
}

export function clampPaidAmount(subtotal: number, raw: string): number {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(subtotal, Math.round(n * 100) / 100);
}
