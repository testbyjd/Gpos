/**
 * Build ESC/POS bytes for a thermal receipt (Bixolon / Epson-compatible).
 */

function charsForWidth(paperWidth) {
  switch (String(paperWidth)) {
    case "58":
      return 32;
    case "110":
    case "112":
      return 48;
    case "80":
    default:
      return 42;
  }
}

function money(n) {
  const v = Number(n) || 0;
  return `Rs ${v.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function padLine(left, right, width) {
  const l = String(left ?? "");
  const r = String(right ?? "");
  if (!r) return trunc(l, width);
  const space = width - l.length - r.length;
  if (space >= 1) return l + " ".repeat(space) + r;
  return trunc(l, Math.max(0, width - r.length - 1)) + " " + r;
}

function trunc(s, max) {
  const t = String(s ?? "");
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

function wrapWords(text, width) {
  const words = String(text || "")
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = trunc(w, width);
      continue;
    }
    if ((cur + " " + w).length <= width) {
      cur = cur + " " + w;
    } else {
      lines.push(cur);
      cur = trunc(w, width);
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function pushStr(chunks, s) {
  chunks.push(Buffer.from(String(s), "utf8"));
}

/**
 * @param {{ settings?: object, data?: object }} receipt
 * @param {{ openDrawer?: boolean, drawerPin?: number, drawerOnMs?: number, drawerOffMs?: number }} opts
 */
function buildEscPosReceipt(receipt, opts = {}) {
  const settings = receipt?.settings || {};
  const data = receipt?.data || {};
  const width = charsForWidth(settings.paper_width);
  const chunks = [];

  // ESC @ — init
  chunks.push(Buffer.from([0x1b, 0x40]));

  if (opts.openDrawer) {
    const pin = Number(opts.drawerPin) === 1 ? 1 : 0;
    const on = Math.max(1, Math.min(255, Number(opts.drawerOnMs) || 25));
    const off = Math.max(1, Math.min(255, Number(opts.drawerOffMs) || 250));
    chunks.push(Buffer.from([0x1b, 0x70, pin, on, off]));
  }

  // Center
  chunks.push(Buffer.from([0x1b, 0x61, 0x01]));
  // Bold on for shop name
  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  pushStr(chunks, `${String(settings.shop_name || "SHOP").toUpperCase()}\n`);
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  if (settings.tagline) {
    for (const line of wrapWords(settings.tagline, width)) pushStr(chunks, `${line}\n`);
  }
  if (settings.address) {
    for (const line of wrapWords(settings.address, width)) pushStr(chunks, `${line}\n`);
  }
  if (settings.phone) pushStr(chunks, `Ph: ${settings.phone}\n`);

  // Left
  chunks.push(Buffer.from([0x1b, 0x61, 0x00]));
  pushStr(chunks, `${"-".repeat(width)}\n`);

  pushStr(chunks, `Invoice: ${data.invoice_no || "-"}\n`);
  pushStr(chunks, `Date: ${data.date || "-"}\n`);
  if (settings.show_cashier !== false && data.cashier) {
    pushStr(chunks, `Cashier: ${data.cashier}\n`);
  }
  if (settings.show_customer !== false && data.customer) {
    pushStr(chunks, `Customer: ${data.customer}\n`);
  }

  pushStr(chunks, `${"-".repeat(width)}\n`);
  pushStr(chunks, `${padLine("Item", "Amount", width)}\n`);
  pushStr(chunks, `${"=".repeat(width)}\n`);

  const lines = Array.isArray(data.lines) ? data.lines : [];
  let subtotal = 0;
  for (const line of lines) {
    const qty = Number(line.qty) || 0;
    const price = Number(line.price) || 0;
    const amount = qty * price;
    subtotal += amount;
    for (const w of wrapWords(line.name || "Item", width)) pushStr(chunks, `${w}\n`);
    pushStr(chunks, `${padLine(money(price), `${qty}  ${money(amount)}`, width)}\n`);
  }

  const discount = Number(data.discount) || 0;
  const total = Math.max(0, subtotal - discount);

  pushStr(chunks, `${"-".repeat(width)}\n`);
  pushStr(chunks, `${padLine("Subtotal", money(subtotal), width)}\n`);
  if (discount > 0) {
    pushStr(chunks, `${padLine("Discount", `- ${money(discount)}`, width)}\n`);
  }
  chunks.push(Buffer.from([0x1b, 0x45, 0x01]));
  pushStr(chunks, `${padLine("TOTAL", money(total), width)}\n`);
  chunks.push(Buffer.from([0x1b, 0x45, 0x00]));

  if (data.method) pushStr(chunks, `${padLine("Payment", String(data.method), width)}\n`);
  if (typeof data.paid === "number" && data.paid > 0) {
    pushStr(chunks, `${padLine("Paid", money(data.paid), width)}\n`);
  }
  if (typeof data.change === "number" && data.change > 0) {
    pushStr(chunks, `${padLine("Change", money(data.change), width)}\n`);
  }

  pushStr(chunks, `${"-".repeat(width)}\n`);

  if (settings.footer_note) {
    chunks.push(Buffer.from([0x1b, 0x61, 0x01]));
    for (const line of String(settings.footer_note).split(/\r?\n/)) {
      for (const w of wrapWords(line, width)) pushStr(chunks, `${w}\n`);
    }
    chunks.push(Buffer.from([0x1b, 0x61, 0x00]));
  }

  // Feed + partial cut
  pushStr(chunks, "\n\n\n");
  chunks.push(Buffer.from([0x1d, 0x56, 0x01]));

  return Buffer.concat(chunks);
}

module.exports = { buildEscPosReceipt, charsForWidth };
