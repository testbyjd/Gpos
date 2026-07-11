"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Banknote,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Moon,
  Store,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { getStoredUser, logout } from "@/lib/auth";
import { TaskBell } from "@/features/tasks/components/TaskBell";
import { CashCountModal } from "@/features/till/CashCountModal";
import { Clock } from "./Clock";
import { ConnectionStatus } from "./ConnectionStatus";

const navBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/80 bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-card-hover hover:text-foreground";

export function PosTopBar() {
  const router = useRouter();
  const user = getStoredUser();
  const isCashier = user?.role === "cashier";
  const [showCount, setShowCount] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  function signOut() {
    logout();
    router.replace("/login");
  }

  return (
    <header className="relative z-40 flex h-[3.25rem] shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-white px-3 dark:bg-surface sm:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
          <Store className="h-5 w-5" />
        </div>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-sm font-black text-foreground sm:text-base">
            Gondal Traders Wholesale
          </h1>
          <p className="text-[11px] font-medium text-muted-foreground">Register 402D</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <div className="hidden items-center gap-1.5 md:flex">
          <TaskBell />
          <Link href="/reports" className={navBtn}>
            <ClipboardList className="h-4 w-4" />
            Summary
          </Link>
          <button type="button" onClick={() => setShowCount(true)} className={navBtn}>
            <Banknote className="h-4 w-4" />
            Count cash
          </button>
          {isCashier ? (
            <button type="button" onClick={signOut} className={navBtn}>
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          ) : (
            <Link href="/dashboard" className={navBtn}>
              <LayoutDashboard className="h-4 w-4" />
              Admin
            </Link>
          )}
        </div>

        <ConnectionStatus />
        <div className="hidden h-7 w-px bg-border sm:block" />
        <div className="hidden sm:block">
          <Clock />
        </div>
        <div className="hidden leading-tight text-right lg:block">
          <div className="text-xs font-bold capitalize text-foreground">{user?.role ?? "cashier"}</div>
          <div className="text-[11px] text-muted-foreground">{user?.name ?? "Guest"}</div>
        </div>
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={navBtn}
          aria-label="Toggle dark mode"
        >
          <Moon className="h-4 w-4" />
          <span className="hidden sm:inline">Black</span>
        </button>
      </div>

      {showCount && <CashCountModal onClose={() => setShowCount(false)} />}
    </header>
  );
}
