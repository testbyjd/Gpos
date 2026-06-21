import { logout } from "./auth";

const DEFAULT_API_BASE = "http://localhost:8000/api/v1";

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function humanStatusMessage(status: number): string {
  if (status === 401) return "Session expire — dobara login karo.";
  if (status === 403) return "Is action ki permission nahi hai.";
  if (status === 404) return "Resource nahi mila.";
  if (status === 422) return "Form data galat hai — fields check karo.";
  if (status >= 500) return "Server error — thori der baad try karo.";
  return "Request fail. Dobara try karo.";
}

function parseErrorBody(status: number, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return humanStatusMessage(status);

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof json.message === "string" && json.message.trim()) return json.message.trim();

    if (json.errors && typeof json.errors === "object" && json.errors !== null) {
      const parts = Object.entries(json.errors as Record<string, unknown>).flatMap(([field, val]) => {
        if (Array.isArray(val)) return val.filter((x): x is string => typeof x === "string").map((m) => `${field}: ${m}`);
        if (typeof val === "string") return [`${field}: ${val}`];
        return [];
      });
      if (parts.length) return parts.join(" · ");
    }
  } catch {
    if (trimmed.length < 240 && !trimmed.startsWith("<")) return trimmed;
  }

  return humanStatusMessage(status);
}

/** User-facing message from any thrown API/client error. */
export function getErrorMessage(err: unknown, fallback = "Request fail. Dobara try karo."): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("gpos.auth.token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && typeof window !== "undefined") {
      logout();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=1";
      }
    }
    throw new ApiError(res.status, parseErrorBody(res.status, body));
  }

  return res.json() as Promise<T>;
}

/** Multipart upload — do not set Content-Type (browser adds boundary). */
export async function apiUpload<T>(path: string, formData: FormData, method = "POST"): Promise<T> {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("gpos.auth.token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    body: formData,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && typeof window !== "undefined") {
      logout();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login?expired=1";
      }
    }
    throw new ApiError(res.status, parseErrorBody(res.status, body));
  }

  return res.json() as Promise<T>;
}

/** Turn API `/storage/...` paths into absolute URLs for `<img src>`. */
export function resolveAssetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const data = await apiFetch<{ ok: boolean }>("/health", { cache: "no-store" });
    return data.ok;
  } catch {
    return false;
  }
}
