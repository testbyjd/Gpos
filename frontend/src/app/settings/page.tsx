"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { KeyRound, MonitorCog, ShieldCheck, Store, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChips } from "@/components/ui/filter-chips";
import { getUsersSettings, updateUserPassword } from "@/lib/admin-api";
import { UserFormModal } from "@/features/admin/components/AdminActionModals";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import {
  AdminShell,
  DataTable,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";

const ROLES = ["All", "owner", "manager", "cashier"] as const;
type SettingsData = Awaited<ReturnType<typeof getUsersSettings>>;
type UserRow = SettingsData["data"][number];

function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  useModalDismiss(onClose);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Password kam az kam 6 characters hona chahiye.");
      return;
    }
    if (password !== confirm) {
      setError("Password aur confirm match nahi kar rahe.");
      return;
    }
    setSaving(true);
    try {
      const res = await updateUserPassword(user.id, password);
      onSaved(res.message);
      onClose();
    } catch {
      setError("Password update fail. Dobara try karo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4 py-8 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-md rounded-xl border border-border/80 bg-card p-5 shadow-xl"
          >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-foreground">Reset password</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.name} · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              New password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Confirm password
            </span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Saving..." : "Update password"}
          </Button>
        </div>
      </form>
        </div>
      </div>
    </ModalPortal>
  );
}

export default function SettingsPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("All");
  const [data, setData] = useState<SettingsData | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);

  function loadUsers() {
    getUsersSettings().then(setData).catch(() => setData(null));
  }

  useEffect(() => {
    loadUsers();
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
    <AdminShell title="Settings" eyebrow="Store, roles and hardware" allowedRoles={["owner"]} actions={<Button size="sm" onClick={() => setShowAddUser(true)}><UserPlus className="h-4 w-4" />User</Button>}>
      {notice && (
        <div className="mb-4 rounded-lg border border-border/80 bg-muted/60 px-4 py-3 text-sm font-semibold text-foreground">
          {notice}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid gap-4">
          <PagePanel>
            <PanelHeader title="Users and roles" meta={`${filteredUsers.length} of ${userCount} users · owner can reset any password`} />
            <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-4 py-3">
              <SearchInput label="Search user or role" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-56" containerClassName="w-full sm:w-auto" />
              <div className="ml-auto">
                <FilterChips options={ROLES} value={role} onChange={setRole} aria-label="Filter by role" />
              </div>
            </div>
            <DataTable
              columns={["User", "Email", "Role", "State", ""]}
              rows={filteredUsers.map((user) => [
                <span key="name" className="font-bold text-foreground">{user.name}</span>,
                user.email,
                <StatusPill key="role" tone={user.role === "owner" ? "info" : user.role === "manager" ? "warn" : "neutral"}>{user.role}</StatusPill>,
                <StatusPill key="state" tone={user.is_active ? "good" : "danger"}>{user.is_active ? "Active" : "Disabled"}</StatusPill>,
                <button
                  key="password"
                  type="button"
                  onClick={() => setResetUser(user)}
                  aria-label={`Reset password for ${user.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                >
                  <KeyRound className="h-4 w-4" />
                </button>,
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
                <p className="font-black text-foreground">Password reset</p>
                <p className="text-xs text-muted-foreground">Owner kisi bhi staff account ka password change kar sakta hai</p>
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

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSaved={setNotice}
        />
      )}

      {showAddUser && (
        <UserFormModal
          onClose={() => setShowAddUser(false)}
          onSaved={(msg) => {
            setNotice(msg);
            loadUsers();
          }}
        />
      )}
    </AdminShell>
  );
}
