/**
 * Build ESC/POS bytes for a thermal receipt (Bixolon / Epson-compatible).
 *
 * Important: pad lines to a CONSERVATIVE character width. Agar width zyada ho
 * to printer mid-line wrap karta hai → "Item" / "Amount" alag lines pe aa jate hain.
 */

function charsForWidth(paperWidth) {
  // Bixolon SRP-352+ USB aksar Font A pe ~32–42. Conservative = clean columns.
  switch (String(paperWidth)) {
    case "58":
      return 32;
    case "110":
    case "112":
      return 42;
    case "80":
    default:
      return 32;
  }
}

/** ASCII-only money — no locale commas / unicode (thermal pe wrap/garbage se bachao). */
function money(n) {
  const v = Number(n) || 0;
  const rounded = Math.round(v * 100) / 100;
  if (Number.isInteger(rounded)) return `Rs${rounded}`;
  return `Rs${rounded.toFixed(2)}`;
}

function toAscii(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?");
}

function padLine(left, right, width) {
  const l = toAscii(left);
  const r = toAscii(right);
  if (!r) return trunc(l, width);
  if (l.length + 1 + r.length > width) {
    // Don't force one line — name already separate; keep right-aligned value alone
    return trunc(r, width);
  }
  const space = width - l.length - r.length;
  return l + " ".repeat(Math.max(1, space)) + r;
}

function trunc(s, max) {
  const t = toAscii(s);
  if (t.length <= max) return t;
  if (max <= 1) return t.slice(0, max);
  return t.slice(0, max - 1) + ".";
}

function wrapWords(text, width) {
  const words = toAscii(text)
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
      cur = `${cur} ${w}`;
    } else {
      lines.push(cur);
      cur = trunc(w, width);
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function pushStr(chunks, s) {
  chunks.push(Buffer.from(toAscii(s), "ascii"));
}

function pushRaw(chunks, bytes) {
  chunks.push(Buffer.from(bytes));
}

/**
 * @param {{ settings?: object, data?: object }} receipt
 * @param {{ openDrawer?: boolean, drawerPin?: number, drawerOnMs?: number, drawerOffMs?: number }} opts
 */
function buildEscPosReceipt(receipt, opts = {}) {
  const settings = receipt?.settings || {};
  const data = receipt?.data || {};
  const width = charsForWidth(settings.paper_width);
  const rule = "-".repeat(width);
  const eq = "=".repeat(width);
  const chunks = [];

  // ESC @ init
  pushRaw(chunks, [0x1b, 0x40]);
  // ESC M 0 — Font A (standard width)
  pushRaw(chunks, [0x1b, 0x4d, 0x00]);
  // GS ! 0 — normal character size (not double-width/height)
  pushRaw(chunks, [0x1d, 0x21, 0x00]);
  // ESC t 0 — code page PC437
  pushRaw(chunks, [0x1b, 0x74, 0x00]);
  // ESC 3 n — line spacing
  pushRaw(chunks, [0x1b, 0x33, 0x3c]);

  if (opts.openDrawer) {
    const pin = Number(opts.drawerPin) === 1 ? 1 : 0;
    const on = Math.max(1, Math.min(255, Number(opts.drawerOnMs) || 25));
    const off = Math.max(1, Math.min(255, Number(opts.drawerOffMs) || 250));
    pushRaw(chunks, [0x1b, 0x70, pin, on, off]);
  }

  // Center + bold shop name
  pushRaw(chunks, [0x1b, 0x61, 0x01]);
  pushRaw(chunks, [0x1b, 0x45, 0x01]);
  pushStr(chunks, `${toAscii(settings.shop_name || "SHOP").toUpperCase()}\n`);
  pushRaw(chunks, [0x1b, 0x45, 0x00]);

  if (settings.tagline) {
    for (const line of wrapWords(settings.tagline, width)) pushStr(chunks, `${line}\n`);
  }
  if (settings.address) {
    for (const line of wrapWords(settings.address, width)) pushStr(chunks, `${line}\n`);
  }
  if (settings.phone) pushStr(chunks, `Ph: ${toAscii(settings.phone)}\n`);

  // Left align body
  pushRaw(chunks, [0x1b, 0x61, 0x00]);
  pushStr(chunks, `${rule}\n`);

  pushStr(chunks, `Inv: ${toAscii(data.invoice_no || "-")}\n`);
  pushStr(chunks, `Date: ${toAscii(data.date || "-")}\n`);
  if (settings.show_cashier !== false && data.cashier) {
    pushStr(chunks, `Cashier: ${toAscii(data.cashier)}\n`);
  }
  if (settings.show_customer !== false && data.customer) {
    pushStr(chunks, `Customer: ${toAscii(data.customer)}\n`);
  }

  pushStr(chunks, `${rule}\n`);
  pushStr(chunks, `${padLine("Item", "Amount", width)}\n`);
  pushStr(chunks, `${eq}\n`);

  const lines = Array.isArray(data.lines) ? data.lines : [];
  let subtotal = 0;
  for (const line of lines) {
    const qty = Number(line.qty) || 0;
    const price = Number(line.price) || 0;
    const amount = qty * price;
    subtotal += amount;

    for (const w of wrapWords(line.name || "Item", width)) {
      pushStr(chunks, `${w}\n`);
    }
    // Compact: "2x Rs540            Rs1080"
    const left = `${qty}x ${money(price)}`;
    pushStr(chunks, `${padLine(left, money(amount), width)}\n`);
  }

  const discount = Number(data.discount) || 0;
  const total = Math.max(0, subtotal - discount);

  pushStr(chunks, `${rule}\n`);
  pushStr(chunks, `${padLine("Subtotal", money(subtotal), width)}\n`);
  if (discount > 0) {
    pushStr(chunks, `${padLine("Discount", `-${money(discount)}`, width)}\n`);
  }
  pushRaw(chunks, [0x1b, 0x45, 0x01]);
  pushStr(chunks, `${padLine("TOTAL", money(total), width)}\n`);
  pushRaw(chunks, [0x1b, 0x45, 0x00]);

  if (data.method) pushStr(chunks, `${padLine("Payment", toAscii(data.method), width)}\n`);
  if (typeof data.paid === "number" && data.paid > 0) {
    pushStr(chunks, `${padLine("Paid", money(data.paid), width)}\n`);
  }
  if (typeof data.change === "number" && data.change > 0) {
    pushStr(chunks, `${padLine("Change", money(data.change), width)}\n`);
  }

  pushStr(chunks, `${rule}\n`);

  if (settings.footer_note) {
    pushRaw(chunks, [0x1b, 0x61, 0x01]);
    for (const line of String(settings.footer_note).split(/\r?\n/)) {
      for (const w of wrapWords(line, width)) pushStr(chunks, `${w}\n`);
    }
    pushRaw(chunks, [0x1b, 0x61, 0x00]);
  }

  pushStr(chunks, "\n\n\n");
  // Partial cut
  pushRaw(chunks, [0x1d, 0x56, 0x01]);

  return Buffer.concat(chunks);
}

module.exports = { buildEscPosReceipt, charsForWidth };
