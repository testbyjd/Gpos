export type UnitType = "pcs" | "kg" | "g" | "dozen" | "litre" | "pack";

export interface Product {
  id: string;
  name: string;
  category: string;
  /** barcode/SKU is optional for loose/unbarcoded items */
  barcode?: string;
  price: number;
  /** Average / unit cost — line discount cannot go below this. */
  cost: number;
  unit: UnitType;
  /** true for loose goods sold in fractional units (sugar, pulses, flour) */
  fractional: boolean;
  stock: number;
  emoji?: string;
  imageUrl?: string;
}

export interface CartLine {
  product: Product;
  qty: number;
  /** Rupees off this line (capped at margin: (price − cost) × qty). */
  discount?: number;
}

export type PaymentMethod =
  | "cash"
  | "card"
  | "easypaisa"
  | "jazzcash"
  | "bank_transfer"
  | "khata"
  | "split";

export interface PosCustomer {
  id: number;
  name: string;
  phone?: string | null;
  balance: number;
}

export interface HeldCart {
  id: string;
  label: string;
  lines: CartLine[];
  customer: string;
  customerId: number | null;
  discount?: number;
  discountRecipientName?: string;
  discountReason?: string;
  heldAt: number;
}
