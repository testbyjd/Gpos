"use client";

import { useEffect, useMemo, useState } from "react";
import { KeyRound, MonitorCog, ShieldCheck, Store, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChips } from "@/components/ui/filter-chips";
import { getUsersSettings } from "@/lib/admin-api";
import {
  AdminShell,
  DataTable,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";

const ROLES = ["All", "owner", "manager", "cashier"] as const;
type SettingsData = Awaited<ReturnType<typeof getUsersSettings>>;

export default function SettingsPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("All");
  const [data, setData] = useState<SettingsData | null>(null);

  useEffect(() => {
    let alive = true;
    getUsersSettings().then((res) => alive && setData(res)).catch(() => alive && setData(null));
    return () => {
      alive = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const users = data?.data ?? [];
    const q = search.trim().toLowerCase();
    return users.filter((user) => {
      if (role !== "All" && user.role !== role) return false;
      if (q && ![user.name, user.email, user.role].some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data, search, role]);
  const userCount = data?.data.length ?? 0;

  return (
    <AdminShell title="Settings" eyebrow="Store, roles and hardware" allowedRoles={["owner"]} actions={<Button size="sm"><UserPlus className="h-4 w-4" />User</Button>}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid gap-4">
          <PagePanel>
            <PanelHeader title="Users and roles" meta={`${filteredUsers.length} of ${userCount} users`} />
            <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3">
              <SearchInput label="Search user or role" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" containerClassName="w-full sm:w-auto" />
              <div className="ml-auto">
                <FilterChips options={ROLES} value={role} onChange={setRole} aria-label="Filter by role" />
              </div>
            </div>
            <DataTable
              columns={["User", "Email", "Role", "State"]}
              rows={filteredUsers.map((user) => [
                <span key="name" className="font-bold text-foreground">{user.name}</span>,
                user.email,
                <StatusPill key="role" tone={user.role === "owner" ? "info" : user.role === "manager" ? "warn" : "neutral"}>{user.role}</StatusPill>,
                <StatusPill key="state" tone={user.is_active ? "good" : "danger"}>{user.is_active ? "Active" : "Disabled"}</StatusPill>,
              ])}
            />
          </PagePanel>

          <PagePanel>
            <PanelHeader title="Print bridge" meta="Thermal receipt and cash drawer setup" />
            <DataTable
              columns={["Device", "Connection", "State"]}
              rows={(data?.settings.print_bridge ?? []).map((printer) => [
                <span key="device" className="font-bold text-foreground">{printer.device}</span>,
                printer.connection,
                <StatusPill key="state" tone="good">{printer.state}</StatusPill>,
              ])}
            />
          </PagePanel>
        </div>

        <div className="grid gap-4">
          <PagePanel className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-foreground">{data?.settings.store_name ?? "Loading..."}</p>
                <p className="text-xs text-muted-foreground">Single-store MVP · Register #1</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Currency</span><span className="font-bold text-foreground">{data?.settings.currency ?? "PKR"}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Timezone</span><span className="font-bold text-foreground">{data?.settings.timezone ?? "Asia/Karachi"}</span></div>
            </div>
          </PagePanel>

          <PagePanel className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning ring-1 ring-warning/20">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="font-black text-foreground">Manager PIN</p>
                <p className="text-xs text-muted-foreground">Verified through backend auth endpoint</p>
              </div>
            </div>
          </PagePanel>

          <PagePanel className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-muted p-3">
                <ShieldCheck className="h-5 w-5 text-success" />
                <p className="mt-2 text-xs text-muted-foreground">Audit log</p>
                <p className="font-black text-foreground">Enabled</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <MonitorCog className="h-5 w-5 text-primary" />
                <p className="mt-2 text-xs text-muted-foreground">Offline queue</p>
                <p className="font-black text-foreground">Ready</p>
              </div>
            </div>
          </PagePanel>
        </div>
      </div>
    </AdminShell>
  );
}
