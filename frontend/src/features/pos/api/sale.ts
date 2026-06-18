import { apiFetch } from "@/lib/api";
import type { CartLine, PaymentMethod } from "../types";

interface SaleArgs {
  /** Stable per-checkout id so a retry after a lost response can't double-bill. */
  clientId: string;
  lines: CartLine[];
  discount: number;
  total: number;
  method: PaymentMethod;
  tendered: number;
  change: number;
  customerId: number | null;
}

interface PushResult {
  results: Array<{ client_id: string; status: string; server_id: number; invoice_no: string }>;
}

/**
 * Online-only sale. Posts directly to the server and resolves with the real
 * server invoice number. THROWS if the server is unreachable (no internet) —
 * the caller must then NOT treat the sale as complete.
 */
export async function submitSale(args: SaleArgs): Promise<{ invoiceNo: string }> {
  const subtotal = args.lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);

  const sale = {
    client_id: args.clientId,
    sold_at: new Date().toISOString(),
    customer_id: args.customerId,
    subtotal,
    discount: args.discount,
    total: args.total,
    lines: args.lines.map((line) => ({
      product_id: Number.isFinite(Number(line.product.id)) ? Number(line.product.id) : null,
      barcode: line.product.barcode,
      name: line.product.name,
      qty: line.qty,
      unit_price: line.product.price,
      line_total: line.product.price * line.qty,
    })),
    payments: [
      { method: args.method, amount: args.total, tendered: args.tendered, change: args.change },
    ],
  };

  const res = await apiFetch<PushResult>("/sync/push", {
    method: "POST",
    body: JSON.stringify({ device_id: "register-1", sales: [sale] }),
  });

  const invoiceNo = res.results?.[0]?.invoice_no;
  if (!invoiceNo) throw new Error("Sale not confirmed by server");
  return { invoiceNo };
}
