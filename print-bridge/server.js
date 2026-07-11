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
 *   POST /drawer   → ESC/POS drawer open via printer TCP :9100
 */

const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "config.json");
const defaults = {
  listenHost: "127.0.0.1",
  listenPort: 9191,
  printerHost: "127.0.0.1",
  printerPort: 9100,
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

/** Standard ESC/POS cash drawer pulse (most Epson-compatible thermals). */
function drawerKickBuffer(cfg) {
  const pin = Number(cfg.drawerPin) === 1 ? 1 : 0;
  const on = Math.max(1, Math.min(255, Number(cfg.drawerOnMs) || 25));
  const off = Math.max(1, Math.min(255, Number(cfg.drawerOffMs) || 250));
  return Buffer.from([0x1b, 0x70, pin, on, off]);
}

function sendToPrinter(cfg, payload) {
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
      reject(new Error("Printer connection timeout"));
    });
  });
}

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    // Chrome Private Network Access / Local Network Access:
    // https://gondaltrader.com (public HTTPS) → http://127.0.0.1:9191
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
      printer: `${cfg.printerHost}:${cfg.printerPort}`,
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/drawer") {
    try {
      await sendToPrinter(cfg, drawerKickBuffer(cfg));
      json(res, 200, { ok: true, message: "Drawer kick sent" });
    } catch (err) {
      json(res, 502, {
        ok: false,
        message: err?.message || "Printer/drawer unreachable",
        printer: `${cfg.printerHost}:${cfg.printerPort}`,
      });
    }
    return;
  }

  json(res, 404, { ok: false, message: "Not found. Use GET /health or POST /drawer" });
});

server.listen(Number(cfg.listenPort), cfg.listenHost, () => {
  console.log(`[gpos-print-bridge] listening http://${cfg.listenHost}:${cfg.listenPort}`);
  console.log(`[gpos-print-bridge] printer ${cfg.printerHost}:${cfg.printerPort}`);
  console.log(`[gpos-print-bridge] POST /drawer to open cash drawer`);
});
