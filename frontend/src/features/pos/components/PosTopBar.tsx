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
  Sun,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { getStoredUser, logout } from "@/lib/auth";
import { TaskBell } from "@/features/tasks/components/TaskBell";
import { CashCountModal } from "@/features/till/CashCountModal";
import { Clock } from "./Clock";
import { ConnectionStatus } from "./ConnectionStatus";

const navBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border/70 bg-card/80 px-3 text-sm font-semibold text-muted-foreground shadow-sm transition-all hover:-translate-y-px hover:border-primary/25 hover:bg-card hover:text-foreground hover:shadow-md active:translate-y-0 active:scale-[0.98]";

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
    <header className="relative z-40 flex h-[3.75rem] shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-surface/95 px-3 shadow-[0_1px_12px_rgb(15_23_42/0.04)] backdrop-blur-xl sm:px-5">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-md shadow-primary/20 ring-1 ring-white/20">
          <Store className="h-5 w-5" />
          <Sparkles className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-surface p-0.5 text-primary" />
        </div>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-sm font-black tracking-tight text-foreground sm:text-base">
            Gondal Traders Wholesale
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_0_3px_color-mix(in_oklab,var(--success),transparent_82%)]" />
            Register 402D · Ready
          </p>
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
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
        </button>
      </div>

      {showCount && <CashCountModal onClose={() => setShowCount(false)} />}
    </header>
  );
}
