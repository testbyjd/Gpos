"use client";

import type { CSSProperties } from "react";
import { formatMoney } from "@/lib/utils";
import {
  normalizeReceiptSettings,
  receiptWidthPx,
  type ReceiptSettings,
} from "@/lib/admin-api";

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

/** Thermal printers fade thin/light text — keep receipt pure black. */
const ink: CSSProperties = {
  color: "#000",
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
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
  const s = normalizeReceiptSettings(settings);
  const subtotal = data.lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const discount = data.discount ?? 0;
  const total = subtotal - discount;
  const widthPx = receiptWidthPx(s.paper_width);
  const bodySize = s.font_size!;
  const weight = s.font_weight!;
  const titleSize = s.title_size!;
  const metaSize = Math.max(9, Math.round(bodySize * 0.92));
  const totalSize = Math.max(bodySize + 2, Math.round(titleSize * 0.88));
  const heavy = Math.min(900, weight + 200);
  const mediumHeavy = Math.min(900, weight + 100);

  return (
    <div
      className={`print-receipt mx-auto bg-white text-black ${className}`}
      style={{
        ...ink,
        width: widthPx,
        padding: `${s.padding}px ${Math.max(8, (s.padding ?? 12) + 2)}px`,
        fontFamily: "'Courier New', Courier, ui-monospace, monospace",
        fontSize: bodySize,
        fontWeight: weight,
        lineHeight: s.line_height,
        boxShadow: "0 1px 6px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: titleSize,
            fontWeight: Math.min(900, weight + 200),
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          {s.shop_name}
        </div>
        {s.tagline && <div style={{ fontSize: metaSize, fontWeight: weight }}>{s.tagline}</div>}
        {s.address && <div style={{ fontSize: metaSize, fontWeight: weight }}>{s.address}</div>}
        {s.phone && <div style={{ fontSize: metaSize, fontWeight: weight }}>Ph: {s.phone}</div>}
      </div>

      <Divider gap={s.section_gap!} />

      <Row left={`Invoice: ${data.invoice_no}`} weight={weight} />
      <Row left={`Date: ${data.date}`} weight={weight} />
      {s.show_cashier && data.cashier && <Row left={`Cashier: ${data.cashier}`} weight={weight} />}
      {s.show_customer && data.customer && <Row left={`Customer: ${data.customer}`} weight={weight} />}

      <Divider gap={s.section_gap!} />

      <div style={{ display: "flex", fontWeight: heavy }}>
        <span style={{ flex: 1 }}>Item</span>
        <span style={{ width: 28, textAlign: "right" }}>Qty</span>
        <span style={{ width: 64, textAlign: "right" }}>Amount</span>
      </div>
      <Dashes size={metaSize} weight={mediumHeavy} />
      {data.lines.map((l, i) => (
        <div key={i} style={{ marginBottom: Math.max(2, Math.round((s.section_gap ?? 7) * 0.4)), fontWeight: weight }}>
          <div style={{ fontWeight: mediumHeavy }}>{l.name}</div>
          <div style={{ display: "flex" }}>
            <span style={{ flex: 1 }}>{formatMoney(l.price)}</span>
            <span style={{ width: 28, textAlign: "right" }}>{l.qty}</span>
            <span style={{ width: 64, textAlign: "right" }}>{formatMoney(l.qty * l.price)}</span>
          </div>
        </div>
      ))}

      <Divider gap={s.section_gap!} />

      <Row left="Subtotal" right={formatMoney(subtotal)} weight={weight} />
      {discount > 0 && <Row left="Discount" right={`- ${formatMoney(discount)}`} weight={weight} />}
      <div style={{ display: "flex", fontWeight: heavy, fontSize: totalSize, marginTop: 3 }}>
        <span style={{ flex: 1 }}>TOTAL</span>
        <span>{formatMoney(total)}</span>
      </div>
      {data.method && <Row left="Payment" right={data.method} weight={weight} />}
      {typeof data.paid === "number" && data.paid > 0 && <Row left="Paid" right={formatMoney(data.paid)} weight={weight} />}
      {typeof data.change === "number" && data.change > 0 && <Row left="Change" right={formatMoney(data.change)} weight={weight} />}

      <Divider gap={s.section_gap!} />

      {s.footer_note && (
        <div style={{ textAlign: "center", fontSize: metaSize, fontWeight: weight, whiteSpace: "pre-wrap" }}>
          {s.footer_note}
        </div>
      )}
    </div>
  );
}

function Row({ left, right, weight }: { left: string; right?: string; weight: number }) {
  return (
    <div style={{ display: "flex", fontWeight: weight }}>
      <span style={{ flex: 1 }}>{left}</span>
      {right !== undefined && <span style={{ textAlign: "right" }}>{right}</span>}
    </div>
  );
}

function Divider({ gap }: { gap: number }) {
  return <div style={{ borderTop: "2px dashed #000", margin: `${gap}px 0` }} />;
}

function Dashes({ size, weight }: { size: number; weight: number }) {
  return (
    <div style={{ fontSize: size, fontWeight: weight, overflow: "hidden", whiteSpace: "nowrap" }}>
      =================================
    </div>
  );
}
