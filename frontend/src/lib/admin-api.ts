import { apiFetch } from "./api";

export interface ProductRow {
  id: number;
  category_id: number | null;
  category: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  unit: string;
  avg_cost: number;
  sell_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  expiry_date: string | null;
  is_active: boolean;
}

export interface VendorRow {
  id: number;
  name: string;
  phone?: string | null;
  balance: string | number;
  is_active: boolean;
}

export interface CustomerRow {
  id: number;
  code: string | null;
  name: string;
  phone: string | null;
  balance: string | number;
  is_active: boolean;
}

export interface PurchaseRow {
  id: number;
  grn_no: string;
  vendor?: VendorRow;
  subtotal: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
  received_at: string;
  lines: Array<{ id: number; product?: ProductRow; qty: string | number; unit_cost: string | number }>;
}

export function listProducts() {
  return apiFetch<{ data: ProductRow[] }>("/inventory/products?per_page=500");
}

export interface CategoryRow {
  id: number;
  name: string;
}

export interface ProductInput {
  name: string;
  barcode?: string | null;
  sku?: string | null;
  category_id?: number | null;
  unit: string;
  sell_price: number;
  avg_cost?: number;
  stock_qty?: number;
  low_stock_threshold?: number;
  expiry_date?: string | null;
}

export function listCategories() {
  return apiFetch<{ data: CategoryRow[] }>("/inventory/categories");
}

export function createProduct(data: ProductInput) {
  return apiFetch<{ data: ProductRow }>("/inventory/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateProduct(id: number, data: Partial<ProductInput>) {
  return apiFetch<{ data: ProductRow }>(`/inventory/products/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteProduct(id: number) {
  return apiFetch<{ ok: boolean; action: "deleted" | "deactivated"; message: string }>(
    `/inventory/products/${id}`,
    { method: "DELETE" },
  );
}

export function listCustomers() {
  return apiFetch<{ data: CustomerRow[] }>("/customers");
}

export function createCustomer(data: { name: string; phone?: string | null; code?: string | null }) {
  return apiFetch<{ data: CustomerRow }>("/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listVendors() {
  return apiFetch<{ data: VendorRow[] }>("/vendors");
}

export function createVendor(data: { name: string; phone?: string | null; address?: string | null }) {
  return apiFetch<{ data: VendorRow }>("/vendors", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface LedgerEntry {
  id: number;
  type: string;
  amount: string | number;
  balance_after: string | number;
  note: string | null;
  created_at: string;
}

export function getCustomerLedger(id: number) {
  return apiFetch<{ customer: CustomerRow; entries: LedgerEntry[] }>(`/customers/${id}/ledger`);
}

export interface SalePayment {
  id: number;
  method: string;
  amount: string | number;
}

export interface SaleRow {
  id: number;
  invoice_no: string;
  customer_id: number | null;
  customer?: CustomerRow | null;
  cashier?: { id: number; name: string } | null;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  sold_at: string;
  payments?: SalePayment[];
}

export interface SaleDetail extends SaleRow {
  lines: Array<{
    id: number;
    qty: string | number;
    unit_price: string | number;
    line_total: string | number;
    product?: { id: number; name: string; barcode: string | null } | null;
  }>;
}

export function listSales(customerId?: number) {
  const qs = customerId ? `?customer_id=${customerId}` : "";
  return apiFetch<{ data: SaleRow[]; meta: { current_page: number; last_page: number; total: number } }>(`/sales${qs}`);
}

export function getSale(id: number) {
  return apiFetch<{ data: SaleDetail }>(`/sales/${id}`);
}

export function recordCustomerRepayment(customerId: number, amount: number, note?: string) {
  return apiFetch<{ data: LedgerEntry; customer: CustomerRow }>(`/customers/${customerId}/repayments`, {
    method: "POST",
    body: JSON.stringify({ amount, note }),
  });
}

export interface VendorPaymentRow {
  id: number;
  amount: string | number;
  note: string | null;
  created_at: string;
  purchase?: { id: number; grn_no: string } | null;
}

export interface PurchaseReturnRow {
  id: number;
  return_no: string;
  subtotal: string | number;
  note: string | null;
  returned_at: string;
  lines: Array<{ id: number; qty: string | number; unit_cost: string | number; product?: { id: number; name: string } | null }>;
}

export function getVendorDetail(id: number) {
  return apiFetch<{ vendor: VendorRow; purchases: PurchaseRow[]; payments: VendorPaymentRow[]; returns: PurchaseReturnRow[] }>(`/vendors/${id}`);
}

export function createPurchaseReturn(data: {
  vendor_id: number;
  purchase_id?: number;
  note?: string;
  lines: Array<{ product_id: number; qty: number; unit_cost: number }>;
}) {
  return apiFetch<{ data: PurchaseReturnRow }>("/purchase-returns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export interface SaleReturnRow {
  id: number;
  return_no: string;
  total: string | number;
  refund_method: string;
  note: string | null;
  returned_at: string;
}

export function createSaleReturn(data: {
  sale_id?: number;
  customer_id?: number | null;
  refund_method: "cash" | "khata";
  note?: string;
  lines: Array<{ product_id: number; qty: number; unit_price: number }>;
}) {
  return apiFetch<{ data: SaleReturnRow }>("/sale-returns", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listPurchases() {
  return apiFetch<{ data: PurchaseRow[] }>("/purchases");
}

export function getPayables() {
  return apiFetch<{ total_payable: number; vendors: VendorRow[]; open_invoices: PurchaseRow[] }>("/payables");
}

export function recordVendorPayment(purchaseId: number, amount: number, note?: string) {
  return apiFetch<{ ok: boolean; message: string; purchase: PurchaseRow }>("/payables/payments", {
    method: "POST",
    body: JSON.stringify({ purchase_id: purchaseId, amount, note }),
  });
}

export function getDashboard() {
  return apiFetch<{
    metrics: { net_sales: number; cash_in_till: number; card_wallet: number; khata_extended: number };
    recent_sales: Array<{ invoice_no: string; customer: string; amount: number; payment: string; time: string }>;
    low_stock: Array<{ id: number; name: string; unit: string; stock_qty: string | number; low_stock_threshold: string | number }>;
    receivable_total: number;
  }>("/reports/dashboard");
}

export function getReports() {
  return apiFetch<{
    gross_sales: number;
    gross_profit: number;
    net_receivable: number;
    payment_breakdown: Array<{ method: string; amount: number }>;
    profit_by_category: Array<{ category: string; sales: number; cost: number; profit: number; margin: number }>;
    top_items: Array<{ name: string; qty: number; unit: string; amount: number }>;
  }>("/reports/summary");
}

export interface ReceiptSettings {
  shop_name: string;
  tagline: string;
  address: string;
  phone: string;
  footer_note: string;
  paper_width: "58" | "80";
  show_cashier: boolean;
  show_customer: boolean;
}

export function getReceiptSettings() {
  return apiFetch<{ data: ReceiptSettings }>("/settings/receipt");
}

export function updateReceiptSettings(data: ReceiptSettings) {
  return apiFetch<{ ok: boolean; message: string; data: ReceiptSettings }>("/settings/receipt", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getUsersSettings() {
  return apiFetch<{
    data: Array<{ id: number; name: string; email: string; role: string; is_active: boolean; store_id: number | null }>;
    settings: {
      store_name: string;
      currency: string;
      timezone: string;
      print_bridge: Array<{ device: string; connection: string; state: string }>;
    };
  }>("/users");
}

export function updateUserPassword(id: number, password: string) {
  return apiFetch<{ ok: boolean; message: string }>(`/users/${id}/password`, {
    method: "PATCH",
    body: JSON.stringify({ password }),
  });
}

export function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: "owner" | "manager" | "cashier";
  pin?: string;
}) {
  return apiFetch<{ data: { id: number; name: string; email: string; role: string } }>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
