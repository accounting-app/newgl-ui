"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowUp, ChevronDown, ChevronLeft, ChevronRight, Maximize, MessageSquarePlus, Pencil, Printer, Search, Settings, Share, SquareArrowOutUpRight } from "lucide-react";
import { ReconciliationDashboardPanel } from "@/components/accounting/reconciliation-dashboard-panel";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Card } from "@/components/ui/card";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast/toast-context";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { ACCOUNT_ROOT_GROUPS } from "@/modules/accounting/domain/accounting-reports";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { buildRollupHierarchyRows, filterCollapsed } from "@/lib/accounting/account-hierarchy";
import type { HierarchyRow } from "@/lib/accounting/account-hierarchy";
import { nextAccountCode } from "@/lib/accounting/next-account-code";
import type { Account } from "@/modules/accounting/domain/models";
import { accountHasRegister } from "@/modules/accounting/presentation/transaction-type-policy";

const CATEGORY_OPTIONS = ACCOUNT_ROOT_GROUPS.flatMap((group) =>
  [...group.categories].map((category) => ({ value: category, label: ACCOUNT_CATEGORY_LABELS[category] }))
);
const TYPE_FILTER_OPTIONS = [{ value: "", label: "All" }, ...CATEGORY_OPTIONS];

// QBO lists the chart as one flat table sorted by account type, in this order.
const ACCOUNT_TYPE_ORDER: Account["category"][] = [
  "BANK",
  "ACCOUNTS_RECEIVABLE",
  "OTHER_CURRENT_ASSET",
  "FIXED_ASSET",
  "ACCOUNTS_PAYABLE",
  "CREDIT_CARD",
  "OTHER_CURRENT_LIABILITY",
  "LONG_TERM_LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
  "OTHER_INCOME",
  "OTHER_EXPENSE"
];

const LAST_ACCOUNT_KEY = "newgl:chart-last-account";
const DEFAULT_FILTER_KEY = "newgl:chart-default-filter";

type CategoryName = Account["category"];
type FilterRule = { label: string; matches: (account: Account) => boolean };
const inCategories = (...categories: CategoryName[]) => (account: Account) => categories.includes(account.category);
const subtypeLike = (pattern: RegExp) => (account: Account) => pattern.test(account.subtype ?? "");
const ALL_ACCOUNTS = () => true;
const NO_ACCOUNTS = () => false;

// RightTool's "Default Account Filter" presets, in QBO's order. Ones QBO splits
// by detail type (Revenue, COGS, Payroll...) match on the account's detail
// type; ones our chart has no account type for (Other Assets) match nothing.
const DEFAULT_FILTERS: Record<string, FilterRule> = {
  default: { label: "-- Default Account Filter --", matches: ALL_ACCOUNTS },
  all: { label: "All Accounts", matches: ALL_ACCOUNTS },
  bank: { label: "Bank", matches: inCategories("BANK") },
  ar: { label: "Accounts Receivable (A/R)", matches: inCategories("ACCOUNTS_RECEIVABLE") },
  currentAssets: { label: "Current Assets", matches: inCategories("BANK", "ACCOUNTS_RECEIVABLE", "OTHER_CURRENT_ASSET") },
  otherCurrentAssets: { label: "Other Current Assets", matches: inCategories("OTHER_CURRENT_ASSET") },
  fixedAssets: { label: "Fixed Assets", matches: inCategories("FIXED_ASSET") },
  ppe: { label: "Property, Plant and Equipment", matches: inCategories("FIXED_ASSET") },
  otherAssets: { label: "Other Assets", matches: NO_ACCOUNTS },
  ap: { label: "Accounts Payable (A/P)", matches: inCategories("ACCOUNTS_PAYABLE") },
  creditCard: { label: "Credit Card", matches: inCategories("CREDIT_CARD") },
  otherCurrentLiabilities: { label: "Other Current Liabilities", matches: inCategories("OTHER_CURRENT_LIABILITY") },
  longTermLiabilities: { label: "Long Term Liabilities", matches: inCategories("LONG_TERM_LIABILITY") },
  equity: { label: "Equity", matches: inCategories("EQUITY") },
  income: { label: "Income", matches: inCategories("INCOME") },
  revenue: { label: "Revenue", matches: inCategories("INCOME") },
  otherIncome: { label: "Other Income", matches: inCategories("OTHER_INCOME") },
  otherRevenue: { label: "Other Revenue", matches: inCategories("OTHER_INCOME") },
  cogs: { label: "Cost Of Goods Sold", matches: subtypeLike(/cost of goods|cogs/i) },
  expenses: { label: "Expenses", matches: inCategories("EXPENSE") },
  otherExpense: { label: "Other Expense", matches: inCategories("OTHER_EXPENSE") },
  expenditures: { label: "Expenditures", matches: inCategories("EXPENSE") },
  otherExpenditures: { label: "Other Expenditures", matches: inCategories("OTHER_EXPENSE") },
  payrollExpenses: { label: "Payroll Expenses", matches: (account) => account.category === "EXPENSE" && /payroll/i.test(account.subtype ?? "") }
};

const OUTLINE_BUTTON =
  "inline-flex h-[37px] items-center gap-2 rounded-md border border-[var(--color-qbo-green-border)] bg-[var(--color-container-background-primary)] px-4 text-base font-medium text-[var(--color-qbo-green-text)] hover:bg-[var(--color-action-passive-subtle-hover)]";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function ChartOfAccountsPage() {
  const services = useMemo(() => getServiceContainer(), []);
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // "New account" / "Edit account" -- the same QBO-style side panel the
  // Register's own "+ Add new" account picker uses (add-account-modal.tsx),
  // so there's one add/edit account UI in the app rather than two
  // different-looking ones depending on which screen you started from.
  // `editingAccount` set -> editing; `initialParentAccount` set (and
  // editingAccount not) -> a brand-new subaccount pre-nested under it (the
  // "Create subaccount" row action); neither -> a plain blank "New account".
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [initialParentAccount, setInitialParentAccount] = useState<Account | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [defaultFilter, setDefaultFilterState] = useState("default");
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DEFAULT_FILTER_KEY);
      if (stored && stored in DEFAULT_FILTERS) setDefaultFilterState(stored);
    } catch {
      // storage unavailable: start unfiltered
    }
  }, []);
  function setDefaultFilter(value: string) {
    setDefaultFilterState(value);
    try {
      window.localStorage.setItem(DEFAULT_FILTER_KEY, value);
    } catch {
      // not persisted
    }
  }
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
          (typeFilter === "" || a.category === typeFilter) &&
          (DEFAULT_FILTERS[defaultFilter] ?? DEFAULT_FILTERS.default).matches(a)
      ),
    [accounts, search, typeFilter, defaultFilter]
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
      ACCOUNT_TYPE_ORDER.map((category) => {
        const typeAccounts = activeAccounts.filter((a) => a.category === category);
        const rows = buildRollupHierarchyRows(typeAccounts.map((a) => ({ name: a.name, amount: a.currentBalance })));
        const accountByName = new Map(typeAccounts.map((a) => [a.name, a]));
        return { key: category, rows, accountByName };
      }),
    [activeAccounts]
  );

  // Rows actually shown (real accounts only, not synthetic rollup headers) -- drives the "1 - N" pager.
  const totalShown = useMemo(() => sections.reduce((sum, section) => sum + section.rows.filter((row) => section.accountByName.has(row.fullName)).length, 0), [sections]);

  // Row selection (the checkboxes), real accounts only.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const shownAccountIds = useMemo(
    () => sections.flatMap((section) => section.rows.map((row) => section.accountByName.get(row.fullName)?.id).filter((id): id is string => Boolean(id))),
    [sections]
  );
  const allSelected = shownAccountIds.length > 0 && shownAccountIds.every((id) => selectedIds.has(id));
  const someSelected = shownAccountIds.some((id) => selectedIds.has(id));
  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // "Jump to Last" (RightTool): back to the account row you last opened or edited.
  function rememberLast(accountId: string) {
    try {
      window.sessionStorage.setItem(LAST_ACCOUNT_KEY, accountId);
    } catch {
      // storage unavailable: nothing to jump back to
    }
  }
  function jumpToLast() {
    let id: string | null = null;
    try {
      id = window.sessionStorage.getItem(LAST_ACCOUNT_KEY);
    } catch {
      // ignore
    }
    const row = id ? document.querySelector<HTMLElement>(`[data-account-id="${id}"]`) : null;
    if (!row) return toast({ variant: "info", title: "No account to jump back to yet", description: "Open or edit an account first." });
    row.scrollIntoView({ block: "center" });
    row.classList.add("bg-[var(--color-action-passive-subtle-hover)]");
    window.setTimeout(() => row.classList.remove("bg-[var(--color-action-passive-subtle-hover)]"), 1800);
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => toast({ variant: "info", title: "Full screen isn't available in this browser" }));
  }

  const defaultFilterOptions = useMemo(
    () => Object.entries(DEFAULT_FILTERS).map(([value, rule]) => ({ value, label: value === "all" ? `${rule.label} (${accounts.filter((a) => a.status !== "ARCHIVED").length})` : rule.label })),
    [accounts]
  );

  function startAdd() {
    setEditingAccount(null);
    setInitialParentAccount(null);
    setIsAccountModalOpen(true);
    setNewAccountMenuOpen(false);
  }

  function startEdit(account: Account) {
    setEditingAccount(account);
    setInitialParentAccount(null);
    setIsAccountModalOpen(true);
  }

  function startSubaccount(parent: Account) {
    setEditingAccount(null);
    setInitialParentAccount(parent);
    setIsAccountModalOpen(true);
  }

  function closeAccountModal() {
    setIsAccountModalOpen(false);
    setEditingAccount(null);
    setInitialParentAccount(null);
  }

  async function handleCreateAccount(input: {
    name: string;
    category: Account["category"];
    subtype?: string;
    openingBalance?: number;
  }): Promise<Account> {
    const created = await services.accountService.createAccount({
      code: nextAccountCode(accounts),
      name: input.name,
      category: input.category,
      subtype: input.subtype,
      currency: "USD",
      openingBalance: input.openingBalance
    });
    toast({ variant: "success", title: "Account created", description: `"${input.name}" was added to the chart of accounts.` });
    await loadAccounts();
    return created;
  }

  async function handleUpdateAccount(accountId: string, input: { name: string; subtype?: string }): Promise<void> {
    await services.accountService.updateAccount(accountId, { name: input.name, subtype: input.subtype });
    toast({ variant: "success", title: "Account updated" });
    await loadAccounts();
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

  return (
    <>
      <PageHeader
        section="Accounting"
        title="Chart of accounts"
        className="min-h-[35px] [&>nav]:pl-[21px] [&>nav>span:first-child]:text-[#252728] [&>nav>span:last-child]:text-[#555756]"
        topRight={
          <div className="flex items-center text-sm text-[#585a5c]">
            <button type="button" onClick={jumpToLast} className="mr-3 inline-flex h-[35px] items-center rounded-full bg-[var(--color-action-standard)] px-[21px] text-[15px] font-bold text-white hover:opacity-90">
              Jump to Last
            </button>
            <button type="button" onClick={() => toast({ variant: "info", title: "Feedback isn't available yet" })} className="mr-[17px] flex items-center gap-1.5 hover:text-[var(--color-text-global)]">
              <MessageSquarePlus className="h-4 w-4 text-[#4d5252]" aria-hidden="true" />
              Feedback
            </button>
            <button type="button" aria-label="Open in a new window" title="Open in a new window" onClick={() => window.open(window.location.href, "_blank")} className="mr-[15px] text-[#505252] hover:text-[var(--color-text-global)]">
              <SquareArrowOutUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Toggle full screen" title="Full screen" onClick={toggleFullscreen} className="text-[#515353] hover:text-[var(--color-text-global)]">
              <Maximize className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        }
        actions={
          <div className="flex items-center gap-[9px]">
            <button type="button" onClick={() => setDashboardOpen(true)} className="mr-[10px] inline-flex h-[37px] items-center rounded-md bg-[var(--color-action-standard)] px-4 text-[15px] font-semibold text-white hover:brightness-90">
              Reconcile Dashboard
            </button>
            <button type="button" onClick={() => toast({ variant: "info", title: "Clean up isn't available yet" })} className={`${OUTLINE_BUTTON} !px-3`}>
              Clean up
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => toast({ variant: "info", title: "Reports for the chart of accounts aren't available yet" })} className={OUTLINE_BUTTON}>
              Run report
            </button>
            <div className="relative inline-flex" ref={newAccountMenuRef}>
              <button type="button" onClick={startAdd} className="h-[37px] rounded-l-md bg-[var(--color-qbo-green)] px-4 text-base font-medium text-white hover:bg-[var(--color-qbo-green-hover)]">
                New account
              </button>
              <button
                type="button"
                aria-label="More new-account options"
                aria-expanded={newAccountMenuOpen}
                onClick={() => setNewAccountMenuOpen((v) => !v)}
                className="flex h-[37px] w-[38px] items-center justify-center rounded-r-md border-l border-white/40 bg-[var(--color-qbo-green)] text-white hover:bg-[var(--color-qbo-green-hover)]"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
              {newAccountMenuOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setNewAccountMenuOpen(false);
                      setBulkOpen(true);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                  >
                    Import accounts
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        }
      />

      <ReconciliationDashboardPanel open={dashboardOpen} onClose={() => setDashboardOpen(false)} />

      <AddAccountModal
        open={isAccountModalOpen}
        accounts={accounts}
        editingAccount={editingAccount}
        initialParentAccount={initialParentAccount}
        onClose={closeAccountModal}
        onSave={handleCreateAccount}
        onUpdate={handleUpdateAccount}
      />

      {bulkOpen ? (
        <Card title="Import accounts" description="One account name per line. All imported accounts use the category below." className="mb-6">
          <form onSubmit={handleBulkImport} className="flex flex-col gap-3">
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
            <div className="flex gap-2">
              <Button type="submit" disabled={bulkImporting || bulkText.trim() === ""}>
                {bulkImporting ? "Importing…" : "Import accounts"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setBulkOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {/* Toolbar + table sit straight on the page, as in QBO (no bordered panel). */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-[246px] max-w-full">
            <InputField placeholder="Filter by name or number" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 border-[var(--color-field-border)] pl-10" />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
          </div>
          <FilterSelect value={typeFilter} onChange={setTypeFilter} label="Filter by account type" className="w-[255px] [&>select]:h-9 [&>select]:border-[#d9ddde]">
            {TYPE_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </FilterSelect>
          <div className="w-[230px] [&_input]:h-8 [&_input]:border-[var(--color-action-standard)] [&_input]:py-0 [&_input]:text-sm">
            <Select value={defaultFilter} onChange={setDefaultFilter} options={defaultFilterOptions} placeholder="-- Default Account Filter --" allowCustomValue={false} optionSize="sm" showCheckmark />
          </div>
        </div>
        <div className="flex items-center gap-4 text-[var(--color-icon-secondary)]">
          {batchEditOpen ? null : (
            <button type="button" onClick={startBatchEdit} className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]">
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Batch edit
            </button>
          )}
          <IconButton icon={Share} label="Export" size="sm" />
          <IconButton icon={Printer} label="Print" size="sm" />
          <IconButton icon={Settings} label="Settings" size="sm" />
        </div>
      </div>
      <div className="mb-3 flex items-center justify-end gap-5 text-[15px] text-[#535557]">
        <span className="flex items-center gap-1 text-[#bbbbbb]">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </span>
        <span className="text-[var(--color-text-global)]">{totalShown === 0 ? "0" : `1 - ${totalShown}`}</span>
        <span className="flex items-center gap-1 text-[#bbbbbb]">
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: "2.8%" }} />
            <col style={{ width: "26.2%" }} />
            <col style={{ width: "24.2%" }} />
            <col style={{ width: "18.2%" }} />
            <col style={{ width: "9.9%" }} />
            <col style={{ width: "8.7%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead className="text-left text-[#373737]">
            <tr className="border-b border-[var(--color-table-divider-strong)] [&>th]:h-12 [&>th]:px-[10px] [&>th]:py-0 [&>th]:text-[15px] [&>th]:font-semibold">
              <th className="pl-0">
                <input
                  type="checkbox"
                  className="qbo-checkbox ml-[7px]"
                  aria-label="Select all accounts"
                  checked={allSelected}
                  ref={(node) => {
                    if (node) node.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={(event) => setSelectedIds(event.target.checked ? new Set(shownAccountIds) : new Set())}
                />
              </th>
              <th className="border-l border-[var(--color-table-divider)]">Name</th>
              <th className="border-l border-[var(--color-table-divider)]" title="Grouped by account type">
                Account type
                <ArrowUp className="ml-3 inline h-3.5 w-3.5" aria-hidden="true" />
              </th>
              <th className="border-l border-[var(--color-table-divider)]">Detail type</th>
              <th className="truncate border-l border-[var(--color-table-divider)] text-right">QuickBooks balance</th>
              <th className="truncate border-l border-[var(--color-table-divider)] text-right">Bank balance</th>
              <th className="border-l border-[var(--color-table-divider)] text-right">
                <span className="mr-2 inline-flex h-6 items-center rounded-[3px] bg-[var(--color-action-standard)] px-2 align-middle text-[13px] font-bold text-white">New</span>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-[var(--color-negative)]">
                  {loadError}
                </td>
              </tr>
            ) : (
              sections.map((section) =>
                section.rows.length === 0 ? null : (
                  <SectionRows
                    key={section.key}
                    rows={filterCollapsed(section.rows, collapsedNames)}
                    accountByName={section.accountByName}
                    collapsedNames={collapsedNames}
                    onToggleCollapse={toggleCollapse}
                    onEdit={startEdit}
                    onCreateSubaccount={startSubaccount}
                    onMakeInactive={handleArchive}
                    busyAccountId={busyAccountId}
                    batchEditOpen={batchEditOpen}
                    batchDrafts={batchDrafts}
                    onBatchDraftChange={(id, value) => setBatchDrafts((current) => ({ ...current, [id]: value }))}
                    selectedIds={selectedIds}
                    onToggleSelected={toggleSelected}
                    onRemember={rememberLast}
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
  rows,
  accountByName,
  collapsedNames,
  onToggleCollapse,
  onEdit,
  onCreateSubaccount,
  onMakeInactive,
  busyAccountId,
  batchEditOpen,
  batchDrafts,
  onBatchDraftChange,
  selectedIds,
  onToggleSelected,
  onRemember
}: {
  rows: HierarchyRow[];
  accountByName: Map<string, Account>;
  collapsedNames: Set<string>;
  onToggleCollapse: (fullName: string) => void;
  onEdit: (account: Account) => void;
  onCreateSubaccount: (account: Account) => void;
  onMakeInactive: (account: Account) => void;
  busyAccountId: string | null;
  batchEditOpen: boolean;
  batchDrafts: Record<string, string>;
  onBatchDraftChange: (accountId: string, value: string) => void;
  selectedIds: Set<string>;
  onToggleSelected: (accountId: string) => void;
  onRemember: (accountId: string) => void;
}) {
  return (
    <>
      {rows.map((row) => {
        const account = accountByName.get(row.fullName);
        const isCollapsed = row.hasChildren && collapsedNames.has(row.fullName);
        return (
          <tr key={row.fullName} data-account-id={account?.id} onClick={() => account && onRemember(account.id)} className="h-12 border-t border-[var(--color-table-divider)] hover:bg-[var(--color-table-row-hover)]">
            <td className="pl-[17px] py-0 align-middle">
              <input
                type="checkbox"
                className="qbo-checkbox"
                aria-label={`Select ${row.label}`}
                disabled={!account}
                checked={account ? selectedIds.has(account.id) : false}
                onChange={() => account && onToggleSelected(account.id)}
              />
            </td>
            <td className="border-l border-[var(--color-table-divider)] px-[10px] py-0 align-middle text-sm leading-[21px]">
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
                ) : null}
                {account && batchEditOpen ? (
                  <InputField size="sm" value={batchDrafts[account.id] ?? row.label} onChange={(e) => onBatchDraftChange(account.id, e.target.value)} />
                ) : (
                  <span className="text-[var(--color-text-global)]">{row.label}</span>
                )}
              </div>
            </td>
            <td className="border-l border-[var(--color-table-divider)] px-[10px] py-0 align-middle text-sm leading-[21px] text-[var(--color-text-primary)]">
              {account ? ACCOUNT_CATEGORY_LABELS[account.category] : ""}
            </td>
            <td className="border-l border-[var(--color-table-divider)] px-[10px] py-0 align-middle text-sm leading-[21px] text-[var(--color-text-primary)]">
              {account?.subtype ?? ""}
            </td>
            <td className="border-l border-[var(--color-table-divider)] px-[10px] py-0 align-middle text-right text-sm leading-[21px] text-[var(--color-text-global)]">{formatMoney(row.amount)}</td>
            <td className="border-l border-[var(--color-table-divider)] px-[10px] py-0 align-middle text-right text-sm leading-[21px] text-[var(--color-text-disabled)]">
              {/* No live bank feed yet (Phase 1.5) -- honestly blank rather than a fabricated number. */}
              {account ? "--" : ""}
            </td>
            <td className="border-l border-[var(--color-table-divider)] px-[10px] py-0 align-middle text-right">
              {account ? (
                <AccountRowActions
                  account={account}
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

// Per-account actions, mirroring QBO's Chart of accounts. The primary link
// depends on the account: accounts with a register (balance-sheet accounts
// except Retained Earnings) get "View register" -- which opens the real
// interactive register at /register?accountId=... -- and everything else
// gets "Run report", exactly as QBO does. "Link account" and the
// register-side "Run report" are honestly disabled (no bank feed, no
// single-account report for balance-sheet accounts yet); Edit, Reconcile,
// Create subaccount, and Make inactive are real.
const PROFIT_AND_LOSS_CATEGORIES = new Set<Account["category"]>(["INCOME", "EXPENSE", "OTHER_INCOME", "OTHER_EXPENSE"]);
const BANK_FEED_CATEGORIES = new Set<Account["category"]>(["BANK", "CREDIT_CARD"]);

const MENU_ITEM_CLASS =
  "block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const DISABLED_MENU_ITEM_CLASS = "block w-full cursor-not-allowed px-3 py-1.5 text-left text-sm text-[var(--color-text-disabled)]";

function AccountRowActions({
  account,
  onEdit,
  onCreateSubaccount,
  onMakeInactive,
  busy
}: {
  account: Account;
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

  const hasRegister = accountHasRegister(account);
  // P&L Detail already filters by account name, which is the closest thing to
  // QBO's single-account "Run report" we have for income/expense accounts.
  const reportHref = PROFIT_AND_LOSS_CATEGORIES.has(account.category) ? `/reports/pl-detail?account=${encodeURIComponent(account.name)}` : null;
  const primaryLinkClass = `font-medium text-[var(--color-qbo-link)] hover:underline ${busy ? "pointer-events-none opacity-60" : ""}`;

  return (
    <div className="relative inline-flex items-center justify-end gap-1 text-sm" ref={ref}>
      {hasRegister ? (
        <Link href={`/register?accountId=${account.id}`} aria-disabled={busy} className={primaryLinkClass}>
          View register
        </Link>
      ) : reportHref ? (
        <Link href={reportHref} aria-disabled={busy} className={primaryLinkClass}>
          Run report
        </Link>
      ) : (
        <span title="Not available yet" className="cursor-not-allowed font-medium text-[var(--color-text-disabled)]">
          Run report
        </span>
      )}
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="More actions" disabled={busy} className="text-[var(--color-icon-secondary)]">
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 text-left shadow-lg">
          {BANK_FEED_CATEGORIES.has(account.category) ? (
            <button type="button" disabled title="No bank feed integration yet" className={DISABLED_MENU_ITEM_CLASS}>
              Link account
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onEdit();
              setOpen(false);
            }}
            className={MENU_ITEM_CLASS}
          >
            Edit
          </button>
          {hasRegister ? (
            <>
              <button type="button" disabled title="Not available yet" className={DISABLED_MENU_ITEM_CLASS}>
                Run report
              </button>
              <Link href={`/all-apps/reconcile?accountId=${account.id}`} onClick={() => setOpen(false)} className={MENU_ITEM_CLASS}>
                Reconcile
              </Link>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onCreateSubaccount();
              setOpen(false);
            }}
            className={MENU_ITEM_CLASS}
          >
            Create subaccount
          </button>
          <button
            type="button"
            onClick={() => {
              onMakeInactive();
              setOpen(false);
            }}
            className={MENU_ITEM_CLASS}
          >
            Make inactive (won't reduce usage)
          </button>
        </div>
      ) : null}
    </div>
  );
}
