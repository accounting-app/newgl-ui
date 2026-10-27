"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CreditCard, Landmark, MessageSquarePlus, Paperclip, MessageSquare, Pencil, Plus, Printer, RefreshCw, Search, Settings, Share, X } from "lucide-react";
import { BankTxnDetailForm, PURPOSE_OPTIONS } from "@/components/accounting/bank-txn-detail-form";
import { CategorySuggestionMarker, PayeeSuggestionMarker } from "@/components/accounting/bank-txn-row-suggestion";
import { suggestionKey, useStoredSuggestions } from "@/lib/bank-txn-suggestions-store";
import { useLinkedFiles } from "@/lib/hooks/use-linked-files";
import { SplitTransactionModal } from "@/components/accounting/split-transaction-modal";
import type { SplitLine } from "@/components/accounting/split-transaction-modal";
import { ProductServicePanel } from "@/components/accounting/product-service-panel";
import { useProductsServices } from "@/lib/hooks/use-products-services";
import { PayeeSideModal } from "@/components/bank-register/payee-side-modal";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { QuickAddMenu, SplitButton } from "@/components/bank-register/register-header-actions";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { PendingBankTxn, PendingTxnStatus } from "@/lib/local-store/accounting-types";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useVendors } from "@/lib/hooks/use-vendors";
import { listReconciliationsForAccount } from "@/lib/services/reconciliation-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

// YYYY-MM-DD -> MM/DD/YYYY (the date format QBO shows), without a timezone round trip.
function formatDisplayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${month}/${day}/${year}`;
}

const CARDS_COLLAPSED_COUNT = 3;
const CELL = "border-l border-[var(--color-divider-tertiary)] px-[10px] py-0 align-middle text-sm leading-[21px]";
const PAGE_SIZE = 50;

type DatePreset = "all" | "30d" | "month" | "year";
type StatusFilter = "all" | "categorized" | "uncategorized";
const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All dates",
  "30d": "Last 30 days",
  month: "This month",
  year: "This year"
};

// Earliest date (YYYY-MM-DD) a preset includes, or null for "all dates".
function presetStartDate(preset: DatePreset): string | null {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (preset === "30d") return iso(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
  if (preset === "month") return iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)));
  if (preset === "year") return iso(new Date(Date.UTC(now.getFullYear(), 0, 1)));
  return null;
}

// A bordered native <select> with QBO's chevron (and an optional leading icon).
function FilterSelect({ value, onChange, children, icon: Icon, label, className = "" }: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  icon?: typeof CalendarDays;
  label: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[38px] w-full appearance-none rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] pl-3 pr-14 text-sm text-[var(--color-input-text)] focus:outline-none focus-visible:border-[var(--override-focus)]"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-[var(--color-icon-secondary)]">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </span>
    </div>
  );
}

// QBO's transaction counts cap at "99+".
function formatTxnCount(count: number): string {
  return count > 99 ? "99+" : count.toLocaleString("en-US");
}

function AccountKindIcon({ account, className }: { account: Account; className?: string }) {
  const Icon = account.category === "CREDIT_CARD" ? CreditCard : Landmark;
  return <Icon className={className} aria-hidden="true" />;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// A row shape both the real Posted transactions and the local-only
// Pending/Excluded staging rows can render through the same <table>.
type DisplayRow = {
  id: string;
  date: string;
  description: string;
  spent?: number;
  received?: number;
  payee?: string;
  categoryLabel?: string;
  /** Only set (and only editable) for local-only Pending/Excluded rows -- real Posted rows derive categoryLabel straight from the transaction's own postings instead. */
  categoryAccountId?: string;
  purpose?: PendingBankTxn["purpose"];
  memo?: string;
  payeeKind?: PendingBankTxn["payeeKind"];
  txnType?: PendingBankTxn["txnType"];
  postedTransactionId?: string;
  postedType?: string;
  splitLineCount?: number;
  /** True for local-only staging rows (deletable); false/undefined for real transactions (not something this Phase-1 screen can delete). */
  isLocal?: boolean;
};

const TABS: { value: PendingTxnStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "POSTED", label: "Posted" },
  { value: "EXCLUDED", label: "Excluded" }
];

// Phase 1: a staging area for reviewing/categorizing transactions before
// they post -- local-only data, entirely separate from the real Register.
// Manual entry only (no real bank feed yet -- Phase 1.5), so there's no
// "Switch to previous version" link the way QBO's real feed migration
// does; everything else follows the reference layout closely. See
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function BankTransactionsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filesTxnId, setFilesTxnId] = useState<string | null>(null);
  const bankFiles = useLinkedFiles("bank");
  const rowFileInput = useRef<HTMLInputElement>(null);
  const fileCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of bankFiles.all) if (f.linkedTransactionId) counts.set(f.linkedTransactionId, (counts.get(f.linkedTransactionId) ?? 0) + 1);
    return counts;
  }, [bankFiles.all]);
  const [postedTransactions, setPostedTransactions] = useState<Transaction[]>([]);
  const reloadAccounts = () => services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  useEffect(() => {
    void reloadAccounts();
    services.transactionService.listTransactions({ status: "POSTED" }).then(setPostedTransactions).catch(() => setPostedTransactions([]));
  }, [services]);

  const bankAccounts = useMemo(() => accounts.filter((a) => isRegisterAccountCategory(a.category)), [accounts]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  // "Hide account cards" (in the selector) hides the balance card under the header, not the selector's own list.
  const [showAccountCards, setShowAccountCards] = useState(true);
  // Cards under the header: one row of three, "Show all" expands to the rest.
  const [cardsExpanded, setCardsExpanded] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  // Newest completed reconciliation's statement ending date for the selected
  // account (RightTool's red "Last Reconciled" note); null = never reconciled.
  const [lastReconciledDate, setLastReconciledDate] = useState<string | null>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!accountMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAccountMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);
  useEffect(() => {
    if (!selectedAccountId && bankAccounts.length > 0) setSelectedAccountId(bankAccounts[0].id);
  }, [bankAccounts, selectedAccountId]);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  useEffect(() => {
    if (!selectedAccountId) return;
    let cancelled = false;
    listReconciliationsForAccount(selectedAccountId)
      .then((list) => {
        if (cancelled) return;
        const newest = list.map((r) => r.statementEndingDate).sort().at(-1);
        setLastReconciledDate(newest ?? null);
      })
      .catch(() => {
        if (!cancelled) setLastReconciledDate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  const txnsKey = activeCompany ? companyScopedKey(activeCompany.name, "pending-bank-txns") : null;
  const { items: allTxns, hydrated, add, update, remove } = useLocalCollection<PendingBankTxn>(
    txnsKey ?? "newgl:phase1:pending:pending-bank-txns"
  );
  const accountTxns = useMemo(() => allTxns.filter((t) => t.accountId === selectedAccountId), [allTxns, selectedAccountId]);
  const pendingCountByAccount = useMemo(() => {
    const counts = new Map<string, number>();
    allTxns.forEach((t) => {
      if (t.status !== "PENDING") return;
      counts.set(t.accountId, (counts.get(t.accountId) ?? 0) + 1);
    });
    return counts;
  }, [allTxns]);
  const filteredBankAccounts = useMemo(
    () => bankAccounts.filter((a) => accountSearch.trim() === "" || a.name.toLowerCase().includes(accountSearch.trim().toLowerCase())),
    [bankAccounts, accountSearch]
  );

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  // Real posted transactions for the selected account -- this is the fix
  // for "transactions aren't rendering": Posted was local-only staging
  // that starts empty, but this app already has real posted transactions
  // for these accounts (same data Register/Expense Transactions read), so
  // Posted now shows those instead of an always-empty local list.
  const realPostedRows = useMemo<DisplayRow[]>(() => {
    if (!selectedAccountId) return [];
    const account = accountById.get(selectedAccountId);
    if (!account) return [];
    const isDebitNormal = DEBIT_NORMAL_CATEGORIES.has(account.category);
    return postedTransactions
      .filter((txn) => txn.postings.some((p) => p.accountId === selectedAccountId))
      .map((txn) => {
        const ownPosting = txn.postings.find((p) => p.accountId === selectedAccountId)!;
        const increases = isDebitNormal ? ownPosting.type === "DEBIT" : ownPosting.type === "CREDIT";
        const otherPostings = txn.postings.filter((p) => p.accountId !== selectedAccountId);
        const otherAccount = otherPostings.length === 1 ? accountById.get(otherPostings[0].accountId) : undefined;
        return {
          id: txn.id,
          date: txn.transactionDate,
          description: txn.memo || txn.payee || "Transaction",
          received: increases ? ownPosting.amount : undefined,
          spent: !increases ? ownPosting.amount : undefined,
          payee: txn.payee,
          categoryLabel: otherPostings.length > 1 ? "Split" : otherAccount?.name,
          postedTransactionId: txn.id,
          postedType: txn.type.charAt(0) + txn.type.slice(1).toLowerCase().replaceAll("_", " ")
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [postedTransactions, selectedAccountId, accountById]);

  const [tab, setTab] = useState<PendingTxnStatus>("PENDING");
  const [search, setSearch] = useState("");
  const stagingRowsForTab = useMemo<DisplayRow[]>(
    () => accountTxns.filter((t) => t.status === tab).map((t) => ({ ...t, categoryLabel: t.splitLineCount ? "Split" : t.categoryAccountId ? accountById.get(t.categoryAccountId)?.name : undefined, isLocal: true })),
    [accountTxns, tab, accountById]
  );
  // Posted shows real transactions plus any locally-staged rows the user
  // has clicked "Post" on -- posting a staged row still needs somewhere
  // to land, not just vanish from Pending with nothing to show for it.
  const locallyPostedRows = useMemo<DisplayRow[]>(
    () =>
      accountTxns
        .filter((t) => t.status === "POSTED")
        .map((t) => ({ ...t, categoryLabel: t.splitLineCount ? "Split" : t.categoryAccountId ? accountById.get(t.categoryAccountId)?.name : undefined, isLocal: true })),
    [accountTxns, accountById]
  );
  // A staged row that Post turned into a real transaction would otherwise show
  // twice (as itself and as that transaction): keep the staged one, which has Undo.
  const postedRows = useMemo(() => {
    const stagedIds = new Set(locallyPostedRows.map((r) => r.postedTransactionId).filter(Boolean));
    return [...realPostedRows.filter((r) => !stagedIds.has(r.id)), ...locallyPostedRows].sort((a, b) => b.date.localeCompare(a.date));
  }, [realPostedRows, locallyPostedRows]);
  const filteredTxns = useMemo(
    () =>
      (tab === "POSTED" ? postedRows : stagingRowsForTab).filter(
        (t) => search.trim() === "" || t.description.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [tab, postedRows, stagingRowsForTab, search]
  );
  // QBO's two filter dropdowns and page size. Filters apply on top of the
  // tab + search above; the page resets whenever any of them change.
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const dateFilteredTxns = useMemo(() => {
    const from = presetStartDate(datePreset);
    return from ? filteredTxns.filter((t) => t.date >= from) : filteredTxns;
  }, [filteredTxns, datePreset]);
  const statusCounts = useMemo(
    () => ({
      all: dateFilteredTxns.length,
      categorized: dateFilteredTxns.filter((t) => Boolean(t.categoryAccountId || t.categoryLabel)).length,
      uncategorized: dateFilteredTxns.filter((t) => !t.categoryAccountId && !t.categoryLabel).length
    }),
    [dateFilteredTxns]
  );
  const visibleTxns = useMemo(
    () =>
      statusFilter === "all"
        ? dateFilteredTxns
        : dateFilteredTxns.filter((t) => Boolean(t.categoryAccountId || t.categoryLabel) === (statusFilter === "categorized")),
    [dateFilteredTxns, statusFilter]
  );
  const totalPages = Math.max(1, Math.ceil(visibleTxns.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = visibleTxns.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, visibleTxns.length);
  const pagedTxns = useMemo(() => visibleTxns.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [visibleTxns, currentPage]);
  useEffect(() => setPage(1), [tab, search, datePreset, statusFilter, selectedAccountId]);
  useEffect(() => {
    setSelectedIds(new Set());
    setExpandedId(null);
  }, [tab, selectedAccountId]);
  const tabCounts = useMemo(
    () => ({
      PENDING: accountTxns.filter((t) => t.status === "PENDING").length,
      POSTED: postedRows.length,
      EXCLUDED: accountTxns.filter((t) => t.status === "EXCLUDED").length
    }),
    [accountTxns, postedRows]
  );

  // Collapsed: the first three, but the selected account is always shown
  // (swapped into the last slot) so the highlighted card never hides.
  const visibleCardAccounts = useMemo(() => {
    if (cardsExpanded || bankAccounts.length <= CARDS_COLLAPSED_COUNT) return bankAccounts;
    const first = bankAccounts.slice(0, CARDS_COLLAPSED_COUNT);
    const selected = bankAccounts.find((a) => a.id === selectedAccountId);
    if (selected && !first.includes(selected)) first[CARDS_COLLAPSED_COUNT - 1] = selected;
    return first;
  }, [bankAccounts, cardsExpanded, selectedAccountId]);
  const latestDateByAccount = useMemo(() => {
    const dates = new Map<string, string>();
    const note = (accountId: string, date: string) => {
      if (date > (dates.get(accountId) ?? "")) dates.set(accountId, date);
    };
    postedTransactions.forEach((txn) => txn.postings.forEach((p) => note(p.accountId, txn.transactionDate)));
    allTxns.filter((t) => t.status === "POSTED").forEach((t) => note(t.accountId, t.date));
    return dates;
  }, [postedTransactions, allTxns]);

  const expenseAccountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE" || a.category === "INCOME" || a.category === "OTHER_INCOME")
        .map((a) => ({ value: a.id, label: a.name, rightLabel: ACCOUNT_CATEGORY_LABELS[a.category] })),
    [accounts]
  );
  const { items: vendors, add: addVendor } = useVendors();
  const { items: customers, add: addCustomer } = useCustomers();
  // From/To lists both directories, each tagged with what it is.
  const vendorOptions = useMemo(
    () => [
      ...customers.map((c) => ({ value: c.name, label: c.name, rightLabel: "Customer" })),
      ...vendors.map((v) => ({ value: v.name, label: v.name, rightLabel: "Vendor" }))
    ],
    [customers, vendors]
  );
  // The row whose From/To "+ Add new" opened the contact panel (and the row whose detail form is open).
  const [addPayeeForId, setAddPayeeForId] = useState<string | null>(null);
  // Set when the contact panel was opened from an AI "New vendor for you" card.
  const [addPayeePrefill, setAddPayeePrefill] = useState<{ name: string; website: string | null } | null>(null);
  const storedSuggestions = useStoredSuggestions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { items: productItems, add: addProductItem } = useProductsServices();
  const productOptions = useMemo(
    () => productItems.filter((p) => p.status === "ACTIVE").map((p) => ({ value: p.id, label: p.name, rightLabel: p.type === "SERVICE" ? "Service" : "Product" })),
    [productItems]
  );
  const incomeAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "INCOME" || a.category === "OTHER_INCOME").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  // The row whose Product/Service "+ Add new" opened the side panel.
  const [addProductForId, setAddProductForId] = useState<string | null>(null);
  const [splitTxnId, setSplitTxnId] = useState<string | null>(null);
  // Ticked rows (by id) drive the bar at the bottom: Post/Exclude on Pending, Undo on Posted.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const [showAddForm, setShowAddForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [direction, setDirection] = useState<"spent" | "received">("spent");
  const [amount, setAmount] = useState("");
  const addFormRef = useRef<HTMLDivElement>(null);

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(amount);
    if (!selectedAccountId || !description.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    add({
      id: localId(),
      accountId: selectedAccountId,
      date,
      description: description.trim(),
      payee: payeeName.trim() || undefined,
      spent: direction === "spent" ? parsed : undefined,
      received: direction === "received" ? parsed : undefined,
      status: "PENDING",
      createdAt: new Date().toISOString()
    });
    setDescription("");
    setPayeeName("");
    setAmount("");
    setShowAddForm(false);
    toast({ variant: "success", title: "Transaction added" });
  }

  function handleLoadSampleData() {
    if (!selectedAccountId) return;
    const expenseAccount = accounts.find((a) => a.category === "EXPENSE");
    const incomeAccount = accounts.find((a) => a.category === "INCOME");
    const now = new Date();
    const isoDaysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const samples: Omit<PendingBankTxn, "id" | "accountId" | "createdAt">[] = [
      // Pending -- the bulk of the sample set, since this is the tab that
      // actually needs testing (categorize, post, exclude). A mix of
      // already-categorized and not, so the warning triangle shows too.
      { date: isoDaysAgo(1), description: "Interest Earned", received: 12.44, status: "PENDING" },
      { date: isoDaysAgo(2), description: "Printer Paper & Ink", spent: 63.15, payee: "Airtek", categoryAccountId: expenseAccount?.id, status: "PENDING" },
      { date: isoDaysAgo(3), description: "Salary Deposit", received: 3200, status: "PENDING" },
      { date: isoDaysAgo(4), description: "Customer Refund", spent: 45, status: "PENDING" },
      { date: isoDaysAgo(5), description: "Freelance Web Work", received: 900, status: "PENDING" },
      { date: isoDaysAgo(6), description: "Consulting Invoice Payment", received: 1450, status: "PENDING" },
      { date: isoDaysAgo(7), description: "Internet & Cable", spent: 120, payee: "Comcast", categoryAccountId: expenseAccount?.id, status: "PENDING" },
      { date: isoDaysAgo(8), description: "Fees Billed", received: 675.5, status: "PENDING" },
      { date: isoDaysAgo(12), description: "Business Trip Lodging", spent: 410.2, categoryAccountId: expenseAccount?.id, status: "POSTED" },
      { date: isoDaysAgo(15), description: "Office Rent", received: 675.5, categoryAccountId: incomeAccount?.id, status: "POSTED" },
      { date: isoDaysAgo(18), description: "Duplicate Bank Fee", spent: 35, status: "EXCLUDED" },
      { date: isoDaysAgo(20), description: "Personal Purchase", spent: 22.5, status: "EXCLUDED" }
    ];
    samples.forEach((sample) => {
      add({ id: localId(), accountId: selectedAccountId, createdAt: new Date().toISOString(), ...sample });
    });
    // The sample transactions above set `payee` as a plain string (e.g.
    // "Airtek", "Comcast") -- that alone doesn't create a real Vendor
    // record, so the From/To dropdown's option list would stay empty.
    // Seed matching Vendor records too, so there's something to actually
    // select while trying this screen out.
    const samplePayees = Array.from(new Set(samples.map((s) => s.payee).filter((p): p is string => Boolean(p))));
    samplePayees.forEach((name) => {
      if (vendors.some((v) => v.name.toLowerCase() === name.toLowerCase())) return;
      addVendor({ name }).catch(() => {});
    });
    toast({ variant: "success", title: "Sample transactions loaded", description: "Local-only, for trying out Pending/Posted/Excluded -- delete anytime." });
  }

  // The AI answer already fetched for this row (by the Categorize form), if it still matches the row.
  function rowSuggestion(txn: DisplayRow) {
    const entry = storedSuggestions[txn.id];
    return entry && entry.key === suggestionKey({ payee: txn.description, amount: txn.received ? txn.received : -(txn.spent ?? 0) }) ? entry.suggestion : undefined;
  }
  function openAddPayee(txnId: string, prefill: { name: string; website: string | null } | null) {
    setAddPayeePrefill(prefill);
    setAddPayeeForId(txnId);
  }

  // Only staged Pending rows open the Categorize form (posted rows are history).
  function canExpand(txn: DisplayRow): boolean {
    return tab === "POSTED" || (tab === "PENDING" && Boolean(txn.isLocal));
  }
  const stopRowClick = (event: React.MouseEvent) => event.stopPropagation();

  async function refreshLedgerData() {
    await Promise.all([
      services.transactionService.listTransactions({ status: "POSTED" }).then(setPostedTransactions).catch(() => undefined),
      reloadAccounts()
    ]);
  }

  // Post creates the real ledger transaction (money in -> a deposit, money out
  // -> an expense, against this bank account), then flips the staged row to
  // Posted and remembers the transaction so Undo can void it. Returns whether
  // it posted, so batch posting can count.
  async function postRow(txn: DisplayRow, options: { quiet?: boolean } = {}): Promise<boolean> {
    const category = txn.categoryAccountId ? accountById.get(txn.categoryAccountId) : undefined;
    const amount = txn.received ?? txn.spent;
    if (!category || !amount || !selectedAccountId) {
      if (!options.quiet) toast({ variant: "error", title: "Select a category first" });
      return false;
    }
    const memo = txn.memo?.trim() || txn.description;
    try {
      let created;
      if (txn.received) {
        created = await services.transactionService.createDeposit({
          transactionDate: txn.date,
          memo,
          payee: txn.payee,
          accountLabel: category.name,
          sourceAccountId: selectedAccountId,
          postings: [
            { accountId: selectedAccountId, type: "DEBIT", amount },
            { accountId: category.id, type: "CREDIT", amount }
          ]
        });
      } else {
        created = await services.transactionService.createTransaction({
          type: "EXPENSE",
          transactionDate: txn.date,
          memo,
          payee: txn.payee,
          accountLabel: category.name,
          sourceAccountId: selectedAccountId,
          postings: [
            { accountId: category.id, type: "DEBIT", amount },
            { accountId: selectedAccountId, type: "CREDIT", amount }
          ]
        });
        await services.transactionService.postTransaction(created.id);
      }
      update(txn.id, { status: "POSTED", postedTransactionId: created.id, postedType: txn.received ? "Deposit" : "Expense" });
      if (!options.quiet) toast({ variant: "success", title: "Transaction posted" });
      await refreshLedgerData();
      return true;
    } catch (err) {
      toast({ variant: "error", title: "Could not post this transaction", description: err instanceof Error ? err.message : undefined });
      return false;
    }
  }

  // Undo voids the ledger transaction Post made and puts the row back in Pending.
  async function undoRow(txn: DisplayRow, options: { quiet?: boolean } = {}): Promise<boolean> {
    try {
      if (txn.postedTransactionId) await services.transactionService.voidTransaction(txn.postedTransactionId);
      update(txn.id, { status: "PENDING", postedTransactionId: undefined, postedType: undefined, splitLineCount: undefined });
      if (!options.quiet) toast({ variant: "success", title: "Transaction moved back to Pending" });
      await refreshLedgerData();
      return true;
    } catch (err) {
      toast({ variant: "error", title: "Could not undo this transaction", description: err instanceof Error ? err.message : undefined });
      return false;
    }
  }

  // Split and post: one bank line, several categories. The bank side stays a
  // single posting for the full amount; the other side is one posting per line.
  async function postSplit(txn: DisplayRow, lines: SplitLine[], memo: string): Promise<void> {
    const total = txn.received ?? txn.spent;
    if (!total || !selectedAccountId) throw new Error("This transaction has no amount.");
    const offset = lines.map((line) => ({ accountId: line.categoryAccountId, amount: Math.round((Number(line.amount) || 0) * 100) / 100 }));
    const payee = lines.find((l) => l.payee)?.payee || txn.payee;
    const finalMemo = memo.trim() || txn.description;
    let created;
    if (txn.received) {
      created = await services.transactionService.createDeposit({
        transactionDate: txn.date,
        memo: finalMemo,
        payee,
        accountLabel: "Split",
        sourceAccountId: selectedAccountId,
        postings: [{ accountId: selectedAccountId, type: "DEBIT", amount: total }, ...offset.map((o) => ({ ...o, type: "CREDIT" as const }))]
      });
    } else {
      created = await services.transactionService.createTransaction({
        type: "EXPENSE",
        transactionDate: txn.date,
        memo: finalMemo,
        payee,
        accountLabel: "Split",
        sourceAccountId: selectedAccountId,
        postings: [...offset.map((o) => ({ ...o, type: "DEBIT" as const })), { accountId: selectedAccountId, type: "CREDIT", amount: total }]
      });
      await services.transactionService.postTransaction(created.id);
    }
    update(txn.id, { status: "POSTED", postedTransactionId: created.id, postedType: txn.received ? "Deposit" : "Expense", splitLineCount: lines.length, memo: finalMemo, payee: payee || undefined });
    toast({ variant: "success", title: "Transaction posted" });
    await refreshLedgerData();
  }

  function handlePost(txn: DisplayRow) {
    void postRow(txn);
  }

  // Excluding only sets this staged line aside (duplicates, personal, noise): it
  // never touched the books, so no ledger balance changes -- only the Pending
  // count does. Undo puts it back in Pending.
  function handleExclude(txn: DisplayRow) {
    update(txn.id, { status: "EXCLUDED" });
    toast({ variant: "success", title: "Transaction excluded" });
  }

  function restoreExcluded(rows: DisplayRow[]) {
    rows.forEach((row) => update(row.id, { status: "PENDING" }));
    toast({ variant: "success", title: `${rows.length} transaction${rows.length === 1 ? "" : "s"} moved back to Pending` });
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (bankAccounts.length === 0) {
    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text-global)]">Bank transactions</h1>
        <p className="text-sm text-[var(--color-text-disabled)]">
          No bank or credit card accounts yet. Add one from{" "}
          <Link href="/all-apps/chart-of-accounts" className="text-[var(--color-link-action)] hover:underline">
            Chart of Accounts
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      {/* QBO's header: breadcrumb with Give feedback on the right, then the
          title with the quick-add and Link account buttons on the right. */}
      <div className="mb-2 flex items-center justify-between gap-3 text-sm leading-[21px] text-[var(--color-text-primary)]">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
          <span>Accounting</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Bank transactions</span>
        </nav>
        <button type="button" disabled className="flex cursor-not-allowed items-center gap-1.5 font-medium text-[var(--color-text-disabled)]">
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          Give feedback
        </button>
      </div>
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[32px] font-normal leading-10 text-[var(--color-text-global)]">Bank transactions</h1>
        <div className="flex items-center gap-2">
          <QuickAddMenu accountId={selectedAccountId} />
          <SplitButton
            label="Link account"
            toggleLabel="More link account options"
            onMainClick={() => toast({ variant: "info", title: "Linking a bank isn't available yet" })}
            onToggle={() => toast({ variant: "info", title: "Linking a bank isn't available yet" })}
          />
        </div>
      </div>

      {/* Account header row */}
      <div className="mb-7 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative" ref={accountMenuRef}>
          <button
            type="button"
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg px-1 py-0 text-xl font-semibold leading-[30px] text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ui-primary)] text-white">
              <Landmark className="h-4 w-4" aria-hidden="true" />
            </span>
            {selectedAccount?.name ?? "Select account"}
            {accountMenuOpen ? (
              <ChevronUp className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            )}
          </button>
          {accountMenuOpen ? (
            <div className="absolute left-0 top-full z-20 mt-2 w-[460px] max-w-[90vw] rounded-md border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-3 shadow-lg">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Search by account name"
                  className="h-10 w-full rounded-md border-2 border-[var(--override-focus)] bg-[var(--color-input-background)] pl-9 pr-3 text-sm text-[var(--color-input-text)] outline-none placeholder:text-[var(--color-text-disabled)]"
                />
              </div>
              <div className="mt-2 flex items-center justify-between px-1 text-sm font-medium text-[var(--color-link-action)]">
                <button type="button" onClick={() => setShowAccountCards((v) => !v)} className="hover:underline">
                  {showAccountCards ? "Hide account cards" : "Show account cards"}
                </button>
                <button
                  type="button"
                  onClick={() => toast({ variant: "info", title: "Reordering accounts isn't available yet" })}
                  className="hover:underline"
                >
                  Reorder accounts
                </button>
              </div>
              <div className="mt-2 max-h-96 overflow-y-auto">
                {filteredBankAccounts.length === 0 ? (
                  <p className="px-1 py-3 text-sm text-[var(--color-text-disabled)]">No accounts match "{accountSearch}".</p>
                ) : (
                  filteredBankAccounts.map((a) => {
                    const pending = pendingCountByAccount.get(a.id) ?? 0;
                    const latest = latestDateByAccount.get(a.id);
                    const isSelected = a.id === selectedAccountId;
                    return (
                      <div
                        key={a.id}
                        className={`group flex items-start gap-3 rounded-md px-3 py-3 hover:bg-[var(--color-action-passive-subtle-hover)] ${
                          isSelected ? "bg-[var(--color-container-background-accent)]" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAccountId(a.id);
                            setAccountMenuOpen(false);
                            setAccountSearch("");
                          }}
                          className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        >
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-ui-primary)] text-white">
                            <AccountKindIcon account={a} className="h-5 w-5" />
                          </span>
                          <span className="min-w-0 flex-1 text-sm text-[var(--color-text-global)]">
                            <span className="block truncate font-semibold">
                              {a.name}
                              {a.subtype ? ` - ${a.subtype}` : ""}
                            </span>
                            <span className="mt-0.5 block">Bank balance: {formatMoney(0)}</span>
                            <span className="mt-0.5 flex items-center justify-between gap-3">
                              <span>
                                {formatTxnCount(pending)} Transaction{pending === 1 ? "" : "s"}
                              </span>
                              {latest ? <span className="text-xs text-[var(--color-text-primary)]">{formatDisplayDate(latest)}</span> : null}
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingAccount(a);
                            setAccountMenuOpen(false);
                          }}
                          aria-label={`Edit ${a.name}`}
                          className={`mt-1 text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)] ${
                            isSelected ? "" : "opacity-0 focus:opacity-100 group-hover:opacity-100"
                          }`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}
        </div>
        {/* RightTool's note: when this account was last reconciled; opens that account's reconciliation history. */}
        {selectedAccount ? (
          <Link
            href={`/all-apps/reconcile?accountId=${encodeURIComponent(selectedAccount.id)}&view=history`}
            className="text-sm text-[var(--color-negative)] hover:underline"
          >
            {lastReconciledDate ? `Last Reconciled: ${formatDisplayDate(lastReconciledDate)}` : "Last Reconcile Not Found"} [{selectedAccount.name}]
          </Link>
        ) : null}
        {showAccountCards && bankAccounts.length > CARDS_COLLAPSED_COUNT ? (
          <button
            type="button"
            onClick={() => setCardsExpanded((v) => !v)}
            aria-expanded={cardsExpanded}
            className="ml-auto flex items-center gap-1 text-sm font-medium text-[var(--color-link-action)] hover:underline"
          >
            {cardsExpanded ? "Show fewer accounts" : `Show all ${bankAccounts.length} accounts`}
            {cardsExpanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          </button>
        ) : null}
      </div>

      {/* Account cards: three show at once, the rest scroll sideways. */}
      {showAccountCards && bankAccounts.length > 0 ? (
        <div className="mb-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {visibleCardAccounts.map((a) => {
            const isSelected = a.id === selectedAccountId;
            const pending = pendingCountByAccount.get(a.id) ?? 0;
            const latest = latestDateByAccount.get(a.id);
            return (
              <div key={a.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedAccountId(a.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedAccountId(a.id);
                    }
                  }}
                  aria-pressed={isSelected}
                  className={`cursor-pointer rounded-lg border bg-[var(--color-container-background-primary)] px-4 py-3 ${
                    isSelected ? "border-2 border-[var(--color-ui-primary)]" : "border-[var(--color-divider-tertiary)] hover:border-[var(--color-icon-secondary)]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <span className="truncate text-sm leading-[21px] text-[var(--color-text-primary)]">{a.name}</span>
                    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-icon-secondary)] px-1.5 text-xs font-semibold text-white">
                      {formatTxnCount(pending)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-2xl font-semibold leading-[30px] text-[var(--color-text-global)]">Bank: {formatMoney(0)}</p>
                    {isSelected ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingAccount(a);
                        }}
                        aria-label={`Edit ${a.name}`}
                        className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm leading-[21px] text-[var(--color-text-primary)]">
                    <span>Posted: {formatMoney(a.currentBalance)}</span>
                    {latest ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDisplayDate(latest)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        </div>
      ) : null}

      {/* Tabs + secondary links */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-[3px] rounded-md bg-[var(--color-segmented-background)] p-0.5">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`h-8 min-w-[100px] rounded-[5px] px-4 text-center text-base transition-colors ${
                tab === value ? "bg-[var(--color-container-background-primary)] text-[var(--color-text-global)] shadow-sm" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
              }`}
            >
              {/* QBO only counts Pending; Posted/Excluded stay bare. */}
              {label}
              {value === "PENDING" && tabCounts.PENDING ? ` (${tabCounts.PENDING})` : ""}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => setShowAddForm((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {showAddForm ? "Cancel" : "Add transaction"}
          </Button>
          {process.env.NODE_ENV !== "production" ? (
            <Button variant="secondary" size="sm" onClick={handleLoadSampleData} title="Dev-only: local sample data for trying out Pending/Posted/Excluded">
              Load sample transactions
            </Button>
          ) : null}
        </div>
        <Link
          href={selectedAccountId ? `/register?accountId=${selectedAccountId}` : "/register"}
          className="text-sm font-medium text-[var(--color-link-action)] hover:underline"
        >
          Go to bank register
        </Link>
      </div>

      {/* Toolbar + table in one bordered panel, laid out like QBO's. */}
      <div className="overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-5 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-[320px] max-w-full">
              <InputField placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="h-[38px] pr-10" />
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            </div>
            {tab !== "EXCLUDED" ? (
              <>
            <FilterSelect value={datePreset} onChange={(v) => setDatePreset(v as DatePreset)} icon={CalendarDays} label="Filter by date" className="w-[200px]">
              {(Object.keys(DATE_PRESET_LABELS) as DatePreset[]).map((key) => (
                <option key={key} value={key}>{DATE_PRESET_LABELS[key]}</option>
              ))}
            </FilterSelect>
            <FilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as StatusFilter)} label="Filter transactions" className="w-[240px]">
              <option value="all">All transactions ({statusCounts.all})</option>
              <option value="categorized">Categorized ({statusCounts.categorized})</option>
              <option value="uncategorized">Uncategorized ({statusCounts.uncategorized})</option>
            </FilterSelect>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-primary)]">
            <span>{pageStart}-{pageEnd} of {visibleTxns.length}</span>
            <span className="flex items-center gap-2">
              <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="disabled:text-[var(--color-text-disabled)]">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              Page
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(event) => setPage(Math.min(totalPages, Math.max(1, Number(event.target.value) || 1)))}
                aria-label="Page number"
                className="h-9 w-12 rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] text-center text-[var(--color-input-text)]"
              />
              of {totalPages}
              <button type="button" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} className="disabled:text-[var(--color-text-disabled)]">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
            <span className="flex items-center gap-3 text-[var(--color-icon-secondary)]">
              <IconButton icon={Printer} label="Print" size="sm" />
              <IconButton icon={Share} label="Export" size="sm" />
              <IconButton icon={Settings} label="Settings" size="sm" />
            </span>
          </div>
        </div>

      {showAddForm ? (
        <div ref={addFormRef} className="mx-4 mb-3 rounded-lg border border-[var(--color-divider-tertiary)] p-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <InputField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="min-w-[160px] flex-1">
              <InputField label="Description" placeholder="e.g. Printer Paper & Ink" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="w-40">
              <Select label="From/To" value={payeeName} onChange={setPayeeName} options={vendorOptions} placeholder="Select vendor" allowCustomValue />
            </div>
            <div className="w-32">
              <Select value={direction} onChange={(v) => setDirection(v as "spent" | "received")} options={[{ value: "spent", label: "Spent" }, { value: "received", label: "Received" }]} placeholder="Type" allowCustomValue={false} />
            </div>
            <div className="w-32">
              <NumberField label="Amount" currency placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <Button type="submit" disabled={!description.trim() || amount.trim() === ""}>
              Add
            </Button>
          </form>
        </div>
      ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead className="bg-[var(--color-container-background-accent)] text-left text-[var(--color-text-global)]">
              {tab === "EXCLUDED" ? (
                <tr className="[&>th]:h-[46px] [&>th]:px-[10px] [&>th]:py-0 [&>th]:text-sm [&>th]:font-semibold">
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all transactions"
                      checked={pagedTxns.length > 0 && pagedTxns.every((t) => selectedIds.has(t.id))}
                      onChange={(event) => setSelectedIds(event.target.checked ? new Set(pagedTxns.map((t) => t.id)) : new Set())}
                    />
                  </th>
                  <th className="w-44 border-l border-[var(--color-divider-tertiary)]">
                    Date<ChevronDown className="ml-2 inline h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  </th>
                  <th className="border-l border-[var(--color-divider-tertiary)]">Bank description</th>
                  <th className="w-44 border-l border-[var(--color-divider-tertiary)] text-right">Amount</th>
                  <th className="w-28 border-l-2 border-[var(--color-divider-tertiary)] text-right">Action</th>
                </tr>
              ) : (
              <tr className="[&>th]:h-[46px] [&>th]:px-[10px] [&>th]:py-0 [&>th]:text-sm [&>th]:font-semibold">
                <th className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all transactions"
                    checked={pagedTxns.length > 0 && pagedTxns.every((t) => selectedIds.has(t.id))}
                    onChange={(event) => setSelectedIds(event.target.checked ? new Set(pagedTxns.map((t) => t.id)) : new Set())}
                  />
                </th>
                <th className="w-32 border-l border-[var(--color-divider-tertiary)]">
                  Date{tab === "POSTED" ? <ChevronDown className="ml-2 inline h-3.5 w-3.5 fill-current" aria-hidden="true" /> : null}
                </th>
                <th className="min-w-[220px] border-l border-[var(--color-divider-tertiary)]">Bank description</th>
                <th className="w-28 border-l border-[var(--color-divider-tertiary)] text-right">Spent</th>
                <th className="w-28 border-l border-[var(--color-divider-tertiary)] text-right">Received</th>
                {tab !== "POSTED" ? (
                  <th className="w-14 border-l border-[var(--color-divider-tertiary)] text-center" aria-label="Attachments">
                    <Paperclip className="mx-auto h-4 w-4" aria-hidden="true" />
                  </th>
                ) : null}
                <th className="w-14 border-l border-[var(--color-divider-tertiary)] text-center" aria-label="Comments">
                  <MessageSquare className="mx-auto h-4 w-4" aria-hidden="true" />
                </th>
                <th className="border-l border-[var(--color-divider-tertiary)]">From/To</th>
                <th className="w-28 border-l border-[var(--color-divider-tertiary)]">Purpose</th>
                <th className="border-l border-[var(--color-divider-tertiary)]">{tab === "POSTED" ? "Match/Category" : "Match/Categorize"}</th>
                {tab === "POSTED" ? <th className="w-44 border-l border-[var(--color-divider-tertiary)]">Transaction Posted</th> : null}
                <th className="w-28 border-l-2 border-[var(--color-divider-tertiary)] text-right">Action</th>
              </tr>
              )}
            </thead>
            <tbody>
            {!hydrated ? (
              <tr>
                <td colSpan={tab === "EXCLUDED" ? 5 : 11} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : visibleTxns.length === 0 ? (
              <tr>
                <td colSpan={tab === "EXCLUDED" ? 5 : 11} className="px-3 py-6 text-center text-sm text-[var(--color-text-disabled)]">
                  No {tab.toLowerCase()} transactions.
                </td>
              </tr>
            ) : (
              pagedTxns.map((txn, index) => tab === "EXCLUDED" ? (
                <tr
                  key={txn.id}
                  className={`h-[50px] border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)] ${selectedIds.has(txn.id) ? "bg-[color-mix(in_srgb,var(--color-link-action)_12%,transparent)]" : index % 2 === 1 ? "bg-[var(--color-table-row-secondary)]" : ""}`}
                >
                  <td className="px-[10px] py-0 align-middle">
                    <input
                      type="checkbox"
                      aria-label="Select transaction"
                      checked={selectedIds.has(txn.id)}
                      onChange={() =>
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (next.has(txn.id)) next.delete(txn.id);
                          else next.add(txn.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className={`${CELL} whitespace-nowrap font-medium text-[var(--color-text-global)]`}>{formatDisplayDate(txn.date)}</td>
                  <td className={CELL}>
                    <span className="block text-[var(--color-text-global)]">{txn.description}</span>
                    <span className="block text-[11px] uppercase leading-[14px] text-[var(--color-negative)]">{txn.description}</span>
                  </td>
                  <td className={`${CELL} text-right text-[var(--color-text-global)]`}>
                    {txn.received ? formatMoney(txn.received) : txn.spent ? `-${formatMoney(txn.spent)}` : ""}
                  </td>
                  <td className="border-l border-[var(--color-divider-tertiary)] p-2 align-middle text-right">
                    <button type="button" onClick={() => restoreExcluded([txn])} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
                      Undo
                    </button>
                  </td>
                </tr>
              ) : (
                <Fragment key={txn.id}>
                <tr
                  onClick={() => canExpand(txn) && setExpandedId((current) => (current === txn.id ? null : txn.id))}
                  className={`h-[50px] border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)] ${canExpand(txn) ? "cursor-pointer" : ""} ${selectedIds.has(txn.id) ? "bg-[color-mix(in_srgb,var(--color-link-action)_12%,transparent)]" : index % 2 === 1 ? "bg-[var(--color-table-row-secondary)]" : ""}`}
                >
                  <td className="px-[10px] py-0 align-middle" onClick={stopRowClick}>
                    <input
                      type="checkbox"
                      aria-label="Select transaction"
                      checked={selectedIds.has(txn.id)}
                      onChange={() =>
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (next.has(txn.id)) next.delete(txn.id);
                          else next.add(txn.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td className={`${CELL} whitespace-nowrap font-medium text-[var(--color-text-global)]`}>{formatDisplayDate(txn.date)}</td>
                  <td className={CELL}>
                    <span className="block text-[var(--color-text-global)]">{txn.description}</span>
                    <span className="block text-[11px] uppercase leading-[14px] text-[var(--color-negative)]">{txn.description}</span>
                  </td>
                  <td className={`${CELL} text-right text-[var(--color-text-global)]`}>{txn.spent ? formatMoney(txn.spent) : ""}</td>
                  <td className={`${CELL} text-right text-[var(--color-text-global)]`}>{txn.received ? formatMoney(txn.received) : ""}</td>
                  {tab !== "POSTED" ? (
                  <td className={`${CELL} text-center`} onClick={stopRowClick}>
                    <button type="button" onClick={() => { setFilesTxnId(txn.id); rowFileInput.current?.click(); }} aria-label={fileCount.get(txn.id) ? `${fileCount.get(txn.id)} attachment(s), upload another` : "Upload attachment"} title="Upload attachment" className="inline-flex items-center gap-0.5 text-[var(--color-icon-secondary)] hover:text-[var(--color-link-action)]">
                      {fileCount.get(txn.id) ? <><Paperclip className="h-4 w-4" aria-hidden="true" /><span className="text-xs">{fileCount.get(txn.id)}</span></> : <Plus className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </td>
                  ) : null}
                  <td className={`${CELL} text-center`} onClick={stopRowClick}>
                    <button type="button" disabled title="Comments aren't available yet" className="cursor-not-allowed text-[var(--color-icon-secondary)]">
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                  <td className="border-l border-[var(--color-divider-tertiary)] w-48 px-2 py-0 align-middle [&_input]:h-7 [&_input]:border-transparent [&_input]:bg-transparent" onClick={stopRowClick}>
                    {tab === "PENDING" ? (
                      <div className="flex items-center gap-1">
                        {(() => {
                          const merchant = rowSuggestion(txn)?.payeeSuggestion;
                          const known = merchant ? vendorOptions.some((o) => o.label.toLowerCase() === merchant.name.toLowerCase()) : true;
                          return merchant && !known && !txn.payee ? (
                            <PayeeSuggestionMarker merchant={merchant} kind={txn.received ? "customer" : "vendor"} onAdd={() => openAddPayee(txn.id, { name: merchant.name, website: merchant.website })} />
                          ) : null;
                        })()}
                        <div className="min-w-0 flex-1">
                      <Select
                        value={txn.payee ?? ""}
                        onChange={(value) => update(txn.id, { payee: value || undefined })}
                        options={vendorOptions}
                        placeholder={txn.received ? "Select customer" : "Select vendor"}
                        allowCustomValue={false}
                        onAddNew={() => openAddPayee(txn.id, null)}
                        addNewLabel="+ Add new"
                        optionSize="sm"
                      />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[13px] text-[var(--color-text-primary)]">{txn.payee || "--"}</span>
                    )}
                  </td>
                  <td className="w-32 border-l border-[var(--color-divider-tertiary)] px-2 py-0 align-middle [&_input]:h-7 [&_input]:border-transparent [&_input]:bg-transparent" onClick={stopRowClick}>
                    {tab === "PENDING" ? (
                      <Select
                        value={txn.purpose ?? "BUSINESS"}
                        onChange={(value) => update(txn.id, { purpose: value as PendingBankTxn["purpose"] })}
                        options={PURPOSE_OPTIONS}
                        placeholder="Purpose"
                        allowCustomValue={false}
                        showCheckmark
                        optionSize="sm"
                      />
                    ) : (
                      <span className="text-sm text-[var(--color-text-global)]">{txn.purpose === "PERSONAL" ? "Personal" : "Business"}</span>
                    )}
                  </td>
                  <td className="border-l border-[var(--color-divider-tertiary)] w-56 px-2 py-0 align-middle [&_input]:h-7 [&_input]:border-transparent [&_input]:bg-transparent" onClick={stopRowClick}>
                    {tab === "PENDING" ? (
                      <div className="flex items-center gap-1.5">
                        {(() => {
                          const suggestion = rowSuggestion(txn);
                          const awaitingReview = !txn.categoryAccountId || Boolean(suggestion?.accountId && suggestion.accountId === txn.categoryAccountId);
                          if (!awaitingReview) return null;
                          const merchant = suggestion?.payeeSuggestion ?? null;
                          const knownMerchant = merchant ? vendorOptions.some((o) => o.label.toLowerCase() === merchant.name.toLowerCase()) : true;
                          return (
                            <CategorySuggestionMarker
                              accountName={suggestion?.accountId ? (accountById.get(suggestion.accountId)?.name ?? null) : null}
                              confirmed={Boolean(suggestion?.accountId && suggestion.accountId === txn.categoryAccountId)}
                              merchant={merchant && !knownMerchant && !txn.payee ? merchant : null}
                              kind={txn.received ? "customer" : "vendor"}
                              onAdd={() => merchant && openAddPayee(txn.id, { name: merchant.name, website: merchant.website })}
                              onApply={() => suggestion?.accountId && update(txn.id, { categoryAccountId: suggestion.accountId })}
                            />
                          );
                        })()}
                        <Select
                          value={txn.categoryAccountId ?? ""}
                          onChange={(value) => update(txn.id, { categoryAccountId: value || undefined })}
                          options={expenseAccountOptions}
                          placeholder="Select category"
                          allowCustomValue={false}
                          optionSize="sm"
                        />
                      </div>
                    ) : (
                      <span className="text-[13px] text-[var(--color-text-primary)]">{txn.categoryLabel ?? "--"}</span>
                    )}
                  </td>
                  {tab === "POSTED" ? (
                    <td className={CELL} onClick={stopRowClick}>
                      {txn.postedTransactionId ? (
                        <Link
                          href={`/register?accountId=${encodeURIComponent(selectedAccountId)}&tx=${encodeURIComponent(txn.postedTransactionId)}`}
                          className="text-[var(--color-link-action)] hover:underline"
                        >
                          {txn.postedType ?? "Transaction"} {formatDisplayDate(txn.date)}
                        </Link>
                      ) : (
                        <span className="text-[var(--color-icon-secondary)]">--</span>
                      )}
                    </td>
                  ) : null}
                  <td className="border-l border-[var(--color-divider-tertiary)] p-2 align-middle text-right" onClick={stopRowClick}>
                    {tab === "PENDING" ? (
                      <PendingRowActions
                        txn={txn}
                        onPost={() => handlePost(txn)}
                        onExclude={() => handleExclude(txn)}
                        onSplit={() => setSplitTxnId(txn.id)}
                      />
                    ) : tab === "POSTED" ? (
                      txn.isLocal ? (
                        <button type="button" onClick={() => void undoRow(txn)} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
                          Undo
                        </button>
                      ) : null
                    ) : txn.isLocal ? (
                      <button type="button" onClick={() => remove(txn.id)} className="text-sm font-medium text-[var(--color-negative)] hover:underline">
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
                {expandedId === txn.id && tab === "POSTED" ? (
                  <tr>
                    <td colSpan={11} className="border-t border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] px-7 py-5">
                      <p className="text-xs font-semibold uppercase text-[var(--color-text-global)]">Description</p>
                      <p className="mb-5 mt-1 text-sm text-[var(--color-text-primary)]">
                        {selectedAccount?.name} shows this as <strong className="text-[var(--color-text-global)]">{txn.description}</strong>
                      </p>
                      <p className="text-xs font-semibold uppercase text-[var(--color-text-global)]">Memo</p>
                      <p className="mt-1 text-sm text-[var(--color-text-primary)]">{txn.memo || txn.description}</p>
                    </td>
                  </tr>
                ) : null}
                {expandedId === txn.id && tab === "PENDING" && canExpand(txn) ? (
                  <tr>
                    <td colSpan={11} className="p-0">
                      <BankTxnDetailForm
                        txn={txn}
                        payeeOptions={vendorOptions}
                        accountOptions={expenseAccountOptions}
                        onChange={(patch) => update(txn.id, patch)}
                        onAddPayee={() => openAddPayee(txn.id, null)}
                        onAddSuggestedPayee={(prefill) => openAddPayee(txn.id, prefill)}
                        productOptions={productOptions}
                        onAddProduct={() => setAddProductForId(txn.id)}
                        onSplit={() => setSplitTxnId(txn.id)}
                        onPost={() => {
                          handlePost(txn);
                          if (txn.categoryAccountId) setExpandedId(null);
                        }}
                        onExclude={() => {
                          handleExclude(txn);
                          setExpandedId(null);
                        }}
                        onClose={() => setExpandedId(null)}
                      />
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              ))
            )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-4 border-t border-[var(--color-divider-tertiary)] px-6 py-3 text-sm text-[var(--color-text-primary)]">
          <span>{pageStart}-{pageEnd} of {visibleTxns.length} items</span>
          <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="disabled:text-[var(--color-text-disabled)]">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="rounded bg-[var(--color-container-background-accent)] px-2.5 py-1 font-medium text-[var(--color-text-global)]">{currentPage}</span>
          <button type="button" aria-label="Next page" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} className="disabled:text-[var(--color-text-disabled)]">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      {selectedIds.size > 0 ? (
        <SelectionBar
          rows={visibleTxns.filter((t) => selectedIds.has(t.id))}
          tab={tab}
          onClear={() => setSelectedIds(new Set())}
          onPost={async (rows) => {
            let posted = 0;
            for (const row of rows) if (await postRow(row, { quiet: true })) posted += 1;
            const skipped = rows.length - posted;
            toast({ variant: posted > 0 ? "success" : "error", title: posted > 0 ? `${posted} transaction${posted === 1 ? "" : "s"} posted` : "Nothing was posted", description: skipped > 0 ? `${skipped} still need a category.` : undefined });
            setSelectedIds(new Set());
          }}
          onExclude={(rows) => {
            rows.forEach((row) => update(row.id, { status: "EXCLUDED" }));
            toast({ variant: "success", title: `${rows.length} transaction${rows.length === 1 ? "" : "s"} excluded` });
            setSelectedIds(new Set());
          }}
          onUndo={async (rows) => {
            if (tab === "EXCLUDED") {
              restoreExcluded(rows);
              setSelectedIds(new Set());
              return;
            }
            let undone = 0;
            for (const row of rows.filter((r) => r.isLocal)) if (await undoRow(row, { quiet: true })) undone += 1;
            toast({ variant: undone > 0 ? "success" : "error", title: undone > 0 ? `${undone} transaction${undone === 1 ? "" : "s"} moved back to Pending` : "Nothing to undo" });
            setSelectedIds(new Set());
          }}
        />
      ) : null}
      <input
        ref={rowFileInput}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          if (filesTxnId && files.length > 0) void bankFiles.uploadTo(filesTxnId, files).then((message) => message && toast({ variant: "error", title: message }));
        }}
      />
      <SplitTransactionModal
        open={splitTxnId !== null}
        txn={pagedTxns.find((t) => t.id === splitTxnId) ?? null}
        bankAccountName={selectedAccount?.name ?? ""}
        payeeOptions={vendorOptions}
        accountOptions={expenseAccountOptions}
        formatDate={formatDisplayDate}
        formatMoney={formatMoney}
        onClose={() => setSplitTxnId(null)}
        onConfirm={async (lines, memo) => {
          const row = pagedTxns.find((t) => t.id === splitTxnId);
          if (row) await postSplit(row, lines, memo);
          setExpandedId(null);
        }}
      />
      <ProductServicePanel
        open={addProductForId !== null}
        incomeAccountOptions={incomeAccountOptions}
        onClose={() => setAddProductForId(null)}
        onSave={async (input) => {
          const created = await addProductItem(input);
          if (addProductForId) update(addProductForId, { productServiceId: created.id });
          toast({ variant: "success", title: `"${created.name}" added to Products & Services` });
        }}
      />
      <PayeeSideModal
        open={addPayeeForId !== null}
        prefill={
          addPayeePrefill
            ? { kind: pagedTxns.find((t) => t.id === addPayeeForId)?.received ? "CUSTOMER" : "VENDOR", name: addPayeePrefill.name, website: addPayeePrefill.website }
            : null
        }
        onClose={() => {
          setAddPayeeForId(null);
          setAddPayeePrefill(null);
        }}
        onSave={(payee) => {
          const targetId = addPayeeForId;
          const create = payee.kind === "CUSTOMER" ? addCustomer({ name: payee.name }) : addVendor({ name: payee.name });
          create
            .then(() => {
              if (targetId) update(targetId, { payee: payee.name, payeeKind: payee.kind === "CUSTOMER" ? "CUSTOMER" : "VENDOR" });
              toast({ variant: "success", title: `"${payee.name}" added to ${payee.kind === "CUSTOMER" ? "Customers" : "Vendors"}` });
            })
            .catch((err) => toast({ variant: "error", title: "Could not add contact", description: err instanceof Error ? err.message : undefined }));
        }}
      />
      <AddAccountModal
        open={editingAccount !== null}
        accounts={accounts}
        editingAccount={editingAccount}
        onClose={() => setEditingAccount(null)}
        onSave={async () => {
          throw new Error("Creating accounts isn't available from Bank transactions.");
        }}
        onUpdate={async (accountId, input) => {
          await services.accountService.updateAccount(accountId, { name: input.name, subtype: input.subtype });
          toast({ variant: "success", title: "Account updated" });
          await reloadAccounts();
        }}
      />
    </>
  );
}

// "Post" as a text link plus a chevron opening Split/Create rule/Exclude,
// matching the reference. Split opens the Split transaction dialog; Create
// rule links to the real Bank Rules feature; Exclude is real (flips this
// row's local status).
function PendingRowActions({ onPost, onExclude, onSplit }: { txn: DisplayRow; onPost: () => void; onExclude: () => void; onSplit: () => void }) {
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
    <div className="relative inline-flex items-center justify-end gap-1" ref={ref}>
      <button type="button" onClick={onPost} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
        Post
      </button>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="More actions" className="text-[var(--color-icon-secondary)]">
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 text-left shadow-lg">
          <button
            type="button"
            onClick={() => {
              onSplit();
              setOpen(false);
            }}
            className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            Split
          </button>
          <Link
            href="/all-apps/bank-rules"
            onClick={() => setOpen(false)}
            className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            Create rule
          </Link>
          <button
            type="button"
            onClick={() => {
              onExclude();
              setOpen(false);
            }}
            className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            Exclude
          </button>
        </div>
      ) : null}
    </div>
  );
}

// QBO's dark bar at the bottom while rows are ticked: what's selected, and the
// actions that make sense for the current tab.
function SelectionBar({
  rows,
  tab,
  onClear,
  onPost,
  onExclude,
  onUndo
}: {
  rows: DisplayRow[];
  tab: PendingTxnStatus;
  onClear: () => void;
  onPost: (rows: DisplayRow[]) => void;
  onExclude: (rows: DisplayRow[]) => void;
  onUndo: (rows: DisplayRow[]) => void;
}) {
  const out = rows.filter((r) => r.spent);
  const incoming = rows.filter((r) => r.received);
  const outTotal = out.reduce((sum, r) => sum + (r.spent ?? 0), 0);
  const inTotal = incoming.reduce((sum, r) => sum + (r.received ?? 0), 0);
  const summary =
    incoming.length === 0
      ? `${rows.length} money out transaction${rows.length === 1 ? "" : "s"} -${formatMoney(outTotal)}`
      : out.length === 0
        ? `${rows.length} money in transaction${rows.length === 1 ? "" : "s"} ${formatMoney(inTotal)}`
        : `${rows.length} transactions`;
  const button = "rounded-md border border-white/70 px-5 py-2 text-base font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="sticky bottom-0 z-20 mt-4 flex flex-wrap items-center gap-4 rounded-t-lg bg-[#21262a] px-4 py-4 text-white shadow-lg" role="region" aria-label="Selected transactions">
      <span className="mr-2 text-base">{summary}</span>
      {tab === "PENDING" ? (
        <>
          <button type="button" className={button} onClick={() => onPost(rows)}>
            Post
          </button>
          <button type="button" className={button} onClick={() => onExclude(rows)}>
            Exclude
          </button>
        </>
      ) : tab === "EXCLUDED" ? (
        <button type="button" className={button} onClick={() => onUndo(rows)}>
          Undo
        </button>
      ) : tab === "POSTED" ? (
        <>
          <button type="button" className={button} onClick={() => onUndo(rows)}>
            Undo
          </button>
          <button type="button" className={button} disabled title="Editing from here isn't available yet">
            Edit
          </button>
          <button type="button" className={button} disabled title="Messages aren't available yet">
            New message
          </button>
        </>
      ) : null}
      <button type="button" onClick={onClear} aria-label="Clear selection" className="ml-auto text-white/80 hover:text-white">
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
