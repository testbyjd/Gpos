import { listAllProducts } from "@/lib/admin-api";
import type { Product } from "../types";

export async function fetchCatalog(): Promise<{ products: Product[]; categories: string[] }> {
  const rows = await listAllProducts();
  const products = rows.map((p) => ({
    id: String(p.id),
    name: p.name,
    category: p.category ?? "Uncategorized",
    barcode: p.barcode ?? undefined,
    price: Number(p.sell_price),
    unit: p.unit as Product["unit"],
    fractional: p.fractional ?? (p.unit_precision ?? 0) > 0,
    stock: Number(p.stock_qty),
    imageUrl: p.image_url ?? undefined,
  }));

  return {
    products,
    categories: ["All", ...Array.from(new Set(products.map((p) => p.category)))],
  };
}
