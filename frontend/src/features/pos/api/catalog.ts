import { apiFetch } from "@/lib/api";
import type { Product } from "../types";

interface ApiProduct {
  id: number;
  category: string | null;
  barcode: string | null;
  name: string;
  unit: Product["unit"];
  unit_precision: number;
  price: number;
  stock: number;
  image_url?: string | null;
}

export async function fetchCatalog(): Promise<{ products: Product[]; categories: string[] }> {
  const res = await apiFetch<{ data: ApiProduct[] }>("/inventory/products?per_page=500");
  const products = res.data.map((p) => ({
    id: String(p.id),
    name: p.name,
    category: p.category ?? "Uncategorized",
    barcode: p.barcode ?? undefined,
    price: Number(p.price),
    unit: p.unit,
    fractional: p.unit_precision > 0,
    stock: Number(p.stock),
    imageUrl: p.image_url ?? undefined,
  }));

  return {
    products,
    categories: ["All", ...Array.from(new Set(products.map((p) => p.category)))],
  };
}
