"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, LayoutDashboard, LogOut, Store } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { getStoredUser, logout } from "@/lib/auth";
import { CashCountModal } from "@/features/till/CashCountModal";
import { Clock } from "./Clock";
import { ConnectionStatus } from "./ConnectionStatus";

export function PosTopBar() {
  const router = useRouter();
  const user = getStoredUser();
  const isCashier = user?.role === "cashier";
  const [showCount, setShowCount] = useState(false);

  function signOut() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-surface/95 px-4 shadow-sm backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/25">
          <Store className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-bold text-foreground">Gondal Traders</h1>
          <p className="text-xs text-muted-foreground">POS Register #1</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowCount(true)}
          className="flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-card-hover hover:text-foreground"
        >
          <Banknote className="h-4 w-4" />
          <span className="hidden sm:inline">Count cash</span>
        </button>
        {isCashier ? (
          <button
            type="button"
            onClick={signOut}
            className="hidden h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground lg:flex"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        ) : (
          <Link
            href="/dashboard"
            className="hidden h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground lg:flex"
          >
            <LayoutDashboard className="h-4 w-4" />
            Admin
          </Link>
        )}
        <ConnectionStatus />
        <div className="hidden items-center gap-3 sm:flex">
          <div className="h-7 w-px bg-border" />
          <Clock />
          <div className="h-7 w-px bg-border" />
          <div className="leading-tight text-right">
            <div className="text-sm font-semibold text-foreground">{user?.role ?? "Cashier"}</div>
            <div className="text-xs text-muted-foreground">{user?.name ?? "Guest"}</div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {showCount && <CashCountModal onClose={() => setShowCount(false)} />}
    </header>
  );
}
