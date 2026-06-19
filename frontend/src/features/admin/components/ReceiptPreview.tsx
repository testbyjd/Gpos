"use client";

import { formatMoney } from "@/lib/utils";
import type { ReceiptSettings } from "@/lib/admin-api";

export interface ReceiptLine {
  name: string;
  qty: number;
  price: number;
}

export interface ReceiptData {
  invoice_no: string;
  date: string;
  cashier?: string;
  customer?: string;
  lines: ReceiptLine[];
  discount?: number;
  paid?: number;
  change?: number;
  method?: string;
}

export const SAMPLE_RECEIPT: ReceiptData = {
  invoice_no: "INV-1042",
  date: new Date().toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }),
  cashier: "Cashier 1",
  customer: "Walk-in",
  method: "Cash",
  discount: 50,
  paid: 2000,
  change: 130,
  lines: [
    { name: "Surf Excel 1kg", qty: 2, price: 540 },
    { name: "Tapal Danedar 450g", qty: 1, price: 690 },
    { name: "Sufi Cooking Oil 1L", qty: 1, price: 580 },
  ],
};

export function ReceiptPreview({
  settings,
  data = SAMPLE_RECEIPT,
  className = "",
}: {
  settings: ReceiptSettings;
  data?: ReceiptData;
  className?: string;
}) {
  const subtotal = data.lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const discount = data.discount ?? 0;
  const total = subtotal - discount;
  const widthPx = settings.paper_width === "58" ? 220 : 300;

  return (
    <div
      className={`print-receipt mx-auto bg-white text-black ${className}`}
      style={{
        width: widthPx,
        padding: "12px 14px",
        fontFamily: "'Courier New', ui-monospace, monospace",
        fontSize: 12,
        lineHeight: 1.4,
        boxShadow: "0 1px 6px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 800, textTransform: "uppercase" }}>{settings.shop_name}</div>
        {settings.tagline && <div style={{ fontSize: 11 }}>{settings.tagline}</div>}
        {settings.address && <div style={{ fontSize: 11 }}>{settings.address}</div>}
        {settings.phone && <div style={{ fontSize: 11 }}>Ph: {settings.phone}</div>}
      </div>

      <Divider />

      <Row left={`Invoice: ${data.invoice_no}`} />
      <Row left={`Date: ${data.date}`} />
      {settings.show_cashier && data.cashier && <Row left={`Cashier: ${data.cashier}`} />}
      {settings.show_customer && data.customer && <Row left={`Customer: ${data.customer}`} />}

      <Divider />

      <div style={{ display: "flex", fontWeight: 700 }}>
        <span style={{ flex: 1 }}>Item</span>
        <span style={{ width: 28, textAlign: "right" }}>Qty</span>
        <span style={{ width: 64, textAlign: "right" }}>Amount</span>
      </div>
      <Dashes />
      {data.lines.map((l, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <div>{l.name}</div>
          <div style={{ display: "flex" }}>
            <span style={{ flex: 1 }}>{formatMoney(l.price)}</span>
            <span style={{ width: 28, textAlign: "right" }}>{l.qty}</span>
            <span style={{ width: 64, textAlign: "right" }}>{formatMoney(l.qty * l.price)}</span>
          </div>
        </div>
      ))}

      <Divider />

      <Row left="Subtotal" right={formatMoney(subtotal)} />
      {discount > 0 && <Row left="Discount" right={`- ${formatMoney(discount)}`} />}
      <div style={{ display: "flex", fontWeight: 800, fontSize: 14, marginTop: 2 }}>
        <span style={{ flex: 1 }}>TOTAL</span>
        <span>{formatMoney(total)}</span>
      </div>
      {data.method && <Row left="Payment" right={data.method} />}
      {typeof data.paid === "number" && data.paid > 0 && <Row left="Paid" right={formatMoney(data.paid)} />}
      {typeof data.change === "number" && data.change > 0 && <Row left="Change" right={formatMoney(data.change)} />}

      <Divider />

      {settings.footer_note && (
        <div style={{ textAlign: "center", fontSize: 11, whiteSpace: "pre-wrap" }}>{settings.footer_note}</div>
      )}
    </div>
  );
}

function Row({ left, right }: { left: string; right?: string }) {
  return (
    <div style={{ display: "flex" }}>
      <span style={{ flex: 1 }}>{left}</span>
      {right !== undefined && <span style={{ textAlign: "right" }}>{right}</span>}
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />;
}

function Dashes() {
  return <div style={{ fontSize: 10, overflow: "hidden", whiteSpace: "nowrap" }}>--------------------------------</div>;
}
