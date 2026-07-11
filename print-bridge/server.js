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
 *   POST /drawer  — cash drawer only
 *   POST /print   — ESC/POS receipt (+ optional drawer) — no Windows print dialog
 *
 * Transports (config.json "transport"):
 *   "tcp"      — network printer raw port (:9100)
 *   "com"      — Virtual COM / serial (\\\\.\\COM3)
 *   "winspool" — Windows USB printer by name (USB001 / Bixolon) ★ SRP-352+
 */

const http = require("http");
const net = require("net");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { buildEscPosReceipt } = require("./escpos-receipt");

const configPath = path.join(__dirname, "config.json");
const defaults = {
  listenHost: "127.0.0.1",
  listenPort: 9191,
  /** "tcp" | "com" | "winspool" */
  transport: "winspool",
  printerHost: "127.0.0.1",
  printerPort: 9100,
  comPort: "COM3",
  /** Exact name from Windows "Devices and Printers" */
  windowsPrinter: "BIXOLON SRP-352plusIII",
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
  if (transport === "winspool" || transport === "windows" || transport === "usb") {
    return `Windows "${cfg.windowsPrinter || "printer"}"`;
  }
  if (transport === "com" || transport === "serial") {
    return `COM ${cfg.comPort || "COM3"}`;
  }
  return `TCP ${cfg.printerHost}:${cfg.printerPort}`;
}

/** Standard ESC/POS cash drawer pulse (Epson-compatible; Bixolon bhi yehi). */
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

function sendViaCom(cfg, payload) {
  return new Promise((resolve, reject) => {
    const raw = String(cfg.comPort || "COM3").trim();
    if (!raw) {
      reject(new Error('comPort missing — config.json mein "COM3" likho'));
      return;
    }

    let devicePath = raw;
    if (process.platform === "win32") {
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
      reject(
        new Error(
          `COM write fail (${devicePath}): ${err?.message || err}. USB001 printer pe COM nahi — transport "winspool" use karo.`,
        ),
      );
    }
  });
}

/**
 * Send RAW bytes to a Windows printer queue (USB001 / Bixolon driver name).
 * Uses winspool WritePrinter via PowerShell — no Virtual COM needed.
 */
function sendViaWinSpool(cfg, payload) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      reject(new Error('transport "winspool" sirf Windows pe chalega'));
      return;
    }

    const printerName = String(cfg.windowsPrinter || "").trim();
    if (!printerName) {
      reject(new Error('windowsPrinter missing — Devices and Printers se exact naam likho'));
      return;
    }

    const tmp = path.join(os.tmpdir(), `gpos-drawer-${process.pid}-${Date.now()}.bin`);
    try {
      fs.writeFileSync(tmp, payload);
    } catch (err) {
      reject(err);
      return;
    }

    const printerEscaped = printerName.replace(/'/g, "''");
    const tmpEscaped = tmp.replace(/'/g, "''");

    const psScript = `
$ErrorActionPreference = 'Stop'
$printerName = '${printerEscaped}'
$filePath = '${tmpEscaped}'
$bytes = [System.IO.File]::ReadAllBytes($filePath)
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class GposRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In] DOCINFOA di);
  [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
  public static string SendBytes(string printerName, byte[] data) {
    IntPtr hPrinter = IntPtr.Zero;
    if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) {
      return "OpenPrinter failed (check printer name): " + printerName + " err=" + Marshal.GetLastWin32Error();
    }
    var di = new DOCINFOA();
    di.pDocName = "GPOS Drawer Kick";
    di.pDataType = "RAW";
    if (!StartDocPrinter(hPrinter, 1, di)) {
      int e = Marshal.GetLastWin32Error();
      ClosePrinter(hPrinter);
      return "StartDocPrinter failed err=" + e;
    }
    StartPagePrinter(hPrinter);
    IntPtr p = Marshal.AllocHGlobal(data.Length);
    Marshal.Copy(data, 0, p, data.Length);
    int written = 0;
    bool ok = WritePrinter(hPrinter, p, data.Length, out written);
    int we = Marshal.GetLastWin32Error();
    Marshal.FreeHGlobal(p);
    EndPagePrinter(hPrinter);
    EndDocPrinter(hPrinter);
    ClosePrinter(hPrinter);
    if (!ok) return "WritePrinter failed err=" + we;
    return "OK written=" + written;
  }
}
"@
$result = [GposRawPrinter]::SendBytes($printerName, $bytes)
Write-Output $result
if (-not $result.StartsWith('OK')) { exit 1 }
`;

    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      { windowsHide: true },
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      reject(err);
    });
    child.on("close", (code) => {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      const out = (stdout || stderr || "").trim();
      if (code === 0 && out.startsWith("OK")) {
        resolve();
        return;
      }
      reject(
        new Error(
          out ||
            `Windows print fail (exit ${code}). Printer name exact match? Devices and Printers: "${printerName}"`,
        ),
      );
    });
  });
}

function sendToPrinter(cfg, payload) {
  const transport = String(cfg.transport || "tcp").toLowerCase();
  if (transport === "winspool" || transport === "windows" || transport === "usb") {
    return sendViaWinSpool(cfg, payload);
  }
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

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 2_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
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

  if (req.method === "POST" && url.pathname === "/print") {
    try {
      const body = await readJsonBody(req);
      let payload;

      if (body.base64) {
        payload = Buffer.from(String(body.base64), "base64");
      } else if (body.receipt) {
        payload = buildEscPosReceipt(body.receipt, {
          openDrawer: Boolean(body.openDrawer),
          drawerPin: cfg.drawerPin,
          drawerOnMs: cfg.drawerOnMs,
          drawerOffMs: cfg.drawerOffMs,
        });
      } else {
        json(res, 422, {
          ok: false,
          message: "Body mein receipt ya base64 chahiye.",
        });
        return;
      }

      // If raw base64 and openDrawer, prepend kick
      if (body.base64 && body.openDrawer) {
        payload = Buffer.concat([drawerKickBuffer(cfg), payload]);
      }

      await sendToPrinter(cfg, payload);
      json(res, 200, {
        ok: true,
        message: `Print sent (${printerLabel(cfg)})`,
        openDrawer: Boolean(body.openDrawer),
      });
    } catch (err) {
      json(res, 502, {
        ok: false,
        message: err?.message || "Print fail",
        printer: printerLabel(cfg),
      });
    }
    return;
  }

  json(res, 404, { ok: false, message: "Not found. Use GET /health, POST /drawer, POST /print" });
});

server.listen(Number(cfg.listenPort), cfg.listenHost, () => {
  console.log(`[gpos-print-bridge] listening http://${cfg.listenHost}:${cfg.listenPort}`);
  console.log(`[gpos-print-bridge] printer ${printerLabel(cfg)}`);
  console.log(`[gpos-print-bridge] POST /drawer · POST /print`);
});
