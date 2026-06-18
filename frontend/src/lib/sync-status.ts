/** Stable value for SSR / hydration — never use Date.now() at module load. */
export const SYNC_SSR_SNAPSHOT = Date.UTC(2026, 5, 18, 12, 0, 0);

let lastSyncAt: number | null = null;
const listeners = new Set<() => void>();

function ensureLastSyncAt(): number {
  if (lastSyncAt === null) {
    lastSyncAt = Date.now() - 2 * 60_000;
  }
  return lastSyncAt;
}

export function getLastSyncAt(): number {
  return ensureLastSyncAt();
}

export function getLastSyncAtServerSnapshot(): number {
  return SYNC_SSR_SNAPSHOT;
}

export function recordSync(at = Date.now()) {
  lastSyncAt = at;
  listeners.forEach((listener) => listener());
}

export function subscribeSync(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatLastSync(syncAt: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - syncAt) / 1000));
  if (diffSec < 15) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 60 * 60) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86_400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(syncAt).toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatLastSyncFull(syncAt: number): string {
  return new Date(syncAt).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
