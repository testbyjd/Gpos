import { apiFetch } from "./api";

const TOKEN_KEY = "gpos.auth.token";
const USER_KEY = "gpos.auth.user";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "owner" | "manager" | "cashier";
  store_id: number | null;
}

const VALID_ROLES: AuthUser["role"][] = ["owner", "manager", "cashier"];

export function homePathForRole(role: AuthUser["role"]): string {
  return role === "cashier" ? "/" : "/dashboard";
}

export async function login(email: string, password: string) {
  const data = await apiFetch<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, device_name: "web-admin" }),
  });

  window.localStorage.setItem(TOKEN_KEY, data.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(data.user));

  return data.user;
}

export function logout() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    const user = JSON.parse(raw) as AuthUser;
    if (!user?.role || !VALID_ROLES.includes(user.role)) {
      logout();
      return null;
    }
    return user;
  } catch {
    logout();
    return null;
  }
}
