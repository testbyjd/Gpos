import { apiFetch } from "@/lib/api";

/** Manager/owner override PIN (cashier POS pe bhi chalega). */
export async function verifyManagerPin(pin: string): Promise<boolean> {
  try {
    const res = await apiFetch<{ ok: boolean }>("/auth/verify-pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    });
    return Boolean(res.ok);
  } catch {
    return false;
  }
}
