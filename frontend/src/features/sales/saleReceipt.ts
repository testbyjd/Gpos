import type { ReceiptData } from "@/features/admin/components/ReceiptPreview";
import type { SaleDetail } from "@/lib/admin-api";
import { formatPkDateTime } from "@/lib/datetime";
import { paymentMethodLabel } from "@/features/pos/paymentMethods";

export function saleToReceiptData(sale: SaleDetail): ReceiptData {
  const methods = (sale.payments ?? []).map((p) => paymentMethodLabel(p.method));
  const cashPaid = (sale.payments ?? [])
    .filter((p) => p.method === "cash")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    invoice_no: sale.invoice_no,
    date: formatPkDateTime(sale.sold_at, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    cashier: sale.cashier?.name,
    customer: sale.customer?.name ?? "Walk-in Customer",
    lines: sale.lines.map((l) => ({
      name: l.product?.name ?? "Product",
      qty: Number(l.qty),
      price: Number(l.unit_price),
    })),
    discount: Number(sale.discount),
    method: methods.join(" + ") || undefined,
    paid: cashPaid > 0 ? cashPaid : undefined,
  };
}
