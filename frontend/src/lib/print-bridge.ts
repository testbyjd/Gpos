/**
 * Local print-bridge client (cash drawer).
 * Bridge must be running on the register PC — see /print-bridge.
 */

const DEFAULT_BRIDGE = "http://127.0.0.1:9191";

export function printBridgeBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PRINT_BRIDGE_URL?.trim();
  return (fromEnv || DEFAULT_BRIDGE).replace(/\/$/, "");
}

export type DrawerKickResult =
  | { ok: true; message?: string }
  | { ok: false; message: string; offline?: boolean };

/** Open cash drawer via local bridge. Never throws — safe to fire-and-forget. */
export async function openCashDrawer(): Promise<DrawerKickResult> {
  const base = printBridgeBase();
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(`${base}/drawer`, {
      method: "POST",
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    });
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
      message: "Print bridge offline — drawer open nahi hua (node print-bridge/server.js chalao).",
    };
  }
}

export async function checkPrintBridge(): Promise<{ ok: boolean; printer?: string }> {
  const base = printBridgeBase();
  try {
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    window.clearTimeout(timer);
    if (!res.ok) return { ok: false };
    const body = (await res.json()) as { ok?: boolean; printer?: string };
    return { ok: Boolean(body.ok), printer: body.printer };
  } catch {
    return { ok: false };
  }
}
