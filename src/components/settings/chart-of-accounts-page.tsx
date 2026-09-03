"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, MessageSquarePlus, Pencil, Printer, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast/toast-context";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { ACCOUNT_ROOT_GROUPS } from "@/modules/accounting/domain/accounting-reports";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { buildRollupHierarchyRows, filterCollapsed } from "@/lib/accounting/account-hierarchy";
import type { HierarchyRow } from "@/lib/accounting/account-hierarchy";
import type { Account } from "@/modules/accounting/domain/models";
import { AccountRegisterView } from "@/components/settings/account-register-view";

const CATEGORY_OPTIONS = ACCOUNT_ROOT_GROUPS.flatMap((group) =>
  [...group.categories].map((category) => ({ value: category, label: ACCOUNT_CATEGORY_LABELS[category] }))
);
const TYPE_FILTER_OPTIONS = [{ value: "", label: "All" }, ...CATEGORY_OPTIONS];

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Next code in the shared incrementing sequence every seeded account already uses (1000, 1010, 1020, ...). */
function nextAccountCode(accounts: Account[]): string {
  const highest = accounts.reduce((max, account) => {
    const numeric = Number(account.code);
    return Number.isFinite(numeric) && numeric > max ? numeric : max;
  }, 990);
  return String(highest + 10);
}

export function ChartOfAccountsPage() {
  const services = useMemo(() => getServiceContainer(), []);
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Chart of Accounts and the account register are one screen with two
  // internal views (like Reconcile's Reconcile/Summary/History) -- "View
  // register" switches into a read-only ledger for that account without
  // navigating to (or touching) the real /register.
  const [registerAccountId, setRegisterAccountId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Account["category"]>("BANK");
  const [newOpeningBalance, setNewOpeningBalance] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [newAccountMenuOpen, setNewAccountMenuOpen] = useState(false);
  const newAccountMenuRef = useRef<HTMLDivElement>(null);

  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [collapsedNames, setCollapsedNames] = useState<Set<string>>(new Set());

  const [batchEditOpen, setBatchEditOpen] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState<Record<string, string>>({});
  const [batchSaving, setBatchSaving] = useState(false);

  function toggleCollapse(fullName: string) {
    setCollapsedNames((current) => {
      const next = new Set(current);
      next.has(fullName) ? next.delete(fullName) : next.add(fullName);
      return next;
    });
  }

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<Account["category"]>("EXPENSE");
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);

  useEffect(() => {
    if (!newAccountMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (newAccountMenuRef.current && !newAccountMenuRef.current.contains(event.target as Node)) setNewAccountMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [newAccountMenuOpen]);

  async function loadAccounts() {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await services.accountService.listAccounts();
      setAccounts(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load the chart of accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.status !== "ARCHIVED" &&
          (search.trim() === "" || a.name.toLowerCase().includes(search.trim().toLowerCase())) &&
          (typeFilter === "" || a.category === typeFilter)
      ),
    [accounts, search, typeFilter]
  );

  // Real hierarchy tree (colon-segment parents roll up their children's
  // balances), not a flat per-category list -- reuses the same helper the
  // P&L/Balance Sheet/Trial Balance reports already use. A parent segment
  // with no account of its own (e.g. "Travel" when only "Travel:Airfare"
  // and "Travel:Hotels" exist) is a synthetic rollup row: shown with its
  // children's summed balance, but no actions, since there's no real
  // account behind it to act on.
  const sections = useMemo(
    () =>
      ACCOUNT_ROOT_GROUPS.map((group) => {
        const groupAccounts = activeAccounts.filter((a) => group.categories.has(a.category));
        const rows = buildRollupHierarchyRows(groupAccounts.map((a) => ({ name: a.name, amount: a.currentBalance })));
        const accountByName = new Map(groupAccounts.map((a) => [a.name, a]));
        return { ...group, rows, accountByName };
      }),
    [activeAccounts]
  );

  function startAdd() {
    setEditingAccount(null);
    setNewName("");
    setNewCategory("BANK");
    setNewOpeningBalance("");
    setShowAddForm(true);
    setNewAccountMenuOpen(false);
  }

  function startEdit(account: Account) {
    setEditingAccount(account);
    setNewName(account.name);
    setNewCategory(account.category);
    setNewOpeningBalance("");
    setShowAddForm(true);
  }

  function startSubaccount(parent: Account) {
    setEditingAccount(null);
    setNewName(`${parent.name}:`);
    setNewCategory(parent.category);
    setNewOpeningBalance("");
    setShowAddForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      if (editingAccount) {
        await services.accountService.updateAccount(editingAccount.id, { name: newName.trim() });
        toast({ variant: "success", title: "Account updated" });
      } else {
        const openingBalance = Number(newOpeningBalance);
        await services.accountService.createAccount({
          code: nextAccountCode(accounts),
          name: newName.trim(),
          category: newCategory,
          currency: "USD",
          openingBalance: newOpeningBalance.trim() && Number.isFinite(openingBalance) ? openingBalance : undefined
        });
        toast({ variant: "success", title: "Account created", description: `"${newName.trim()}" was added to the chart of accounts.` });
      }
      setNewName("");
      setNewOpeningBalance("");
      setEditingAccount(null);
      setShowAddForm(false);
      await loadAccounts();
    } catch (err) {
      toast({ variant: "error", title: editingAccount ? "Could not update this account" : "Could not create this account", description: err instanceof Error ? err.message : undefined });
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(account: Account) {
    setBusyAccountId(account.id);
    try {
      await services.accountService.updateAccount(account.id, { status: "ARCHIVED" });
      await loadAccounts();
      toast({ variant: "success", title: "Account made inactive", description: `"${account.name}" is no longer active.` });
    } catch (err) {
      toast({ variant: "error", title: "Could not update this account", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyAccountId(null);
    }
  }

  async function handleBulkImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (names.length === 0) return;

    setBulkImporting(true);
    let created = 0;
    let nextCode = Number(nextAccountCode(accounts));
    const failures: string[] = [];

    for (const name of names) {
      try {
        await services.accountService.createAccount({
          code: String(nextCode),
          name,
          category: bulkCategory,
          currency: "USD"
        });
        nextCode += 10;
        created += 1;
      } catch (err) {
        failures.push(`${name}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    await loadAccounts();
    setBulkImporting(false);
    if (failures.length > 0) {
      toast({
        variant: "error",
        title: `Imported ${created} of ${names.length} account${names.length === 1 ? "" : "s"}`,
        description: failures.join("\n")
      });
    } else {
      toast({ variant: "success", title: `Imported ${created} account${created === 1 ? "" : "s"}` });
      setBulkText("");
      setBulkOpen(false);
    }
  }

  function startBatchEdit() {
    setBatchDrafts(Object.fromEntries(activeAccounts.map((a) => [a.id, a.name])));
    setBatchEditOpen(true);
  }

  function cancelBatchEdit() {
    setBatchEditOpen(false);
    setBatchDrafts({});
  }

  async function saveBatchEdit() {
    const changed = activeAccounts.filter((a) => batchDrafts[a.id]?.trim() && batchDrafts[a.id].trim() !== a.name);
    if (changed.length === 0) {
      cancelBatchEdit();
      return;
    }
    setBatchSaving(true);
    try {
      await Promise.all(changed.map((a) => services.accountService.updateAccount(a.id, { name: batchDrafts[a.id].trim() })));
      await loadAccounts();
      toast({ variant: "success", title: `Updated ${changed.length} account${changed.length === 1 ? "" : "s"}` });
      cancelBatchEdit();
    } catch (err) {
      toast({ variant: "error", title: "Could not save all changes", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBatchSaving(false);
    }
  }

  if (registerAccountId) {
    return (
      <AccountRegisterView
        accountId={registerAccountId}
        accounts={accounts}
        onBack={() => setRegisterAccountId(null)}
        onChangeAccount={setRegisterAccountId}
      />
    );
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text-global)]">Chart of accounts</h1>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-text-disabled)]">All lists</span>
        <div className="flex items-center gap-4">
          <button type="button" disabled title="Not available yet" className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Give feedback
          </button>
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            Run report
          </button>
          <div className="relative flex overflow-hidden rounded-full" ref={newAccountMenuRef}>
            <Button className="rounded-r-none" onClick={startAdd}>
              New account
            </Button>
            <Button className="rounded-l-none border-l border-l-white/20 px-2" aria-label="More new-account options" onClick={() => setNewAccountMenuOpen((v) => !v)}>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            {newAccountMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setNewAccountMenuOpen(false);
                    setBulkOpen(true);
                    startAdd();
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                >
                  Import accounts
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showAddForm ? (
        <Card
          title={editingAccount ? "Edit account" : "Add an account"}
          description={editingAccount ? "Only the name can be changed here." : "Give it a friendly name -- it's grouped under the category you pick."}
          className="mb-6"
        >
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <InputField label="Account name" placeholder="e.g. Chase Checking" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            {!editingAccount ? (
              <>
                <div className="w-56">
                  <Select
                    label="Category"
                    value={newCategory}
                    onChange={(value) => setNewCategory(value as Account["category"])}
                    options={CATEGORY_OPTIONS}
                    placeholder="Category"
                    allowCustomValue={false}
                  />
                </div>
                <div className="w-40">
                  <NumberField
                    label="Opening balance"
                    currency
                    placeholder="0.00"
                    value={newOpeningBalance}
                    onChange={(e) => setNewOpeningBalance(e.target.value)}
                  />
                </div>
              </>
            ) : null}
            <Button type="submit" disabled={creating || newName.trim() === ""}>
              {creating ? "Saving…" : editingAccount ? "Save changes" : "Add account"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowAddForm(false);
                setEditingAccount(null);
                setBulkOpen(false);
              }}
            >
              Cancel
            </Button>
            {!editingAccount ? (
              <Button type="button" variant="secondary" onClick={() => setBulkOpen((open) => !open)}>
                {bulkOpen ? "Cancel bulk import" : "Bulk import"}
              </Button>
            ) : null}
          </form>

          {bulkOpen && !editingAccount ? (
            <form onSubmit={handleBulkImport} className="mt-4 flex flex-col gap-3 border-t border-[var(--color-divider-tertiary)] pt-4">
              <p className="text-sm text-[var(--color-text-primary)]">
                One account name per line. All imported accounts use the category below.
              </p>
              <div className="w-56">
                <Select
                  label="Category"
                  value={bulkCategory}
                  onChange={(value) => setBulkCategory(value as Account["category"])}
                  options={CATEGORY_OPTIONS}
                  placeholder="Category"
                  allowCustomValue={false}
                />
              </div>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={5}
                placeholder={"Office Supplies\nSoftware Subscriptions\nTravel"}
              />
              <div>
                <Button type="submit" disabled={bulkImporting || bulkText.trim() === ""}>
                  {bulkImporting ? "Importing…" : "Import accounts"}
                </Button>
              </div>
            </form>
          ) : null}
        </Card>
      ) : null}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-64">
            <InputField placeholder="Filter by name or number" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="w-44">
            <Select value={typeFilter} onChange={setTypeFilter} options={TYPE_FILTER_OPTIONS} placeholder="All" allowCustomValue={false} optionSize="sm" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          {batchEditOpen ? null : (
            <button type="button" onClick={startBatchEdit} className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Batch edit
            </button>
          )}
          <IconButton icon={Printer} label="Print" size="sm" />
          <IconButton icon={Settings} label="Settings" size="sm" />
        </div>
      </div>

      {/* Table -- same header-table/content-table styling as /register and
          the rest of the Accounting screens, so the app's tables stay
          visually consistent. */}
      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="w-10 px-2 pb-[5px] pt-2 text-left align-middle">
                <input type="checkbox" disabled />
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Name</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle" title="Grouped by account type">
                Account type
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">QuickBooks balance</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Bank balance</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-[var(--color-negative)]">
                  {loadError}
                </td>
              </tr>
            ) : (
              sections.map((section) =>
                section.rows.length === 0 ? null : (
                  <SectionRows
                    key={section.key}
                    label={section.label}
                    rows={filterCollapsed(section.rows, collapsedNames)}
                    accountByName={section.accountByName}
                    collapsedNames={collapsedNames}
                    onToggleCollapse={toggleCollapse}
                    onViewRegister={setRegisterAccountId}
                    onEdit={startEdit}
                    onCreateSubaccount={startSubaccount}
                    onMakeInactive={handleArchive}
                    busyAccountId={busyAccountId}
                    batchEditOpen={batchEditOpen}
                    batchDrafts={batchDrafts}
                    onBatchDraftChange={(id, value) => setBatchDrafts((current) => ({ ...current, [id]: value }))}
                  />
                )
              )
            )}
          </tbody>
        </table>
      </div>

      {batchEditOpen ? (
        <div className="sticky bottom-0 mt-3 flex justify-end gap-2 border-t border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-3">
          <Button variant="secondary" onClick={cancelBatchEdit} disabled={batchSaving}>
            Cancel
          </Button>
          <Button onClick={saveBatchEdit} disabled={batchSaving}>
            {batchSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
    </>
  );
}

function SectionRows({
  label,
  rows,
  accountByName,
  collapsedNames,
  onToggleCollapse,
  onViewRegister,
  onEdit,
  onCreateSubaccount,
  onMakeInactive,
  busyAccountId,
  batchEditOpen,
  batchDrafts,
  onBatchDraftChange
}: {
  label: string;
  rows: HierarchyRow[];
  accountByName: Map<string, Account>;
  collapsedNames: Set<string>;
  onToggleCollapse: (fullName: string) => void;
  onViewRegister: (accountId: string) => void;
  onEdit: (account: Account) => void;
  onCreateSubaccount: (account: Account) => void;
  onMakeInactive: (account: Account) => void;
  busyAccountId: string | null;
  batchEditOpen: boolean;
  batchDrafts: Record<string, string>;
  onBatchDraftChange: (accountId: string, value: string) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={6} className="bg-[var(--color-container-background-accent)] p-2 text-[13px] font-semibold text-[var(--color-text-primary)]">
          {label}
        </td>
      </tr>
      {rows.map((row) => {
        const account = accountByName.get(row.fullName);
        const isCollapsed = row.hasChildren && collapsedNames.has(row.fullName);
        return (
          <tr key={row.fullName} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
            <td className="p-2 align-top">
              <input type="checkbox" disabled />
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]">
              <div className="flex items-center gap-1.5" style={{ paddingLeft: `${row.depth * 1.25}rem` }}>
                {row.hasChildren ? (
                  <button
                    type="button"
                    onClick={() => onToggleCollapse(row.fullName)}
                    className="text-[var(--color-icon-secondary)]"
                    aria-label={isCollapsed ? "Expand" : "Collapse"}
                  >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                ) : (
                  <span className="inline-block w-3.5" />
                )}
                {account && batchEditOpen ? (
                  <InputField size="sm" value={batchDrafts[account.id] ?? row.label} onChange={(e) => onBatchDraftChange(account.id, e.target.value)} />
                ) : (
                  <div>
                    <p className="text-[var(--color-text-global)]">{row.label}</p>
                    {account ? <p className="text-xs text-[var(--color-icon-secondary)]">{ACCOUNT_CATEGORY_LABELS[account.category]}</p> : null}
                  </div>
                )}
              </div>
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">
              {account ? ACCOUNT_CATEGORY_LABELS[account.category] : ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">{formatMoney(row.amount)}</td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-disabled)]">
              {/* No live bank feed yet (Phase 1.5) -- honestly blank rather than a fabricated number. */}
              {account ? "--" : ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
              {account ? (
                <AccountRowActions
                  account={account}
                  onViewRegister={() => onViewRegister(account.id)}
                  onEdit={() => onEdit(account)}
                  onCreateSubaccount={() => onCreateSubaccount(account)}
                  onMakeInactive={() => onMakeInactive(account)}
                  busy={busyAccountId === account.id}
                />
              ) : null}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// "View register" as a text link plus a chevron opening the rest of QBO's
// per-account menu. Link account/Run report are honestly disabled (no bank
// feed, no report engine wired to a single account yet); Edit, Create
// subaccount, and Make inactive are real.
function AccountRowActions({
  account,
  onViewRegister,
  onEdit,
  onCreateSubaccount,
  onMakeInactive,
  busy
}: {
  account: Account;
  onViewRegister: () => void;
  onEdit: () => void;
  onCreateSubaccount: () => void;
  onMakeInactive: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-flex items-center justify-end gap-1 text-[13px]" ref={ref}>
      <button type="button" onClick={onViewRegister} disabled={busy} className="font-medium text-[var(--color-link-action)] hover:underline disabled:cursor-not-allowed disabled:opacity-60">
        View register
      </button>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="More actions" disabled={busy} className="text-[var(--color-icon-secondary)]">
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 text-left shadow-lg">
          <button type="button" disabled title="No bank feed integration yet" className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-[13px] text-[var(--color-text-disabled)]">
            Link account
          </button>
          <button
            type="button"
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
            className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              onCreateSubaccount();
              setOpen(false);
            }}
            className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            Create subaccount
          </button>
          <button
            type="button"
            onClick={() => {
              onMakeInactive();
              setOpen(false);
            }}
            className="block w-full px-3 py-1.5 text-left text-[13px] text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            Make inactive (won't reduce usage)
          </button>
          <button type="button" disabled title="Not available yet" className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-[13px] text-[var(--color-text-disabled)]">
            Run report
          </button>
        </div>
      ) : null}
    </div>
  );
}
