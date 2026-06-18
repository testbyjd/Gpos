"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, Store } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getStoredUser, login } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      router.replace(user.role === "cashier" ? "/" : "/dashboard");
    }
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      // Cashiers land on the POS register; owners/managers on the admin panel.
      router.push(user.role === "cashier" ? "/" : "/dashboard");
    } catch {
      setError("Login failed. Check email/password or backend server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="brand-glow flex min-h-screen items-center justify-center px-4 py-8 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/25">
              <Store className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="text-lg font-black">Gondal Traders</h1>
              <p className="text-xs text-muted-foreground">POS access</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <form onSubmit={onSubmit} className="animate-rise rounded-xl border border-border/80 bg-card/95 p-5 shadow-lg backdrop-blur">
          <div className="mb-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Owner, manager and cashier access</p>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                User
              </span>
              <input
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="owner@gondal.local"
                className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Password
              </span>
              <input
                type="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter password"
                className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
              />
            </label>
          </div>

          {error && (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background active:scale-[0.98]"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

