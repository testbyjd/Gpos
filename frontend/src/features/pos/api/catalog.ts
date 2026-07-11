import { listAllProducts } from "@/lib/admin-api";
import type { Product } from "../types";

/** POS pe sirf kg decimal (0.200) mein sell hoti hai. */
export function isKgUnit(unit: string | null | undefined): boolean {
  return String(unit ?? "").trim().toLowerCase() === "kg";
}

export async function fetchCatalog(): Promise<{ products: Product[]; categories: string[] }> {
  const rows = await listAllProducts();
  const products = rows.map((p) => ({
    id: String(p.id),
    name: p.name,
    category: p.category ?? "Uncategorized",
    barcode: p.barcode ?? undefined,
    price: Number(p.sell_price),
    cost: Number(p.avg_cost ?? 0),
    unit: p.unit as Product["unit"],
    fractional: isKgUnit(p.unit),
    stock: Number(p.stock_qty),
    imageUrl: p.image_url ?? undefined,
  }));

  return {
    products,
    categories: ["All", ...Array.from(new Set(products.map((p) => p.category)))],
  };
}
