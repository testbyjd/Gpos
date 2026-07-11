/**
 * Local print-bridge client (cash drawer).
 * Bridge must be running on the register PC — see /print-bridge.
 *
 * POS is HTTPS (gondaltrader.com); bridge is http://127.0.0.1 — browsers
 * may prompt for local/loopback network permission and/or require PNA headers.
 */

const DEFAULT_BRIDGE = "http://127.0.0.1:9191";

export function printBridgeBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL?.trim();
  return (fromEnv || DEFAULT_BRIDGE).replace(/\/$/, "");
}

export type DrawerKickResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; offline?: boolean };

/** fetch() options for HTTPS page → local loopback bridge. */
function bridgeFetchInit(init: RequestInit = {}): RequestInit {
  return {
    ...init,
    // Chrome Local Network Access — HTTPS site talking to 127.0.0.1
    // (typed loosely; not all TS lib versions include this yet)
    ...({ targetAddressSpace: "loopback" } as RequestInit),
  };
}

/** Open cash drawer via local bridge. Never throws — safe to fire-and-forget. */
export async function openCashDrawer(): Promise<DrawerKickResult> {
  const base = printBridgeBase();
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(
      `${base}/drawer`,
      bridgeFetchInit({
        method: "POST",
        headers: { Accept: "application/json" },
        signal: ctrl.signal,
      }),
    );
    window.clearTimeout(timer);
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!res.ok || body.ok === false) {
      return {
        ok: false,
        message: body.message || `Drawer kick fail (${res.status})`,
      };
    }
    return { ok: true, message: body.message };
  } catch {
    return {
      ok: false,
      offline: true,
      message:
        "Print bridge offline — Windows pe node server.js chalao, phir Chrome permission Allow karo (local network / 127.0.0.1).",
    };
  }
}

export async function checkPrintBridge(): Promise<{ ok: boolean; printer?: string }> {
  const base = printBridgeBase();
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${base}/health`, bridgeFetchInit({ signal: ctrl.signal }));
    window.clearTimeout(timer);
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { ok?: boolean; printer?: string };
    return { ok: Boolean(body.ok), printer: body.printer };
  } catch {
    return { ok: false };
  }
}

export type DirectPrintResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; offline?: boolean };

/** ESC/POS receipt via local bridge (no Windows print dialog). Optionally opens drawer. */
export async function printReceiptDirect(args: {
  settings: Record<string, unknown>;
  data: Record<string, unknown>;
  openDrawer?: boolean;
}): Promise<DirectPrintResult> {
  const base = printBridgeBase();
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `${base}/print`,
      bridgeFetchInit({
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          openDrawer: args.openDrawer !== false,
          receipt: {
            settings: args.settings,
            data: args.data,
          },
        }),
        signal: ctrl.signal,
      }),
    );
    window.clearTimeout(timer);
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (!res.ok || body.ok === false) {
      return {
        ok: false,
        message: body.message || `Direct print fail (${res.status})`,
      };
    }
    return { ok: true, message: body.message };
  } catch {
    return {
      ok: false,
      offline: true,
      message:
        "Print bridge offline — Windows pe node server.js chalao (naya server.js + escpos-receipt.js).",
    };
  }
}
