"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalPortal } from "@/components/ui/modal-portal";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import {
  createCategory,
  createCustomer,
  createUser,
  createVendor,
  recordVendorPayment,
  updateUser,
  type CategoryRow,
  type CustomerRow,
  type PurchaseRow,
  type UserSettingsRow,
  type VendorRow,
} from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/utils";

const inputCls =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
const labelCls =
  "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

export function CustomerFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (customer: CustomerRow) => void;
}) {
  useModalDismiss(onClose, { escape: false });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name zaroori hai.");
    setSaving(true);
    setError(null);
    try {
      const res = await createCustomer({
        name: name.trim(),
        phone: phone.trim() || null,
        code: code.trim() || null,
      });
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Customer add nahi hua. Dobara try karo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Add customer" subtitle="Khata ledger ke liye naya customer" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Name" value={name} onChange={setName} required />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Code (optional)" value={code} onChange={setCode} placeholder="C-1002" />
        {error && <ErrorBox message={error} />}
        <ModalActions onClose={onClose} saving={saving} submitLabel="Add customer" />
      </form>
    </ModalShell>
  );
}

export function VendorFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (vendor: VendorRow) => void;
}) {
  useModalDismiss(onClose, { escape: false });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Vendor name zaroori hai.");
    setSaving(true);
    setError(null);
    try {
      const res = await createVendor({
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Vendor add nahi hua."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Add vendor" subtitle="Supplier directory mein naya vendor" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Vendor name" value={name} onChange={setName} required />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Address" value={address} onChange={setAddress} />
        {error && <ErrorBox message={error} />}
        <ModalActions onClose={onClose} saving={saving} submitLabel="Add vendor" />
      </form>
    </ModalShell>
  );
}

const USER_ROLES = ["owner", "manager", "cashier"] as const;
type UserRole = (typeof USER_ROLES)[number];

export function UserFormModal({
  user,
  onClose,
  onSaved,
}: {
  user?: UserSettingsRow | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  useModalDismiss(onClose, { escape: false });
  const isEdit = user != null;
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>((user?.role as UserRole) ?? "cashier");
  const [isActive, setIsActive] = useState(user?.is_active ?? true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      return setError("Name aur email zaroori hain.");
    }
    if (!isEdit && password.length < 6) {
      return setError("Naye user ke liye password (6+ chars) zaroori hai.");
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && user) {
        const res = await updateUser(user.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          is_active: isActive,
          pin: pin.trim() || undefined,
        });
        onSaved(res.message);
      } else {
        const res = await createUser({
          name: name.trim(),
          email: email.trim(),
          password,
          role,
          pin: pin.trim() || undefined,
        });
        onSaved(`${res.data.name} add ho gaya (${res.data.role}).`);
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Save fail. Dobara try karo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell
      title={isEdit ? "Edit user" : "Add user"}
      subtitle={isEdit ? "Name, role, active state update karo" : "Owner, manager ya cashier account"}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Full name" value={name} onChange={setName} required />
        <Field label="Email" value={email} onChange={setEmail} type="email" required />
        {!isEdit && (
          <Field label="Password" value={password} onChange={setPassword} type="password" required />
        )}
        <label className="block">
          <span className={labelCls}>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className={inputCls}>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
        </label>
        {isEdit && (
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Account active
          </label>
        )}
        <Field
          label={isEdit ? "New PIN (optional, blank = no change)" : "PIN (optional)"}
          value={pin}
          onChange={setPin}
          placeholder="1234"
        />
        {error && <ErrorBox message={error} />}
        <ModalActions onClose={onClose} saving={saving} submitLabel={isEdit ? "Save changes" : "Add user"} />
      </form>
    </ModalShell>
  );
}

export function CategoryFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (category: CategoryRow) => void;
}) {
  useModalDismiss(onClose, { escape: false });
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Category name zaroori hai.");
    setSaving(true);
    setError(null);
    try {
      const res = await createCategory(name.trim());
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Category add nahi hui. Dobara try karo."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Add category" subtitle="Product grouping ke liye nayi category" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Category name" value={name} onChange={setName} required placeholder="e.g. Bakery" />
        {error && <ErrorBox message={error} />}
        <ModalActions onClose={onClose} saving={saving} submitLabel="Add category" />
      </form>
    </ModalShell>
  );
}

export function VendorPaymentModal({
  invoices,
  onClose,
  onSaved,
}: {
  invoices: PurchaseRow[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  useModalDismiss(onClose, { escape: false });
  const open = invoices.filter((p) => Number(p.balance_amount) > 0);
  const [purchaseId, setPurchaseId] = useState(open[0] ? String(open[0].id) : "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = open.find((p) => String(p.id) === purchaseId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!purchaseId || !amt || amt <= 0) return setError("Invoice aur amount select karo.");
    setSaving(true);
    setError(null);
    try {
      const res = await recordVendorPayment(Number(purchaseId), amt, note.trim() || undefined);
      onSaved(res.message);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Payment record nahi hui."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Record payment" subtitle="Vendor GRN ke against payment" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground">Koi open invoice nahi — sab clear hai.</p>
        ) : (
          <>
            <label className="block">
              <span className={labelCls}>Open invoice</span>
              <select value={purchaseId} onChange={(e) => setPurchaseId(e.target.value)} className={inputCls}>
                {open.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.grn_no} · {p.vendor?.name ?? "Vendor"} · due {formatMoney(Number(p.balance_amount))}
                  </option>
                ))}
              </select>
            </label>
            {selected && (
              <p className="text-xs text-muted-foreground">
                Balance: {formatMoney(Number(selected.balance_amount))}
              </p>
            )}
            <Field label="Payment amount (Rs)" value={amount} onChange={setAmount} type="number" required />
            <Field label="Note (optional)" value={note} onChange={setNote} />
          </>
        )}
        {error && <ErrorBox message={error} />}
        <ModalActions
          onClose={onClose}
          saving={saving}
          submitLabel="Record payment"
          disableSubmit={open.length === 0}
        />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/50 p-4 py-8 backdrop-blur-sm">
        <div className="flex min-h-full items-center justify-center">
          <div className="w-full max-w-md rounded-xl border border-border/80 bg-card p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-foreground">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className={inputCls}
      />
    </label>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
      {message}
    </p>
  );
}

function ModalActions({
  onClose,
  saving,
  submitLabel,
  disableSubmit,
}: {
  onClose: () => void;
  saving: boolean;
  submitLabel: string;
  disableSubmit?: boolean;
}) {
  return (
    <div className="mt-5 flex gap-2">
      <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" className="flex-1" disabled={saving || disableSubmit}>
        {saving ? "Saving..." : submitLabel}
      </Button>
    </div>
  );
}
