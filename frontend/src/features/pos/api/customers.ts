import { apiFetch } from "@/lib/api";
import type { PosCustomer } from "../types";

interface ApiCustomer {
  id: number;
  name: string;
  phone: string | null;
  balance: string | number;
}

/** Khata customers for the POS customer selector (GET /api/v1/customers). */
export async function fetchPosCustomers(): Promise<PosCustomer[]> {
  const res = await apiFetch<{ data: ApiCustomer[] }>("/customers");
  return res.data.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    balance: Number(c.balance),
  }));
}
