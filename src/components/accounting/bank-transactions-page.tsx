"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, CreditCard, Landmark, MessageSquarePlus, Pencil, Plus, Printer, RefreshCw, Search, Settings, Share, TriangleAlert } from "lucide-react";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { QuickAddMenu } from "@/components/bank-register/register-header-actions";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { PendingBankTxn, PendingTxnStatus } from "@/lib/local-store/accounting-types";
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
          categoryLabel: otherPostings.length > 1 ? "Split" : otherAccount?.name
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [postedTransactions, selectedAccountId, accountById]);

  const [tab, setTab] = useState<PendingTxnStatus>("PENDING");
  const [search, setSearch] = useState("");
  const stagingRowsForTab = useMemo<DisplayRow[]>(
    () => accountTxns.filter((t) => t.status === tab).map((t) => ({ ...t, categoryLabel: t.categoryAccountId ? accountById.get(t.categoryAccountId)?.name : undefined, isLocal: true })),
    [accountTxns, tab, accountById]
  );
  // Posted shows real transactions plus any locally-staged rows the user
  // has clicked "Post" on -- posting a staged row still needs somewhere
  // to land, not just vanish from Pending with nothing to show for it.
  const locallyPostedRows = useMemo<DisplayRow[]>(
    () =>
      accountTxns
        .filter((t) => t.status === "POSTED")
        .map((t) => ({ ...t, categoryLabel: t.categoryAccountId ? accountById.get(t.categoryAccountId)?.name : undefined, isLocal: true })),
    [accountTxns, accountById]
  );
  const filteredTxns = useMemo(
    () =>
      (tab === "POSTED" ? [...realPostedRows, ...locallyPostedRows] : stagingRowsForTab).filter(
        (t) => search.trim() === "" || t.description.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [tab, realPostedRows, locallyPostedRows, stagingRowsForTab, search]
  );
  const tabCounts = useMemo(
    () => ({
      PENDING: accountTxns.filter((t) => t.status === "PENDING").length,
      POSTED: realPostedRows.length + locallyPostedRows.length,
      EXCLUDED: accountTxns.filter((t) => t.status === "EXCLUDED").length
    }),
    [accountTxns, realPostedRows, locallyPostedRows]
  );

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
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v.name, label: v.name, rightLabel: v.is1099Contractor ? "Vendor" : "Contact" })), [vendors]);

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

  function handlePost(txn: DisplayRow) {
    if (!txn.categoryAccountId) {
      toast({ variant: "error", title: "Select a category first" });
      return;
    }
    update(txn.id, { status: "POSTED" });
    toast({ variant: "success", title: "Marked posted", description: "Local-only for now -- this doesn't create a real transaction yet." });
  }

  function handleExclude(txn: DisplayRow) {
    update(txn.id, { status: "EXCLUDED" });
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
      {/* Title left; Give feedback over the "+ Expense" quick-add and Link
          account buttons, top right (QBO's current layout). */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Bank transactions</h1>
        <div className="flex flex-col items-end gap-3">
          <button
            type="button"
            disabled
            className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Give feedback
          </button>
          <div className="flex items-center gap-2">
            <QuickAddMenu />
            <div className="flex overflow-hidden rounded-lg">
              <Button className="rounded-r-none" disabled title="No bank feed integration yet">
                Link account
              </Button>
              <Button className="rounded-l-none border-l border-l-white/20 px-2" disabled aria-label="More options">
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Account header row */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="relative" ref={accountMenuRef}>
          <button
            type="button"
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-lg font-semibold text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
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
      </div>

      {/* Account cards: three show at once, the rest scroll sideways. */}
      {showAccountCards && bankAccounts.length > 0 ? (
        <div className="mb-4 flex snap-x gap-4 overflow-x-auto pb-2 pt-5">
          {bankAccounts.map((a) => {
            const isSelected = a.id === selectedAccountId;
            const pending = pendingCountByAccount.get(a.id) ?? 0;
            const latest = latestDateByAccount.get(a.id);
            return (
              <div key={a.id} className="relative w-[calc((100%-2rem)/3)] min-w-[260px] shrink-0 snap-start">
                <span className="absolute -top-4 right-1 text-xs text-[var(--color-negative)]">{a.code}</span>
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
                  className={`cursor-pointer rounded-lg border bg-[var(--color-container-background-primary)] p-4 ${
                    isSelected ? "border-2 border-[var(--color-ui-primary)]" : "border-[var(--color-divider-tertiary)] hover:border-[var(--color-icon-secondary)]"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <span className="truncate text-sm text-[var(--color-text-primary)]">{a.name}</span>
                    <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-icon-secondary)] px-1.5 text-xs font-semibold text-white">
                      {formatTxnCount(pending)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xl font-semibold text-[var(--color-text-global)]">Bank: {formatMoney(0)}</p>
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
                  <div className="mt-2 flex items-center justify-between gap-3 text-sm text-[var(--color-text-primary)]">
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
      ) : null}

      {/* Tabs + secondary links */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-lg bg-[var(--color-container-background-accent)] p-1">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === value ? "bg-[var(--color-container-background-primary)] text-[var(--color-text-global)] shadow-sm" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
              }`}
            >
              {label} {tabCounts[value] ? `(${tabCounts[value]})` : ""}
            </button>
          ))}
        </div>
        <Link
          href={selectedAccountId ? `/register?accountId=${selectedAccountId}` : "/register"}
          className="text-sm font-medium text-[var(--color-link-action)] hover:underline"
        >
          Go to bank register
        </Link>
      </div>

      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            <InputField placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
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
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-primary)]">{filteredTxns.length ? `1-${filteredTxns.length} of ${filteredTxns.length}` : "0 of 0"}</span>
          <IconButton icon={Printer} label="Print" size="sm" />
          <IconButton icon={Share} label="Export" size="sm" />
          <IconButton icon={Settings} label="Settings" size="sm" />
        </div>
      </div>

      {showAddForm ? (
        <div ref={addFormRef} className="mb-3 rounded-lg border border-[var(--color-divider-tertiary)] p-4">
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

      {/* Table -- styled to match /register's table (tailwind-overrides.css
          .header-table/.content-table classes): primary-background header
          with a 2px bottom divider and 12px uppercase/semibold labels,
          13px body cells with dotted column dividers, row hover using the
          same --color-table-row-hover token. Kept as its own hand-rolled
          <table> rather than migrated to ui/table.tsx since /register
          itself (the style being matched here) predates and doesn't use
          that shared component either. */}
      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="w-10 px-2 pb-[5px] pt-2 text-left align-middle">
                <input type="checkbox" disabled />
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">
                <span className="inline-flex items-center gap-1">Date <ChevronDown className="h-3 w-3" aria-hidden="true" /></span>
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Bank description</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Spent</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Received</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">From/To</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Match/Categorize</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {!hydrated ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : filteredTxns.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-[var(--color-text-disabled)]">
                  No {tab.toLowerCase()} transactions.
                </td>
              </tr>
            ) : (
              filteredTxns.map((txn) => (
                <tr key={txn.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top">
                    <input type="checkbox" disabled />
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{txn.date}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{txn.description}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">{txn.spent ? formatMoney(txn.spent) : ""}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">{txn.received ? formatMoney(txn.received) : ""}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] w-44 p-2 align-top">
                    {tab === "PENDING" ? (
                      <Select
                        value={txn.payee ?? ""}
                        onChange={(value) => update(txn.id, { payee: value || undefined })}
                        options={vendorOptions}
                        placeholder="Select vendor"
                        allowCustomValue
                        onAddNew={() => {
                          const name = txn.payee?.trim();
                          if (!name) return;
                          if (vendors.some((v) => v.name.toLowerCase() === name.toLowerCase())) return;
                          addVendor({ name })
                            .then(() => toast({ variant: "success", title: `"${name}" added to Vendors` }))
                            .catch((err) => toast({ variant: "error", title: "Could not add vendor", description: err instanceof Error ? err.message : undefined }));
                        }}
                        addNewLabel="+ Add new"
                        optionSize="sm"
                      />
                    ) : (
                      <span className="text-[13px] text-[var(--color-text-primary)]">{txn.payee || "--"}</span>
                    )}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] w-52 p-2 align-top">
                    {tab === "PENDING" ? (
                      <div className="flex items-center gap-1.5">
                        {!txn.categoryAccountId ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning-text)]" aria-hidden="true" /> : null}
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
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                    {tab === "PENDING" ? (
                      <PendingRowActions
                        txn={txn}
                        onPost={() => handlePost(txn)}
                        onExclude={() => handleExclude(txn)}
                      />
                    ) : txn.isLocal ? (
                      <button type="button" onClick={() => remove(txn.id)} className="text-sm font-medium text-[var(--color-negative)] hover:underline">
                        Delete
                      </button>
                    ) : (
                      <span className="text-xs text-[var(--color-icon-secondary)]">Posted</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
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
// matching the reference. Split has no real implementation yet (this app
// has no multi-category-per-posting UI) -- shown disabled rather than
// silently doing nothing. Create rule links to the real Bank Rules
// feature; Exclude is real (flips this row's local status).
function PendingRowActions({ onPost, onExclude }: { txn: DisplayRow; onPost: () => void; onExclude: () => void }) {
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
            disabled
            title="Splitting one transaction across multiple categories isn't available yet"
            className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-sm text-[var(--color-text-disabled)]"
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
