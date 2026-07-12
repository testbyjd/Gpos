/**
 * Build ESC/POS bytes for a thermal receipt (Bixolon / Epson-compatible).
 *
 * NOTE: never run LF (0x0A) through a printable-ASCII filter — that turns
 * newlines into "?" and the printer wraps mid-word.
 */

function charsForWidth(paperWidth) {
  switch (String(paperWidth)) {
    case "58":
      return 32;
    case "110":
    case "112":
      return 42;
    case "80":
    default:
      // Stable SRP-352plusIII RAW layout: 32 columns without driver wrapping.
      return 32;
  }
}

function money(n) {
  const v = Number(n) || 0;
  const rounded = Math.round(v * 100) / 100;
  if (Number.isInteger(rounded)) return `Rs${rounded}`;
  return `Rs${rounded.toFixed(2)}`;
}

/** Compact amount for item columns; the table heading already establishes amounts. */
function compactNumber(n) {
  const v = Number(n) || 0;
  const rounded = Math.round(v * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/** Printable ASCII only (no control chars). */
function toAscii(s) {
  return String(s ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "");
}

function padLine(left, right, width) {
  const l = toAscii(left);
  const r = toAscii(right);
  if (!r) return trunc(l, width);
  if (l.length + 1 + r.length > width) {
    return trunc(r, width);
  }
  const space = width - l.length - r.length;
  return l + " ".repeat(Math.max(1, space)) + r;
}

function itemLine(name, qty, rate, amount, width) {
  const qtyWidth = 4;
  const rateWidth = 6;
  const amountWidth = 6;
  const nameWidth = width - qtyWidth - rateWidth - amountWidth - 3;
  return [
    trunc(name, nameWidth).padEnd(nameWidth),
    trunc(qty, qtyWidth).padStart(qtyWidth),
    trunc(rate, rateWidth).padStart(rateWidth),
    trunc(amount, amountWidth).padStart(amountWidth),
  ].join(" ");
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

function pushRaw(chunks, bytes) {
  chunks.push(Buffer.from(bytes));
}

/** Printable text only — no embedded newlines. */
function pushText(chunks, s) {
  chunks.push(Buffer.from(toAscii(s), "ascii"));
}

/** ESC/POS line feed (must be raw 0x0A, never filtered to "?"). */
function pushLF(chunks, count = 1) {
  const n = Math.max(1, count);
  pushRaw(chunks, Buffer.alloc(n, 0x0a));
}

function pushLine(chunks, s) {
  pushText(chunks, s);
  pushLF(chunks, 1);
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
  // ESC M 0 — Font A
  pushRaw(chunks, [0x1b, 0x4d, 0x00]);
  // ESC 2 — restore the printer's standard 1/6-inch line spacing.
  pushRaw(chunks, [0x1b, 0x32]);
  // GS ! 0 — normal size
  pushRaw(chunks, [0x1d, 0x21, 0x00]);
  // ESC t 0 — PC437
  pushRaw(chunks, [0x1b, 0x74, 0x00]);

  if (opts.openDrawer) {
    const pin = Number(opts.drawerPin) === 1 ? 1 : 0;
    const on = Math.max(1, Math.min(255, Number(opts.drawerOnMs) || 25));
    const off = Math.max(1, Math.min(255, Number(opts.drawerOffMs) || 250));
    pushRaw(chunks, [0x1b, 0x70, pin, on, off]);
  }

  // Center + bold shop name
  pushRaw(chunks, [0x1b, 0x61, 0x01]);
  pushRaw(chunks, [0x1b, 0x45, 0x01]);
  pushLine(chunks, toAscii(settings.shop_name || "SHOP").toUpperCase());
  pushRaw(chunks, [0x1b, 0x45, 0x00]);

  if (settings.tagline) {
    for (const line of wrapWords(settings.tagline, width)) pushLine(chunks, line);
  }
  if (settings.address) {
    for (const line of wrapWords(settings.address, width)) pushLine(chunks, line);
  }
  if (settings.phone) pushLine(chunks, `Ph: ${toAscii(settings.phone)}`);
  if (data.method) {
    pushRaw(chunks, [0x1b, 0x45, 0x01]);
    pushLine(chunks, toAscii(data.method).toUpperCase());
    pushRaw(chunks, [0x1b, 0x45, 0x00]);
  }

  // Left align body
  pushRaw(chunks, [0x1b, 0x61, 0x00]);
  pushLine(chunks, rule);

  pushLine(chunks, `Inv: ${toAscii(data.invoice_no || "-")}`);
  pushLine(chunks, `Date: ${toAscii(data.date || "-")}`);
  if (settings.show_cashier !== false && data.cashier) {
    pushLine(chunks, `Cashier: ${toAscii(data.cashier)}`);
  }
  if (settings.show_customer !== false && data.customer) {
    pushLine(chunks, `Customer: ${toAscii(data.customer)}`);
  }

  pushLine(chunks, rule);
  pushLine(chunks, itemLine("ITEM NAME", "QTY", "RATE", "AMOUNT", width));
  pushLine(chunks, ".".repeat(width));

  const lines = Array.isArray(data.lines) ? data.lines : [];
  let subtotal = 0;
  for (const line of lines) {
    const qty = Number(line.qty) || 0;
    const price = Number(line.price) || 0;
    const amount = qty * price;
    subtotal += amount;

    pushLine(
      chunks,
      itemLine(
        line.name || "Item",
        compactNumber(qty),
        compactNumber(price),
        compactNumber(amount),
        width,
      ),
    );
    pushLine(chunks, ".".repeat(width));
  }

  const discount = Number(data.discount) || 0;
  const total = Math.max(0, subtotal - discount);

  pushLine(chunks, rule);
  pushLine(chunks, padLine("Subtotal", money(subtotal), width));
  if (discount > 0) {
    pushLine(chunks, padLine("Discount", `-${money(discount)}`, width));
  }
  pushRaw(chunks, [0x1b, 0x45, 0x01]);
  pushLine(chunks, padLine("NET BILL", money(total), width));
  pushRaw(chunks, [0x1b, 0x45, 0x00]);

  if (typeof data.paid === "number" && data.paid > 0) {
    pushLine(chunks, padLine("Paid", money(data.paid), width));
  }
  if (typeof data.change === "number" && data.change > 0) {
    pushLine(chunks, padLine("Change", money(data.change), width));
  }

  pushText(chunks, rule);
  pushLF(chunks, 1);

  if (settings.footer_note) {
    pushRaw(chunks, [0x1b, 0x61, 0x01]);
    for (const line of String(settings.footer_note).split(/\r?\n/)) {
      for (const w of wrapWords(line, width)) pushLine(chunks, w);
    }
    pushRaw(chunks, [0x1b, 0x61, 0x00]);
  }

  // Feed the footer clear of the cutter, then use the BIXOLON-compatible
  // GS V 66 n form. The short GS V 1 form is ignored by some Windows queues.
  pushLF(chunks, 5);
  // Partial cut, feed 0 extra units.
  pushRaw(chunks, [0x1d, 0x56, 0x42, 0x00]);

  return Buffer.concat(chunks);
}

module.exports = { buildEscPosReceipt, charsForWidth };
