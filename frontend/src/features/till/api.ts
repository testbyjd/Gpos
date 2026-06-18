import { apiFetch } from "@/lib/api";

/**
 * Till summary from GET /api/v1/till/current.
 *
 * For cashiers the backend strips `opening_float`, `cash_sales` and
 * `expected_cash` (blind count) — so those fields are optional here and
 * only present for manager/owner sessions.
 */
export interface TillSummary {
  id: number;
  register_name: string;
  opened_at: string | null;
  card_total: number;
  wallet_total: number;
  khata_total: number;
  sales_count: number;
  opening_float?: number;
  cash_sales?: number;
  expected_cash?: number;
}

export async function getTillSummary(): Promise<TillSummary> {
  const res = await apiFetch<{ data: TillSummary }>("/till/current", { cache: "no-store" });
  return res.data;
}

export interface CloseTillPayload {
  counted_cash: number;
  retained_float: number;
  denominations?: Record<string, number>;
  notes?: string;
}

/** Reconciled session returned by POST /api/v1/till/close (decimals as strings). */
export interface ClosedTill {
  id: number;
  expected_cash: string;
  counted_cash: string;
  retained_float: string;
  handed_over: string;
  variance: string;
}

export async function closeTill(payload: CloseTillPayload): Promise<ClosedTill> {
  const res = await apiFetch<{ data: ClosedTill }>("/till/close", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}
