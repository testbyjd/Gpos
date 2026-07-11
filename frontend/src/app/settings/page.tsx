"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  KeyRound,
  MonitorCog,
  Pencil,
  ShieldCheck,
  Store,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { SearchInput } from "@/components/ui/search-input";
import { FilterChips } from "@/components/ui/filter-chips";
import {
  downloadDatabaseBackup,
  getUsersSettings,
  importDatabaseBackup,
  updateUserPassword,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { logout } from "@/lib/auth";
import { appHref } from "@/lib/app-path";
import { checkPrintBridge, printBridgeBase } from "@/lib/print-bridge";
import { UserFormModal } from "@/features/admin/components/AdminActionModals";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import {
  AdminShell,
  DataTable,
  PageAlert,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";

const ROLES = ["All", "owner", "manager", "cashier"] as const;
type SettingsData = Awaited<ReturnType<typeof getUsersSettings>>;
type UserRow = SettingsData["data"][number];

function ImportBackupModal({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  useModalDismiss(onClose, { escape: false });
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Pehle backup .json file select karo.");
      return;
    }
    if (confirm.trim() !== "RESTORE") {
      setError("Confirm box mein exactly RESTORE likho (sab caps).");
      return;
    }
    setBusy(true);
    try {
      const res = await importDatabaseBackup(file, confirm.trim());
      onDone(res.message);
      onClose();
      // Tokens wipe — force re-login
      window.setTimeout(() => {
        logout();
        window.location.href = appHref("/login");
      }, 1200);
    } catch (err) {
      setError(getErrorMessage(err, "Import fail. File / confirm check karo."));
    } finally {
      setBusy(false);
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
                <h3 className="text-lg font-black text-foreground">Import backup</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Yeh current database ko replace kar dega. Pehle export zaroor lo.
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
                  Backup file (.json)
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-bold file:text-primary-foreground"
                />
                {file && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{file.name}</p>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Type RESTORE to confirm
                </span>
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                  placeholder="RESTORE"
                  className="h-11 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-ring/25"
                />
              </label>

              {error && (
                <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
                  {error}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy ? "Restoring…" : "Restore database"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
function ResetPasswordModal({
  user,
  onClose,
  onSaved,
}: {
  user: UserRow;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  useModalDismiss(onClose, { escape: false });
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
    } catch (err) {
      setError(getErrorMessage(err, "Password update fail. Dobara try karo."));
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
  const { toast, showToast, hideToast } = useAppToast();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [bridge, setBridge] = useState<{ ok: boolean; printer?: string } | null>(null);
  const [showImportBackup, setShowImportBackup] = useState(false);
  const [exporting, setExporting] = useState(false);

  function loadUsers() {
    getUsersSettings()
      .then((res) => {
        setData(res);
        setLoadError(null);
      })
      .catch((err) => {
        setData(null);
        setLoadError(getErrorMessage(err, "Users load nahi hue. Server check karo."));
      });
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let alive = true;
    function ping() {
      checkPrintBridge().then((res) => {
        if (alive) setBridge(res);
      });
    }
    ping();
    const id = window.setInterval(ping, 8000);
    return () => {
      alive = false;
      window.clearInterval(id);
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
    <AdminShell title="Settings" eyebrow="Store, roles and hardware" allowedRoles={["owner"]} actions={<Button size="sm" onClick={() => setShowAddUser(true)}><UserPlus className="h-4 w-4" />User</Button>}>
      {loadError && <PageAlert message={loadError} tone="error" />}
      <AppToast toast={toast} onDismiss={hideToast} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="grid gap-4">
          <PagePanel>
            <PanelHeader title="Users and roles" meta={`${filteredUsers.length} of ${userCount} users · owner edit / reset / add`} />
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
                <div key="actions" className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditUser(user)}
                    aria-label={`Edit ${user.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetUser(user)}
                    aria-label={`Reset password for ${user.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                </div>,
              ])}
            />
          </PagePanel>

          <PagePanel>
            <PanelHeader
              title="Print bridge"
              meta="Local agent — drawer kick + thermal (register PC pe chalao)"
            />
            <DataTable
              columns={["Device", "Connection", "State"]}
              rows={[
                [
                  <span key="device" className="font-bold text-foreground">
                    Local print bridge
                  </span>,
                  bridge?.printer
                    ? `Printer ${bridge.printer}`
                    : printBridgeBase(),
                  <StatusPill key="state" tone={bridge?.ok ? "good" : "danger"}>
                    {bridge == null ? "Checking…" : bridge.ok ? "Ready" : "Offline"}
                  </StatusPill>,
                ],
                ...(data?.settings.print_bridge ?? []).map((printer) => [
                  <span key="device" className="font-bold text-foreground">
                    {printer.device}
                  </span>,
                  printer.connection,
                  <StatusPill key="state" tone="neutral">
                    {printer.state} (server note)
                  </StatusPill>,
                ]),
              ]}
            />
            <p className="border-t border-border/80 px-4 py-3 text-xs text-muted-foreground">
              Register PC: <code className="rounded bg-muted px-1">node print-bridge/server.js</code>
              {" · "}Sale pe drawer auto-open · Receipt sirf Print button se
            </p>
          </PagePanel>

          <PagePanel>
            <PanelHeader
              title="Database backup"
              meta="Full export / import — users, stock, sales, khata, sab"
            />
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                Export se complete JSON backup download hota hai. Import se current DB replace ho jati hai
                (destructive) — pehle export zaroor lo.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={exporting}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      await downloadDatabaseBackup();
                      showToast("Backup download ho gaya.", "success");
                    } catch (err) {
                      showToast(getErrorMessage(err, "Export fail."), "error");
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  <Download className="h-4 w-4" />
                  {exporting ? "Exporting…" : "Export database"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowImportBackup(true)}
                >
                  <Upload className="h-4 w-4" />
                  Import backup
                </Button>
              </div>
            </div>
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
                <p className="mt-2 text-xs text-muted-foreground">Activity log</p>
                <p className="font-black text-foreground">Server-side</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <MonitorCog className="h-5 w-5 text-primary" />
                <p className="mt-2 text-xs text-muted-foreground">Billing mode</p>
                <p className="font-black text-foreground">Online-only</p>
              </div>
            </div>
          </PagePanel>
        </div>
      </div>

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSaved={(msg) => {
            showToast(msg, "success");
            loadUsers();
          }}
        />
      )}

      {showAddUser && (
        <UserFormModal
          onClose={() => setShowAddUser(false)}
          onSaved={(msg) => {
            showToast(msg, "success");
            loadUsers();
          }}
        />
      )}

      {editUser && (
        <UserFormModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={(msg) => {
            showToast(msg, "success");
            loadUsers();
          }}
        />
      )}

      {showImportBackup && (
        <ImportBackupModal
          onClose={() => setShowImportBackup(false)}
          onDone={(msg) => showToast(msg, "success")}
        />
      )}
    </AdminShell>
  );
}
