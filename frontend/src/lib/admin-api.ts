import { API_BASE, ApiError, apiFetch, apiUpload } from "./api";
import { barcodesEqual } from "./barcode";

export interface ProductRow {
  id: number;
  category_id: number | null;
  category: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  unit: string;
  unit_precision?: number;
  fractional?: boolean;
  avg_cost: number;
  sell_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  expiry_date: string | null;
  is_active: boolean;
  image_url?: string | null;
  /** Last GRN vendor (if ever purchased). */
  vendor_name?: string | null;
}

export type VendorContactRole = "salesperson" | "delivery" | "accounts" | "owner" | "other";

export interface VendorContact {
  id?: number;
  name: string;
  phone?: string | null;
  role: VendorContactRole;
  note?: string | null;
}

export interface VendorRow {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  balance: string | number;
  is_active: boolean;
  ranking?: number;
  contacts?: VendorContact[];
}

export interface CustomerRow {
  id: number;
  code: string | null;
  name: string;
  phone: string | null;
  balance: string | number;
  is_active: boolean;
  ranking?: number;
}

export interface PurchaseRow {
  id: number;
  grn_no: string;
  receiving_status?: "open" | "closed";
  vendor?: VendorRow;
  subtotal: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
  received_at: string;
  lines: Array<{ id: number; product?: ProductRow; qty: string | number; unit_cost: string | number }>;
}

export interface ListProductsParams {
  page?: number;
  perPage?: number;
  q?: string;
  barcode?: string;
  categoryId?: number;
  lowStock?: boolean;
  stockOk?: boolean;
  expiringWithin?: number;
  withSummary?: boolean;
}

export interface ProductsListResponse {
  data: ProductRow[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
  summary?: {
    total: number;
    low_stock: number;
    expiring_soon: number;
    inventory_value: number;
  };
}

export function listProducts(params: ListProductsParams = {}) {
  const q = new URLSearchParams();
  q.set("per_page", String(params.perPage ?? 100));
  if (params.page) q.set("page", String(params.page));
  if (params.q?.trim()) q.set("q", params.q.trim());
  if (params.barcode?.trim()) q.set("barcode", params.barcode.trim());
  if (params.categoryId) q.set("category_id", String(params.categoryId));
  if (params.lowStock) q.set("low_stock", "1");
  if (params.stockOk) q.set("stock_ok", "1");
  if (params.expiringWithin) q.set("expiring_within", String(params.expiringWithin));
  if (params.withSummary) q.set("with_summary", "1");
  const qs = q.toString();
  return apiFetch<ProductsListResponse>(`/inventory/products${qs ? `?${qs}` : ""}`);
}

export async function listAllProducts(perPage = 200): Promise<ProductRow[]> {
  const first = await listProducts({ page: 1, perPage });
  if (first.meta.last_page <= 1) return first.data;

  const rest = await Promise.all(
    Array.from({ length: first.meta.last_page - 1 }, (_, i) =>
      listProducts({ page: i + 2, perPage }),
    ),
  );

  return [...first.data, ...rest.flatMap((r) => r.data)];
}

/** Purchase/POS pickers — saari active products (paginated fetch). */
export async function listProductsBulk() {
  return { data: await listAllProducts() };
}

export async function findProductByBarcode(barcode: string): Promise<ProductRow | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  const res = await listProducts({ barcode: trimmed, perPage: 1, page: 1 });
  return res.data[0] ?? null;
}

export function barcodesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return barcodesEqual(a, b);
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
  unit_precision?: number;
  sell_price: number;
  avg_cost?: number;
  stock_qty?: number;
  low_stock_threshold?: number;
  expiry_date?: string | null;
}

export function listCategories() {
  return apiFetch<{ data: CategoryRow[] }>("/inventory/categories");
}

export function createCategory(name: string) {
  return apiFetch<{ data: CategoryRow }>("/inventory/categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
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

/** Cashier-safe: upgrade truncated barcode → full scan (legacy skip-3 rule). */
export function healProductBarcode(id: number, barcode: string) {
  return apiFetch<{ data: ProductRow }>(`/inventory/products/${id}/heal-barcode`, {
    method: "POST",
    body: JSON.stringify({ barcode }),
  });
}

export function deleteProduct(id: number) {
  return apiFetch<{ ok: boolean; action: "deleted" | "deactivated"; message: string }>(
    `/inventory/products/${id}`,
    { method: "DELETE" },
  );
}

export function uploadProductImage(id: number, file: File) {
  const form = new FormData();
  form.append("image", file);
  return apiUpload<{ data: ProductRow }>(`/inventory/products/${id}/image`, form);
}

export function deleteProductImage(id: number) {
  return apiUpload<{ data: ProductRow }>(`/inventory/products/${id}/image`, new FormData(), "DELETE");
}

export interface StockWriteOffRow {
  id: number;
  product_id: number;
  qty: number;
  unit_cost: number;
  loss_value: number;
  reason: string;
  note: string | null;
  created_at: string;
  product?: { id: number; name: string; unit: string; barcode?: string | null };
  creator?: { id: number; name: string };
}

export function createStockWriteOff(data: {
  product_id: number;
  qty: number;
  reason: string;
  note?: string;
}) {
  return apiFetch<{ data: StockWriteOffRow; message: string }>("/inventory/write-offs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listCustomers() {
  return apiFetch<{ data: CustomerRow[] }>("/customers");
}

export function createCustomer(data: { name: string; phone?: string | null; code?: string | null; ranking?: number }) {
  return apiFetch<{ data: CustomerRow }>("/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCustomer(
  id: number,
  data: {
    name?: string;
    phone?: string | null;
    code?: string | null;
    ranking?: number;
    is_active?: boolean;
  },
) {
  return apiFetch<{ data: CustomerRow }>(`/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function listVendors() {
  return apiFetch<{ data: VendorRow[] }>("/vendors");
}

export function createVendor(data: { name: string; phone?: string | null; address?: string | null; ranking?: number }) {
  return apiFetch<{ data: VendorRow }>("/vendors", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateVendor(
  id: number,
  data: {
    name?: string;
    phone?: string | null;
    address?: string | null;
    ranking?: number;
    is_active?: boolean;
    contacts?: VendorContact[];
  },
) {
  return apiFetch<{ data: VendorRow }>(`/vendors/${id}`, {
    method: "PUT",
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
  reference_id?: string | null;
}

export interface SaleRow {
  id: number;
  invoice_no: string;
  customer_id: number | null;
  customer?: CustomerRow | null;
  cashier?: { id: number; name: string } | null;
  subtotal: string | number;
  discount: string | number;
  discount_recipient_name?: string | null;
  discount_reason?: string | null;
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
    product?: { id: number; name: string; barcode: string | null; stock_qty?: string | number; unit?: string } | null;
  }>;
}

export interface SaleSummaryRow {
  id: number;
  invoice_no: string;
  customer: string;
  amount: number;
  payment: string;
  sold_at: string;
}

export interface ListSalesParams {
  customerId?: number;
  paymentMethod?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  perPage?: number;
}

export function listSales(params: ListSalesParams = {}) {
  const q = new URLSearchParams();
  if (params.customerId) q.set("customer_id", String(params.customerId));
  if (params.paymentMethod) q.set("payment_method", params.paymentMethod);
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.q) q.set("q", params.q);
  if (params.page) q.set("page", String(params.page));
  if (params.perPage) q.set("per_page", String(params.perPage));
  const qs = q.toString();
  return apiFetch<{ data: SaleRow[]; meta: { current_page: number; last_page: number; total: number } }>(
    `/sales${qs ? `?${qs}` : ""}`,
  );
}

export interface SaleDiscountSummary {
  today: {
    count: number;
    discount_total: number;
    sales: Array<{
      id: number;
      invoice_no: string;
      discount: number;
      discount_recipient_name: string | null;
      discount_reason: string | null;
      sold_at: string;
    }>;
  };
  month: {
    count: number;
    discount_total: number;
  };
}

export function getSalesDiscountSummary() {
  return apiFetch<SaleDiscountSummary>("/sales/discount-summary");
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

export function getPurchase(id: number) {
  return apiFetch<{ data: PurchaseRow }>(`/purchases/${id}`);
}

export function appendPurchaseLines(
  purchaseId: number,
  data: { paid_amount?: number; lines: Array<Record<string, unknown>> },
) {
  return apiFetch<{ data: PurchaseRow }>(`/purchases/${purchaseId}/lines`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function replacePurchaseLines(
  purchaseId: number,
  data: { paid_amount?: number; lines: Array<Record<string, unknown>> },
) {
  return apiFetch<{ data: PurchaseRow }>(`/purchases/${purchaseId}/lines`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function closePurchase(purchaseId: number) {
  return apiFetch<{ data: PurchaseRow }>(`/purchases/${purchaseId}/close`, { method: "POST" });
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
    sales_today: SaleSummaryRow[];
    sales_today_count: number;
    sales_today_total: number;
    recent_sales: Array<{ invoice_no: string; customer: string; amount: number; payment: string; time: string }>;
    low_stock: Array<{ id: number; name: string; unit: string; stock_qty: string | number; low_stock_threshold: string | number }>;
    receivable_total: number;
  }>("/reports/dashboard");
}

export function getReports(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return apiFetch<{
    range?: { from: string; to: string };
    gross_sales: number;
    gross_profit: number;
    total_discount: number;
    discount_count: number;
    discounts_by_reason: Array<{ reason: string; count: number; amount: number }>;
    net_receivable: number;
    total_write_off_loss: number;
    write_offs_by_reason: Array<{ reason: string; qty: number; loss: number }>;
    recent_write_offs: Array<{
      id: number;
      product: string | null;
      unit: string | null;
      qty: number;
      loss_value: number;
      reason: string;
      note: string | null;
      created_at: string;
    }>;
    payment_breakdown: Array<{ method: string; amount: number }>;
    profit_by_category: Array<{ category: string; sales: number; cost: number; profit: number; margin: number }>;
    top_items: Array<{ name: string; qty: number; unit: string; amount: number }>;
  }>(`/reports/summary${qs ? `?${qs}` : ""}`);
}

export interface ReceiptSettings {
  shop_name: string;
  tagline: string;
  address: string;
  phone: string;
  footer_note: string;
  paper_width: "58" | "80" | "110" | "112";
  show_cashier: boolean;
  show_customer: boolean;
  /** Body text size (px). */
  font_size?: number;
  /** Body font weight 400–900. */
  font_weight?: number;
  /** Shop name size (px). */
  title_size?: number;
  /** Line height multiplier. */
  line_height?: number;
  /** Receipt padding (px). */
  padding?: number;
  /** Gap around dividers (px). */
  section_gap?: number;
}

export const RECEIPT_DESIGN_DEFAULTS = {
  font_size: 12,
  font_weight: 700,
  title_size: 17,
  line_height: 1.35,
  padding: 12,
  section_gap: 7,
} as const;

export function normalizeReceiptSettings(data: Partial<ReceiptSettings> | null | undefined): ReceiptSettings {
  return {
    shop_name: data?.shop_name ?? "Gondal Traders",
    tagline: data?.tagline ?? "",
    address: data?.address ?? "",
    phone: data?.phone ?? "",
    footer_note: data?.footer_note ?? "Shukria! Dobara tashreef laaiye.",
    paper_width: normalizePaperWidth(data?.paper_width),
    show_cashier: data?.show_cashier ?? true,
    show_customer: data?.show_customer ?? true,
    font_size: clampNum(data?.font_size, RECEIPT_DESIGN_DEFAULTS.font_size, 10, 18),
    font_weight: clampNum(data?.font_weight, RECEIPT_DESIGN_DEFAULTS.font_weight, 400, 900),
    title_size: clampNum(data?.title_size, RECEIPT_DESIGN_DEFAULTS.title_size, 12, 26),
    line_height: clampNum(data?.line_height, RECEIPT_DESIGN_DEFAULTS.line_height, 1.1, 1.9),
    padding: clampNum(data?.padding, RECEIPT_DESIGN_DEFAULTS.padding, 4, 24),
    section_gap: clampNum(data?.section_gap, RECEIPT_DESIGN_DEFAULTS.section_gap, 2, 16),
  };
}

function clampNum(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizePaperWidth(value: unknown): ReceiptSettings["paper_width"] {
  if (value === "58" || value === "80" || value === "110" || value === "112") return value;
  return "80";
}

/** Preview CSS width for thermal paper sizes (approx). */
export function receiptWidthPx(paperWidth: ReceiptSettings["paper_width"]): number {
  switch (paperWidth) {
    case "58":
      return 220;
    case "110":
      return 420;
    case "112":
      return 430;
    case "80":
    default:
      return 300;
  }
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

/** Download full DB backup JSON (owner). Triggers browser save dialog. */
export async function downloadDatabaseBackup(): Promise<void> {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("gpos.auth.token") : null;
  const res = await fetch(`${API_BASE}/settings/backup/export`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    let msg = "Backup download fail.";
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (typeof parsed.message === "string" && parsed.message.trim()) msg = parsed.message.trim();
    } catch {
      /* keep default */
    }
    throw new ApiError(res.status, msg);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(cd);
  const filename = match
    ? match[1].replace(/['"]/g, "")
    : `gpos-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importDatabaseBackup(file: File, confirm: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("confirm", confirm);
  return apiUpload<{
    ok: boolean;
    message: string;
    data: { tables_restored: string[]; row_counts: Record<string, number> };
  }>("/settings/backup/import", form);
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

export interface UserSettingsRow {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  store_id: number | null;
}

export function updateUser(
  id: number,
  data: {
    name?: string;
    email?: string;
    role?: "owner" | "manager" | "cashier";
    is_active?: boolean;
    pin?: string;
  },
) {
  return apiFetch<{ data: UserSettingsRow; message: string }>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export const EXPENSE_PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "other", label: "Other" },
] as const;

export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number]["value"];

export interface ExpenseCategoryRow {
  id: number;
  name: string;
  is_active: boolean;
  store_id?: number | null;
}

export interface ExpenseRow {
  id: number;
  category_id: number;
  category?: ExpenseCategoryRow | { id: number; name: string } | null;
  amount: string | number;
  payment_method: ExpensePaymentMethod | string;
  spent_on: string;
  note: string | null;
  created_by: number | null;
  creator?: { id: number; name: string; role: string } | null;
  created_at?: string;
}

export interface ExpenseSummary {
  from: string;
  to: string;
  period_total: number;
  today_total: number;
  count: number;
  by_category: Array<{ category: string; category_id?: number; total: number; count: number }>;
}

export function listExpenseCategories() {
  return apiFetch<{ data: ExpenseCategoryRow[] }>("/expense-categories");
}

export function createExpenseCategory(name: string) {
  return apiFetch<{ data: ExpenseCategoryRow }>("/expense-categories", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function deleteExpenseCategory(id: number) {
  return apiFetch<{ ok: boolean }>(`/expense-categories/${id}`, { method: "DELETE" });
}

export function listExpenses(params: { from?: string; to?: string; categoryId?: number } = {}) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.categoryId) q.set("category_id", String(params.categoryId));
  const qs = q.toString();
  return apiFetch<{ data: ExpenseRow[]; summary: ExpenseSummary }>(`/expenses${qs ? `?${qs}` : ""}`);
}

export function createExpense(data: {
  category_id: number;
  amount: number;
  payment_method?: string;
  spent_on: string;
  note?: string | null;
}) {
  return apiFetch<{ data: ExpenseRow }>("/expenses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateExpense(
  id: number,
  data: Partial<{
    category_id: number;
    amount: number;
    payment_method: string;
    spent_on: string;
    note: string | null;
  }>,
) {
  return apiFetch<{ data: ExpenseRow }>(`/expenses/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteExpense(id: number) {
  return apiFetch<{ ok: boolean }>(`/expenses/${id}`, { method: "DELETE" });
}
