"use client";

import { FormEvent, useEffect, useState } from "react";
import { Plus, RefreshCw, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppToast, useAppToast } from "@/components/ui/app-toast";
import { ModalPortal } from "@/components/ui/modal-portal";
import { StatCard } from "@/components/ui/stat-card";
import { useModalDismiss } from "@/lib/hooks/useModalDismiss";
import { cn, formatMoney } from "@/lib/utils";
import { getErrorMessage } from "@/lib/api";
import {
  createExpense,
  createExpenseCategory,
  deleteExpense,
  EXPENSE_PAYMENT_METHODS,
  listExpenseCategories,
  listExpenses,
  type ExpenseCategoryRow,
  type ExpenseRow,
  type ExpenseSummary,
} from "@/lib/admin-api";
import {
  AdminShell,
  DataTable,
  PageLoadError,
  PagePanel,
  PanelHeader,
  StatusPill,
} from "@/features/admin/components/AdminShell";

const inputCls =
  "h-10 w-full rounded-md border border-border bg-input px-3 text-sm font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/25";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted-foreground";

function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function paymentLabel(value: string) {
  return EXPENSE_PAYMENT_METHODS.find((c) => c.value === value)?.label ?? value;
}

function ExpenseFormModal({
  categories,
  onClose,
  onSaved,
  onCategoryAdded,
}: {
  categories: ExpenseCategoryRow[];
  onClose: () => void;
  onSaved: (expense: ExpenseRow) => void;
  onCategoryAdded: (category: ExpenseCategoryRow) => void;
}) {
  useModalDismiss(onClose, { escape: false });
  const [localCategories, setLocalCategories] = useState(categories);
  const [categoryId, setCategoryId] = useState(categories[0] ? String(categories[0].id) : "");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [spentOn, setSpentOn] = useState(todayIso());
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocalCategories(categories);
    if (!categoryId && categories[0]) setCategoryId(String(categories[0].id));
  }, [categories, categoryId]);

  async function addCategory() {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setError("Category name likho.");
      return;
    }
    setAddingCategory(true);
    setError(null);
    try {
      const res = await createExpenseCategory(trimmed);
      setLocalCategories((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setCategoryId(String(res.data.id));
      setNewCategoryName("");
      setShowNewCategory(false);
      onCategoryAdded(res.data);
    } catch (err) {
      setError(getErrorMessage(err, "Category add nahi hui."));
    } finally {
      setAddingCategory(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!categoryId) {
      setError("Category select karo.");
      return;
    }
    if (!value || value <= 0) {
      setError("Sahi amount likho.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await createExpense({
        category_id: Number(categoryId),
        amount: value,
        payment_method: paymentMethod,
        spent_on: spentOn,
        note: note.trim() || null,
      });
      onSaved(res.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Expense save nahi hua."));
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
            className="w-full max-w-md space-y-3 rounded-xl border border-border/80 bg-card p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-black text-foreground">Add expense</h3>
              <p className="text-xs text-muted-foreground">Daily shop kharcha record karo</p>
            </div>
            <label className="block">
              <span className={labelCls}>Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}
                required
              >
                {localCategories.length === 0 && <option value="">No categories</option>}
                {localCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {!showNewCategory ? (
                <button
                  type="button"
                  onClick={() => setShowNewCategory(true)}
                  className="mt-1.5 text-xs font-bold text-primary hover:underline"
                >
                  + New category
                </button>
              ) : (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Shop cleaning"
                    className={inputCls}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={addCategory} disabled={addingCategory}>
                      {addingCategory ? "..." : "Add"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setShowNewCategory(false);
                        setNewCategoryName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </label>
            <label className="block">
              <span className={labelCls}>Amount (Rs)</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputCls}
                autoFocus={!showNewCategory}
                required
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={labelCls}>Paid via</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={inputCls}
                >
                  {EXPENSE_PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Date</span>
                <input
                  type="date"
                  value={spentOn}
                  onChange={(e) => setSpentOn(e.target.value)}
                  className={inputCls}
                  required
                />
              </label>
            </div>
            <label className="block">
              <span className={labelCls}>Note (optional)</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. WAPDA bill July"
                className={inputCls}
              />
            </label>
            {error && (
              <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-bold text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={saving || !categoryId}>
                {saving ? "Saving…" : "Save expense"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}

export default function ExpensesPage() {
  const today = todayIso();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<ExpenseCategoryRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { toast, showToast, hideToast } = useAppToast();

  function loadCategories() {
    return listExpenseCategories()
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]));
  }

  function load() {
    setLoading(true);
    return listExpenses({
      from,
      to,
      categoryId: categoryFilter === "all" ? undefined : Number(categoryFilter),
    })
      .then((res) => {
        setExpenses(res.data);
        setSummary(res.summary);
        setLoadError(null);
      })
      .catch((err) => {
        setExpenses([]);
        setSummary(null);
        setLoadError(getErrorMessage(err, "Expenses load nahi hue."));
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, categoryFilter]);

  async function handleDelete(expense: ExpenseRow) {
    const name = expense.category?.name ?? "Expense";
    if (!window.confirm(`${formatMoney(Number(expense.amount))} · ${name} delete karein?`)) {
      return;
    }
    setDeletingId(expense.id);
    try {
      await deleteExpense(expense.id);
      showToast("Expense delete ho gaya.", "success");
      await load();
    } catch (err) {
      showToast(getErrorMessage(err, "Delete fail."), "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <AdminShell
      title="Expenses"
      eyebrow="Daily shop kharcha"
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => { loadCategories(); load(); }} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" />
            Expense
          </Button>
        </div>
      }
    >
      {loadError ? (
        <PageLoadError message={loadError} onRetry={load} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <PagePanel>
            <PanelHeader
              title="Expense register"
              meta={`${summary?.count ?? expenses.length} entries · ${formatMoney(summary?.period_total ?? 0)}`}
            />
            <div className="flex flex-wrap items-end gap-3 border-b border-border/80 px-4 py-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">From</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={cn(inputCls, "w-40")} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">To</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={cn(inputCls, "w-40")} />
              </label>
              <label className="block min-w-[12rem] flex-1">
                <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Category</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className={inputCls}
                >
                  <option value="all">All categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <DataTable
              columns={["Date", "Category", "Amount", "Paid via", "Note", "By", ""]}
              minWidth="720px"
              emptyLabel="Is range pe koi expense nahi."
              rows={expenses.map((e) => [
                <span key="date" className="tabular-nums text-muted-foreground">
                  {e.spent_on?.slice(0, 10)}
                </span>,
                <span key="cat" className="font-bold text-foreground">
                  {e.category?.name ?? "—"}
                </span>,
                <span key="amt" className="font-black tabular-nums text-danger">
                  {formatMoney(Number(e.amount))}
                </span>,
                <StatusPill key="pay" tone="neutral">
                  {paymentLabel(e.payment_method)}
                </StatusPill>,
                <span key="note" className="max-w-[180px] truncate text-sm text-muted-foreground" title={e.note ?? undefined}>
                  {e.note?.trim() || "—"}
                </span>,
                <span key="by" className="text-xs text-muted-foreground">
                  {e.creator?.name ?? "—"}
                </span>,
                <button
                  key="del"
                  type="button"
                  disabled={deletingId === e.id}
                  onClick={() => handleDelete(e)}
                  aria-label="Delete expense"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>,
              ])}
            />
          </PagePanel>

          <div className="grid content-start gap-4">
            <StatCard label="Today" value={formatMoney(summary?.today_total ?? 0)} icon={Wallet} tone="warning" />
            <StatCard label="Selected range" value={formatMoney(summary?.period_total ?? 0)} icon={Wallet} tone="primary" />
            <PagePanel className="p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">By category</p>
              <ul className="mt-3 space-y-2">
                {(summary?.by_category ?? []).length === 0 ? (
                  <li className="text-sm text-muted-foreground">Koi breakdown nahi.</li>
                ) : (
                  (summary?.by_category ?? []).map((row) => (
                    <li key={`${row.category_id ?? row.category}`} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">{row.category}</span>
                      <span className="font-bold tabular-nums text-foreground">{formatMoney(row.total)}</span>
                    </li>
                  ))
                )}
              </ul>
            </PagePanel>
          </div>
        </div>
      )}

      {showAdd && (
        <ExpenseFormModal
          categories={categories}
          onClose={() => setShowAdd(false)}
          onCategoryAdded={(cat) => {
            setCategories((prev) =>
              prev.some((c) => c.id === cat.id)
                ? prev
                : [...prev, cat].sort((a, b) => a.name.localeCompare(b.name)),
            );
          }}
          onSaved={() => {
            showToast("Expense save ho gaya.", "success");
            load();
          }}
        />
      )}
      <AppToast toast={toast} onDismiss={hideToast} />
    </AdminShell>
  );
}
