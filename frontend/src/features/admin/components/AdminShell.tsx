"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  Receipt,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ConnectionStatus } from "@/features/pos/components/ConnectionStatus";
import { getStoredUser, logout, type AuthUser } from "@/lib/auth";

type Role = AuthUser["role"];
type NavItem = {
  href: string;
  label: string;
  icon: typeof ShoppingCart;
  roles?: Role[];
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "POS", icon: ShoppingCart },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/khata", label: "Khata", icon: UsersRound },
  { href: "/vendors", label: "Vendors", icon: Truck },
  { href: "/payables", label: "Payables", icon: ReceiptText },
  { href: "/purchases", label: "Purchases", icon: PackagePlus },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["owner"] },
  { href: "/receipt", label: "Receipt", icon: Receipt, roles: ["owner"] },
];

interface AdminShellProps {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  allowedRoles?: Role[];
  children: ReactNode;
}

export function AdminShell({ title, eyebrow, actions, allowedRoles = ["owner", "manager"], children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const allowed = user !== null && allowedRoles.includes(user.role);
  const roleLabel = user?.role === "manager" ? "Manager Console" : "Owner Console";
  const initials = (user?.name ?? "GT")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    setUser(getStoredUser());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login");
    } else if (!allowed) {
      router.replace(user.role === "cashier" ? "/" : "/dashboard");
    }
  }, [ready, user, allowed, router]);

  function signOut() {
    logout();
    router.replace("/login");
  }

  if (!ready || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center text-sm font-semibold text-muted-foreground">
        Checking session...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border/80 bg-surface/95 md:flex md:flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border/80 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/25">
            <Store className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-bold">Gondal Traders</div>
            <div className="text-xs text-muted-foreground">{roleLabel}</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role)).map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:bg-card-hover hover:text-foreground",
                )}
              >
                <Icon
                  className={cn(
                    "h-[1.125rem] w-[1.125rem] transition-transform",
                    !active && "group-hover:scale-110",
                  )}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-border/80 p-3">
          <div className="flex items-center gap-3 rounded-md bg-muted/60 px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-black text-primary ring-1 ring-primary/25">
              {initials}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-bold text-foreground">{user?.name ?? "Signed in"}</div>
              <div className="truncate text-xs capitalize text-muted-foreground">{user?.role ?? "user"}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <LogOut className="h-[1.125rem] w-[1.125rem]" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-30 border-b border-border/80 bg-surface/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-3 px-4 md:px-6">
            <div className="min-w-0">
              {eyebrow && (
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {eyebrow}
                </div>
              )}
              <h1 className="truncate text-xl font-black text-foreground md:text-2xl">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <ConnectionStatus />
              {actions}
              <ThemeToggle />
            </div>
          </div>

          <nav className="flex gap-1 overflow-x-auto border-t border-border/70 px-3 py-2 md:hidden">
            {NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role)).map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground ring-1 ring-border/80 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </header>

        <main key={pathname} className="animate-rise px-4 py-4 md:px-6 md:py-5">
          {children}
        </main>
      </div>
    </div>
  );
}

export function PagePanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border/80 bg-card shadow-sm",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-black text-foreground">{title}</h2>
        {meta && <p className="mt-0.5 text-xs text-muted-foreground">{meta}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "danger" | "info";
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-bold",
        tone === "good" && "bg-success/10 text-success ring-1 ring-success/25",
        tone === "warn" && "bg-warning/10 text-warning ring-1 ring-warning/25",
        tone === "danger" && "bg-danger/10 text-danger ring-1 ring-danger/25",
        tone === "info" && "bg-accent/10 text-accent ring-1 ring-accent/25",
        tone === "neutral" && "bg-muted text-muted-foreground ring-1 ring-border/70",
      )}
    >
      {children}
    </span>
  );
}

export function DataTable({
  columns,
  rows,
  minWidth = "720px",
  onRowClick,
  emptyLabel = "No matching records found.",
}: {
  columns: string[];
  rows: ReactNode[][];
  minWidth?: string;
  onRowClick?: (index: number) => void;
  emptyLabel?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ minWidth }}>
        <thead className="bg-muted/70 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-muted-foreground">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={onRowClick ? () => onRowClick(rowIndex) : undefined}
                className={cn(
                  "transition-colors hover:bg-card-hover",
                  onRowClick && "cursor-pointer",
                )}
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
