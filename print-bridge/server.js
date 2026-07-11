#!/usr/bin/env node
/**
 * Local print bridge — cash drawer kick (+ future ESC/POS print).
 * Browser cannot pulse RJ11; this agent talks to the thermal printer.
 *
 * Start on each register PC:
 *   node print-bridge/server.js
 *
 * Default: http://127.0.0.1:9191
 *   GET  /health
 *   POST /drawer
 *
 * Transports (config.json "transport"):
 *   "tcp"  — network printer raw port (default :9100)
 *   "com"  — USB printers via Windows Virtual COM (Bixolon SRP-352+ etc.)
 */

const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "config.json");
const defaults = {
  listenHost: "127.0.0.1",
  listenPort: 9191,
  /** "tcp" | "com" */
  transport: "tcp",
  printerHost: "127.0.0.1",
  printerPort: 9100,
  /** Windows USB / Virtual COM — e.g. "COM3" (Device Manager se dekho) */
  comPort: "COM3",
  drawerPin: 0,
  drawerOnMs: 25,
  drawerOffMs: 250,
};

function loadConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return { ...defaults, ...raw };
  } catch {
    return { ...defaults };
  }
}

function printerLabel(cfg) {
  const transport = String(cfg.transport || "tcp").toLowerCase();
  if (transport === "com" || transport === "serial") {
    return `COM ${cfg.comPort || "COM3"}`;
  }
  return `TCP ${cfg.printerHost}:${cfg.printerPort}`;
}

/** Standard ESC/POS cash drawer pulse (Epson-compatible; Bixolon bhi yehi use karta hai). */
function drawerKickBuffer(cfg) {
  const pin = Number(cfg.drawerPin) === 1 ? 1 : 0;
  const on = Math.max(1, Math.min(255, Number(cfg.drawerOnMs) || 25));
  const off = Math.max(1, Math.min(255, Number(cfg.drawerOffMs) || 250));
  return Buffer.from([0x1b, 0x70, pin, on, off]);
}

function sendViaTcp(cfg, payload) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(
      { host: cfg.printerHost, port: Number(cfg.printerPort), timeout: 4000 },
      () => {
        socket.write(payload, (err) => {
          if (err) {
            socket.destroy();
            reject(err);
            return;
          }
          socket.end();
          resolve();
        });
      },
    );
    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Printer TCP connection timeout"));
    });
  });
}

/**
 * Windows Virtual COM / USB serial (\\\\.\\COM3).
 * Linux: set comPort to "/dev/ttyUSB0" etc.
 */
function sendViaCom(cfg, payload) {
  return new Promise((resolve, reject) => {
    const raw = String(cfg.comPort || "COM3").trim();
    if (!raw) {
      reject(new Error('comPort missing — config.json mein "COM3" jaisa port likho'));
      return;
    }

    let devicePath = raw;
    if (process.platform === "win32") {
      // COM3 → \\.\COM3
      if (!raw.startsWith("\\\\.\\") && !raw.startsWith("/")) {
        devicePath = `\\\\.\\${raw.toUpperCase().startsWith("COM") ? raw.toUpperCase() : raw}`;
      }
    }

    try {
      const fd = fs.openSync(devicePath, "w");
      try {
        fs.writeSync(fd, payload);
      } finally {
        fs.closeSync(fd);
      }
      resolve();
    } catch (err) {
      const msg = err?.message || String(err);
      reject(
        new Error(
          `COM write fail (${devicePath}): ${msg}. Device Manager → Ports (COM & LPT) se sahi COM number check karo. Bixolon driver mein Virtual Serial Port on hona chahiye.`,
        ),
      );
    }
  });
}

function sendToPrinter(cfg, payload) {
  const transport = String(cfg.transport || "tcp").toLowerCase();
  if (transport === "com" || transport === "serial") {
    return sendViaCom(cfg, payload);
  }
  return sendViaTcp(cfg, payload);
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Private-Network": "true",
    ...extra,
  };
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  const headers = corsHeaders({
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(data),
  });
  res.writeHead(status, headers);
  res.end(data);
}

const cfg = loadConfig();

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${cfg.listenHost}`);

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, {
      ok: true,
      service: "gpos-print-bridge",
      transport: String(cfg.transport || "tcp").toLowerCase(),
      printer: printerLabel(cfg),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/drawer") {
    try {
      await sendToPrinter(cfg, drawerKickBuffer(cfg));
      json(res, 200, {
        ok: true,
        message: `Drawer kick sent (${printerLabel(cfg)})`,
      });
    } catch (err) {
      json(res, 502, {
        ok: false,
        message: err?.message || "Printer/drawer unreachable",
        printer: printerLabel(cfg),
      });
    }
    return;
  }

  json(res, 404, { ok: false, message: "Not found. Use GET /health or POST /drawer" });
});

server.listen(Number(cfg.listenPort), cfg.listenHost, () => {
  console.log(`[gpos-print-bridge] listening http://${cfg.listenHost}:${cfg.listenPort}`);
  console.log(`[gpos-print-bridge] printer ${printerLabel(cfg)}`);
  console.log(`[gpos-print-bridge] POST /drawer to open cash drawer`);
});
