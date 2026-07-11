import type { PaymentMethod } from "./types";

/** Human labels for POS, receipts, and reports. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
  bank_transfer: "Bank Transfer",
  khata: "Khata",
  split: "Split",
};

/** Methods shown in the More pay picker (excludes khata — separate button). */
export const MORE_PAY_METHODS: PaymentMethod[] = [
  "cash",
  "card",
  "easypaisa",
  "jazzcash",
  "bank_transfer",
];

export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABEL[method as PaymentMethod] ?? method;
}

export function requiresPaymentReference(method: PaymentMethod): boolean {
  return method !== "cash";
}
