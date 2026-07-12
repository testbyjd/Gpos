"use client";

import type { CSSProperties } from "react";
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
  // Mirror BIXOLON Font A at the stable 32-column RAW configuration.
  const bodySize = 12;
  const weight = 500;
  const receiptMoney = (value: number) => `Rs${compactNumber(value)}`;

  return (
    <div
      className={`print-receipt mx-auto bg-white text-black ${className}`}
      style={{
        ...ink,
        width: widthPx,
        padding: "32px 12px 40px",
        fontFamily: "'Courier New', Courier, ui-monospace, monospace",
        fontSize: bodySize,
        fontWeight: weight,
        lineHeight: 1.12,
        boxShadow: "0 1px 6px rgba(0,0,0,0.15)",
      }}
    >
      <div style={{ width: "32ch", whiteSpace: "nowrap" }}>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: bodySize,
            fontWeight: 800,
            textTransform: "uppercase",
          }}
        >
          {s.shop_name}
        </div>
        {s.tagline && <div>{s.tagline}</div>}
        {s.address && <div>{s.address}</div>}
        {s.phone && <div>Ph: {s.phone}</div>}
        {data.method && <div style={{ fontWeight: 800, marginTop: 2 }}>{data.method.toUpperCase()}</div>}
      </div>

      <Divider character="-" />

      <Row left={`Inv: ${data.invoice_no}`} />
      <Row left={`Date: ${data.date}`} />
      {s.show_cashier && data.cashier && <Row left={`Cashier: ${data.cashier}`} />}
      {s.show_customer && data.customer && <Row left={`Customer: ${data.customer}`} />}

      <Divider character="-" />

      <ItemRow name="ITEM NAME" qty="QTY" rate="RATE" amount="AMOUNT" />
      <Divider character="." />
      {data.lines.map((l, i) => (
        <div key={i}>
          <ItemRow
            name={truncate(l.name, 13)}
            qty={compactNumber(l.qty)}
            rate={compactNumber(l.price)}
            amount={compactNumber(l.qty * l.price)}
          />
          <Divider character="." />
        </div>
      ))}

      <Divider character="-" />

      <Row left="Subtotal" right={receiptMoney(subtotal)} />
      {discount > 0 && <Row left="Discount" right={`-${receiptMoney(discount)}`} />}
      <Row left="NET BILL" right={receiptMoney(total)} bold />
      {typeof data.paid === "number" && data.paid > 0 && <Row left="Paid" right={receiptMoney(data.paid)} />}
      {typeof data.change === "number" && data.change > 0 && <Row left="Change" right={receiptMoney(data.change)} />}

      <Divider character="-" />

      {s.footer_note && (
        <div style={{ textAlign: "center", whiteSpace: "pre-wrap" }}>
          {s.footer_note}
        </div>
      )}
      </div>
    </div>
  );
}

function Row({ left, right, bold = false }: { left: string; right?: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", width: "32ch", fontWeight: bold ? 800 : undefined }}>
      <span style={{ flex: 1, overflow: "hidden" }}>{left}</span>
      {right !== undefined && <span style={{ textAlign: "right" }}>{right}</span>}
    </div>
  );
}

function ItemRow({
  name,
  qty,
  rate,
  amount,
}: {
  name: string;
  qty: string;
  rate: string;
  amount: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "13ch 4ch 6ch 6ch", columnGap: "1ch", width: "32ch" }}>
      <span>{name}</span>
      <span style={{ textAlign: "right" }}>{qty}</span>
      <span style={{ textAlign: "right" }}>{rate}</span>
      <span style={{ textAlign: "right" }}>{amount}</span>
    </div>
  );
}

function Divider({ character }: { character: "-" | "." }) {
  return <div aria-hidden="true">{character.repeat(32)}</div>;
}

function compactNumber(value: number): string {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}.`;
}
