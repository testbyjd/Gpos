import { getErrorMessage } from "@/lib/api";
import type { CartLine } from "../types";
import { fetchCatalog } from "./catalog";

/** Refresh cart lines from live catalog so bills use current sell price & stock. */
export async function syncCartWithCatalog(
  lines: CartLine[],
): Promise<{ lines: CartLine[]; priceChanges: string[]; removed: string[] }> {
  const catalog = await fetchCatalog();
  const byId = new Map(catalog.products.map((p) => [p.id, p]));
  const priceChanges: string[] = [];
  const removed: string[] = [];
  const synced: CartLine[] = [];

  for (const line of lines) {
    const fresh = byId.get(line.product.id);
    if (!fresh) {
      removed.push(line.product.name);
      continue;
    }
    if (fresh.price !== line.product.price) {
      priceChanges.push(`${fresh.name}: ${line.product.price} → ${fresh.price}`);
    }
    if (fresh.stock <= 0) {
      throw new Error(`"${fresh.name}" ka stock khatam — pehle purchase karo ya cart se hatao.`);
    }
    synced.push({ ...line, product: fresh });
  }

  if (removed.length > 0) {
    throw new Error(`${removed.join(", ")} ab catalog mein nahi — cart update karo.`);
  }

  return { lines: synced, priceChanges, removed };
}

export function formatSyncError(err: unknown): string {
  return getErrorMessage(err, "Catalog sync fail — dobara try karo.");
}
