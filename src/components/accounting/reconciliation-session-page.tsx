"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Filter, Printer, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import {
  finishReconciliation,
  getReconciliationDraft,
  getReconciliationSetup,
  ReconciliationOutOfBalanceError,
  saveReconciliationDraft
} from "@/lib/services/reconciliation-service";
import { isCreditNormalCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import type { Account, RegisterEntry } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type EntryTab = "payments" | "deposits" | "all";

// The register's "payment" column is the CREDIT side and "deposit" the
// DEBIT side. For a bank account those read as payments/deposits, but for
// a credit card or liability the credit side is a charge that raises the
// balance and the debit side a payment that lowers it.
function tabLabel(tab: EntryTab, creditNormal: boolean): string {
  if (tab === "all") return "All";
  if (tab === "payments") return creditNormal ? "Charges" : "Payments";
  return creditNormal ? "Payments" : "Deposits";
}

type Statement = {
  startDate: string;
  endingDate: string;
  endingBalance: number;
  serviceCharge: { amount: number; date: string; expenseAccountId: string } | null;
  interestEarned: { amount: number; date: string; incomeAccountId: string } | null;
};

type DateMode = "statement" | "custom" | "all";
type Filters = { find: string; cleared: "" | "cleared" | "notCleared"; type: string; payee: string; dateMode: DateMode; from: string; to: string };

// QBO opens with the list narrowed to the statement ending date; "Clear
// filter / View all" widens it to everything.
const DEFAULT_FILTERS: Filters = { find: "", cleared: "", type: "", payee: "", dateMode: "statement", from: "", to: "" };
const VIEW_ALL_FILTERS: Filters = { ...DEFAULT_FILTERS, dateMode: "all" };

type OptionalColumn = "clearedDate" | "type" | "ref" | "account" | "payee" | "memo";
const OPTIONAL_COLUMNS: Array<{ key: OptionalColumn; label: string }> = [
  { key: "clearedDate", label: "Cleared date" },
  { key: "type", label: "Type" },
  { key: "ref", label: "Ref No." },
  { key: "account", label: "Account" },
  { key: "payee", label: "Payee" },
  { key: "memo", label: "Memo" }
];
const COLUMNS_STORAGE_KEY = "newgl:reconcile:columns";
const ALL_COLUMNS = new Set<OptionalColumn>(OPTIONAL_COLUMNS.map((column) => column.key));

function prettifyType(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function amountOf(entry: RegisterEntry): number {
  return entry.payment ?? entry.deposit ?? 0;
}

/** "memo text", "100", "$100", ">$100", "<$100" -- the same Find syntax QBO documents. */
function matchesFind(entry: RegisterEntry, find: string): boolean {
  const query = find.trim();
  if (!query) return true;
  const amountMatch = /^([<>]?)\s*\$?\s*([\d,]+(?:\.\d+)?)$/.exec(query);
  if (amountMatch) {
    const target = Number(amountMatch[2].replace(/,/g, ""));
    const amount = amountOf(entry);
    if (amountMatch[1] === ">") return amount > target;
    if (amountMatch[1] === "<") return amount < target;
    return Math.abs(amount - target) < 0.005;
  }
  const haystack = [entry.memo, entry.refNumber, entry.payee, entry.accountLabel].filter(Boolean).join(" ").toLowerCase();
  return haystack.includes(query.toLowerCase());
}

/**
 * The real matching workspace, reached from the setup form in
 * reconcile-page.tsx (a new session via the URL, or "Resume reconciling"
 * from a saved draft). Checking a transaction never calls the API -- it
 * only updates local state and the live math bar. Writes are: "Save for
 * later" (a draft), and "Finish now", which attempts the finish and, if
 * the difference isn't $0.00, offers QBO's own "Add adjustment and
 * finish" retry rather than just blocking.
 */
export function ReconciliationSessionPage({ accountId }: { accountId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);

  const [statement, setStatement] = useState<Statement | null>(() => {
    const endingDate = searchParams.get("statementEndingDate");
    if (!endingDate) return null; // resuming a saved draft
    const serviceChargeAmount = searchParams.get("serviceChargeAmount");
    const serviceChargeDate = searchParams.get("serviceChargeDate");
    const serviceChargeExpenseAccountId = searchParams.get("serviceChargeExpenseAccountId");
    const interestEarnedAmount = searchParams.get("interestEarnedAmount");
    const interestEarnedDate = searchParams.get("interestEarnedDate");
    const interestEarnedIncomeAccountId = searchParams.get("interestEarnedIncomeAccountId");
    return {
      startDate: searchParams.get("statementStartDate") ?? "",
      endingDate,
      endingBalance: Number(searchParams.get("statementEndingBalance") ?? "0"),
      serviceCharge:
        serviceChargeAmount && serviceChargeDate && serviceChargeExpenseAccountId
          ? { amount: Number(serviceChargeAmount), date: serviceChargeDate, expenseAccountId: serviceChargeExpenseAccountId }
          : null,
      interestEarned:
        interestEarnedAmount && interestEarnedDate && interestEarnedIncomeAccountId
          ? { amount: Number(interestEarnedAmount), date: interestEarnedDate, incomeAccountId: interestEarnedIncomeAccountId }
          : null
    };
  });
  const startedFromUrl = statement !== null;

  const [account, setAccount] = useState<Account | null>(null);
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [beginningBalance, setBeginningBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingCleared, setPendingCleared] = useState<Set<string>>(new Set());

  const [tab, setTab] = useState<EntryTab>("all");
  const [sortDescending, setSortDescending] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<OptionalColumn>>(ALL_COLUMNS);

  const [showDifferenceTip, setShowDifferenceTip] = useState(false);
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [editBalance, setEditBalance] = useState("");
  const [editDate, setEditDate] = useState("");
  const [outOfBalanceDifference, setOutOfBalanceDifference] = useState<number | null>(null);
  const [adjustmentDate, setAdjustmentDate] = useState("");
  const [finishedReconciliationId, setFinishedReconciliationId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (stored) setVisibleColumns(new Set((JSON.parse(stored) as OptionalColumn[]).filter((key) => ALL_COLUMNS.has(key))));
    } catch {
      // Storage unavailable or corrupt: keep every column.
    }
  }, []);

  function toggleColumn(key: OptionalColumn) {
    setVisibleColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // Not persisted; still applies for this visit.
      }
      return next;
    });
  }

  // Already-reconciled (R) transactions are part of the beginning balance;
  // listing them here would count them a second time.
  const loadEntries = useCallback(async (): Promise<RegisterEntry[]> => {
    const all = await services.registerService.listRegisterEntries(accountId);
    return all.filter((entry) => entry.status === "POSTED" && entry.reconcileStatus !== "R");
  }, [accountId, services]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [loadedAccount, loadedEntries, setup, draft] = await Promise.all([
          services.accountService.getAccountById(accountId),
          loadEntries(),
          getReconciliationSetup(accountId),
          startedFromUrl ? Promise.resolve(null) : getReconciliationDraft(accountId)
        ]);
        if (cancelled) return;

        let effective = statement;
        if (!effective) {
          if (!draft) {
            toast({ variant: "error", title: "There's no saved reconciliation to resume for this account" });
            router.replace("/all-apps/reconcile");
            return;
          }
          effective = {
            startDate: draft.statementStartDate,
            endingDate: draft.statementEndingDate,
            endingBalance: draft.statementEndingBalance,
            serviceCharge: draft.serviceCharge,
            interestEarned: draft.interestEarned
          };
          setStatement(effective);
        }
        const available = new Set(loadedEntries.filter((entry) => entry.date <= effective.endingDate).map((entry) => entry.transactionId));
        const seeded = draft
          ? draft.clearedTransactionIds.filter((id) => available.has(id))
          : loadedEntries.filter((entry) => entry.reconcileStatus === "C" && available.has(entry.transactionId)).map((entry) => entry.transactionId);

        setAccount(loadedAccount);
        setEntries(loadedEntries);
        setBeginningBalance(setup.beginningBalance);
        setPendingCleared(new Set(seeded));
        setAdjustmentDate(effective.endingDate);
        setLoaded(true);
      } catch {
        if (!cancelled) toast({ variant: "error", title: "Couldn't load this account's register" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // The statement is only read to seed state on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, services]);

  // Coming back from the register after adding/fixing a transaction there:
  // pick up the changes without losing what's already checked.
  useEffect(() => {
    if (!loaded) return;
    async function refreshOnFocus() {
      try {
        const fresh = await loadEntries();
        setEntries(fresh);
        const existing = new Set(fresh.map((entry) => entry.transactionId));
        setPendingCleared((current) => new Set([...current].filter((id) => existing.has(id))));
      } catch {
        // Keep what's on screen.
      }
    }
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [loaded, loadEntries]);

  const endingDate = statement?.endingDate ?? "";
  const creditNormal = account ? isCreditNormalCategory(account.category) : false;
  const selectable = useCallback((entry: RegisterEntry) => entry.date <= endingDate, [endingDate]);

  const typeOptions = useMemo(
    () => [{ value: "", label: "All" }, ...[...new Set(entries.map((entry) => entry.transactionType))].sort().map((type) => ({ value: type, label: prettifyType(type) }))],
    [entries]
  );
  const payeeOptions = useMemo(
    () => [{ value: "", label: "All" }, ...[...new Set(entries.map((entry) => entry.payee).filter((payee): payee is string => Boolean(payee)))].sort().map((payee) => ({ value: payee, label: payee }))],
    [entries]
  );

  const visibleEntries = useMemo(() => {
    const filtered = entries.filter((entry) => {
      if (tab === "payments" && !((entry.payment ?? 0) > 0)) return false;
      if (tab === "deposits" && !((entry.deposit ?? 0) > 0)) return false;
      if (filters.dateMode === "statement" && entry.date > endingDate) return false;
      if (filters.dateMode === "custom") {
        if (filters.from && entry.date < filters.from) return false;
        if (filters.to && entry.date > filters.to) return false;
      }
      if (filters.cleared === "cleared" && !pendingCleared.has(entry.transactionId)) return false;
      if (filters.cleared === "notCleared" && pendingCleared.has(entry.transactionId)) return false;
      if (filters.type && entry.transactionType !== filters.type) return false;
      if (filters.payee && entry.payee !== filters.payee) return false;
      return matchesFind(entry, filters.find);
    });
    return filtered.sort((a, b) => (sortDescending ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [entries, tab, filters, endingDate, pendingCleared, sortDescending]);

  const { paymentsTotal, depositsTotal } = useMemo(() => {
    let payments = 0;
    let deposits = 0;
    for (const entry of entries) {
      if (!pendingCleared.has(entry.transactionId)) continue;
      payments += entry.payment ?? 0;
      deposits += entry.deposit ?? 0;
    }
    return { paymentsTotal: payments, depositsTotal: deposits };
  }, [entries, pendingCleared]);

  // Natural-balance math, the same terms the statement uses: whatever
  // raises the account's balance is added, whatever lowers it subtracted.
  const decreasesTotal = creditNormal ? depositsTotal : paymentsTotal;
  const increasesTotal = creditNormal ? paymentsTotal : depositsTotal;
  const increasesLabel = creditNormal ? "Charges" : "Deposits";
  const clearedBalance = beginningBalance - decreasesTotal + increasesTotal;
  const statementEndingBalance = statement?.endingBalance ?? 0;
  const difference = statementEndingBalance - clearedBalance;
  const isBalanced = Math.abs(difference) < 0.005;

  const selectableVisible = visibleEntries.filter(selectable);
  const allVisibleChecked = selectableVisible.length > 0 && selectableVisible.every((entry) => pendingCleared.has(entry.transactionId));
  const someVisibleChecked = selectableVisible.some((entry) => pendingCleared.has(entry.transactionId));

  const activeFilterChips: string[] = [];
  if (filters.dateMode === "statement") activeFilterChips.push("Statement ending date");
  if (filters.dateMode === "custom") activeFilterChips.push(`Date ${filters.from || "…"} – ${filters.to || "…"}`);
  if (filters.find.trim()) activeFilterChips.push(`Find: ${filters.find.trim()}`);
  if (filters.cleared) activeFilterChips.push(filters.cleared === "cleared" ? "Cleared" : "Not cleared");
  if (filters.type) activeFilterChips.push(prettifyType(filters.type));
  if (filters.payee) activeFilterChips.push(filters.payee);

  function toggleEntry(entry: RegisterEntry) {
    if (!selectable(entry)) return;
    setPendingCleared((current) => {
      const next = new Set(current);
      if (next.has(entry.transactionId)) next.delete(entry.transactionId);
      else next.add(entry.transactionId);
      return next;
    });
  }

  function toggleAllVisible() {
    setPendingCleared((current) => {
      const next = new Set(current);
      for (const entry of selectableVisible) {
        if (allVisibleChecked) next.delete(entry.transactionId);
        else next.add(entry.transactionId);
      }
      return next;
    });
  }

  function openEditInfo() {
    if (!statement) return;
    setEditBalance(String(statement.endingBalance));
    setEditDate(statement.endingDate);
    setEditInfoOpen(true);
  }

  function saveEditInfo() {
    if (!statement || editBalance.trim() === "" || !editDate) return;
    setStatement({ ...statement, endingBalance: Number(editBalance), endingDate: editDate });
    // Items dated after the new statement date can't be part of it.
    setPendingCleared((current) => {
      const allowed = new Set(entries.filter((entry) => entry.date <= editDate).map((entry) => entry.transactionId));
      return new Set([...current].filter((id) => allowed.has(id)));
    });
    setAdjustmentDate(editDate);
    setEditInfoOpen(false);
  }

  function buildFinishInput(discrepancyAdjustmentDate?: string) {
    return {
      statementStartDate: statement!.startDate,
      statementEndingDate: statement!.endingDate,
      statementEndingBalance: statement!.endingBalance,
      clearedTransactionIds: [...pendingCleared],
      ...(statement!.serviceCharge ? { serviceCharge: statement!.serviceCharge } : {}),
      ...(statement!.interestEarned ? { interestEarned: statement!.interestEarned } : {}),
      ...(discrepancyAdjustmentDate ? { discrepancyAdjustmentDate } : {})
    };
  }

  async function handleFinish() {
    if (busy || !statement) return;
    setBusy(true);
    try {
      const finished = await finishReconciliation(accountId, buildFinishInput());
      setFinishedReconciliationId(finished.id);
    } catch (error) {
      if (error instanceof ReconciliationOutOfBalanceError) {
        setOutOfBalanceDifference(error.difference);
      } else {
        toast({ variant: "error", title: error instanceof Error ? error.message : "Couldn't finish this reconciliation" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAdjustmentAndFinish() {
    if (busy || !adjustmentDate) return;
    setBusy(true);
    try {
      const finished = await finishReconciliation(accountId, buildFinishInput(adjustmentDate));
      setOutOfBalanceDifference(null);
      setFinishedReconciliationId(finished.id);
    } catch (error) {
      toast({ variant: "error", title: error instanceof Error ? error.message : "Couldn't finish this reconciliation" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveForLater() {
    if (busy || !statement) return;
    setBusy(true);
    try {
      await saveReconciliationDraft(accountId, {
        statementStartDate: statement.startDate,
        statementEndingDate: statement.endingDate,
        statementEndingBalance: statement.endingBalance,
        serviceCharge: statement.serviceCharge,
        interestEarned: statement.interestEarned,
        clearedTransactionIds: [...pendingCleared]
      });
      toast({ variant: "success", title: "Saved. Pick up where you left off with Resume reconciling." });
      router.push("/all-apps/reconcile");
    } catch (error) {
      toast({ variant: "error", title: error instanceof Error ? error.message : "Couldn't save this reconciliation" });
    } finally {
      setBusy(false);
    }
  }

  if (loading || !account || !statement) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  const paymentColumnLabel = creditNormal ? "Charge" : "Payment";
  const depositColumnLabel = creditNormal ? "Payment" : "Deposit";
  const registerLink = `/register?account=${accountId}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">{account.name}</h1>
          <p className="text-sm text-[var(--color-text-primary)]">Statement ending date: {statement.endingDate}</p>
        </div>
        <div className="flex items-center gap-2 no-print">
          <Button variant="secondary" onClick={openEditInfo}>
            Edit info
          </Button>
          <div className="flex">
            <Button variant="secondary" onClick={handleSaveForLater} disabled={busy} className="rounded-r-none">
              Save for later
            </Button>
            <DropdownMenu
              trigger={(triggerProps) => (
                <Button variant="secondary" aria-label="More reconcile actions" {...triggerProps} className="-ml-px rounded-l-none px-2">
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
              items={[
                { label: "Finish now", onSelect: handleFinish, disabled: busy },
                { label: "Save for later", onSelect: handleSaveForLater, disabled: busy },
                { label: "Close without saving", onSelect: () => router.push("/all-apps/reconcile") }
              ]}
            />
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-8 rounded-lg border border-[var(--color-divider-tertiary)] p-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xl font-semibold text-[var(--color-text-global)]">{formatMoney(statementEndingBalance)}</p>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Statement ending balance</p>
          </div>
          <span className="text-[var(--color-text-primary)]">-</span>
          <div>
            <p className="text-xl font-semibold text-[var(--color-text-global)]">{formatMoney(clearedBalance)}</p>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Cleared balance</p>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-[var(--color-divider-tertiary)] pl-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Beginning balance</p>
            <p className="text-sm text-[var(--color-text-global)]">{formatMoney(beginningBalance)}</p>
          </div>
          <span className="text-[var(--color-text-primary)]">-</span>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Payments</p>
            <p className="text-sm text-[var(--color-text-global)]">{formatMoney(decreasesTotal)}</p>
          </div>
          <span className="text-[var(--color-text-primary)]">+</span>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">{increasesLabel}</p>
            <p className="text-sm text-[var(--color-text-global)]">{formatMoney(increasesTotal)}</p>
          </div>
        </div>

        <div className="relative ml-auto border-l border-[var(--color-divider-tertiary)] pl-8">
          <button type="button" onClick={() => setShowDifferenceTip((current) => !current)} className="flex items-center gap-2 rounded text-left" aria-expanded={showDifferenceTip}>
            {!isBalanced ? <AlertTriangle className="h-5 w-5 text-[var(--color-warning-text)]" aria-hidden="true" /> : null}
            <div>
              <p className={`text-xl font-semibold ${isBalanced ? "text-[var(--color-positive)]" : "text-[var(--color-text-global)]"}`}>{formatMoney(difference)}</p>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)] underline decoration-dotted">Difference</p>
            </div>
          </button>
          {showDifferenceTip ? (
            <div className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg bg-[var(--color-text-global)] p-4 text-sm text-[var(--color-container-background-primary)] shadow-lg">
              <button type="button" onClick={() => setShowDifferenceTip(false)} className="absolute right-2 top-2 text-[var(--color-container-background-primary)]/70 hover:text-[var(--color-container-background-primary)]" aria-label="Close">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
              {isBalanced ? (
                <p>Your selected transactions match your statement. You&apos;re ready to finish.</p>
              ) : (
                <p>Your selected transactions don&apos;t match your statement yet. When they match, you&apos;ll have a difference of $0.00.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex gap-1 rounded-lg bg-[var(--color-container-background-secondary)] p-1">
          {(["payments", "deposits", "all"] as EntryTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                tab === t ? "bg-[var(--color-container-background-primary)] text-[var(--color-text-global)] shadow-sm" : "text-[var(--color-text-primary)]"
              }`}
            >
              {tabLabel(t, creditNormal)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href={registerLink} target="_blank" className="text-sm text-[var(--color-link-action)] hover:underline">
            Add or fix a transaction in the register
          </Link>
          <IconButton icon={Printer} label="Print this list" variant="outline" onClick={() => window.print()} />
          <div className="relative">
            <IconButton icon={Settings} label="Choose columns" variant="outline" onClick={() => setColumnsOpen((open) => !open)} />
            {columnsOpen ? (
              <div className="absolute right-0 z-30 mt-1 w-48 rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-3 shadow-md">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">Columns</p>
                <div className="flex flex-col gap-2">
                  {OPTIONAL_COLUMNS.map((column) => (
                    <label key={column.key} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                      <Checkbox checked={visibleColumns.has(column.key)} onChange={() => toggleColumn(column.key)} />
                      {column.label}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative mb-3 flex flex-wrap items-center gap-3 no-print">
        <IconButton
          icon={Filter}
          label="Filter transactions"
          variant="outline"
          onClick={() => {
            setDraftFilters(filters);
            setFilterOpen((open) => !open);
          }}
        />
        {activeFilterChips.map((chip) => (
          <span key={chip} className="rounded-full border border-[var(--color-divider-tertiary)] px-3 py-1 text-xs text-[var(--color-text-primary)]">
            {chip}
          </span>
        ))}
        {activeFilterChips.length > 0 ? (
          <button type="button" onClick={() => setFilters(VIEW_ALL_FILTERS)} className="text-sm text-[var(--color-link-action)] hover:underline">
            Clear filter / View all
          </button>
        ) : null}

        {filterOpen ? (
          <div className="absolute left-0 top-full z-30 mt-2 w-[min(46rem,92vw)] rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5 shadow-lg">
            <div className="mb-4 flex justify-end">
              <button type="button" aria-label="Close filter" onClick={() => setFilterOpen(false)} className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mb-4">
              <InputField label="Find" placeholder="Memo, Ref. no, $amt, >$amt, <$amt" value={draftFilters.find} onChange={(e) => setDraftFilters({ ...draftFilters, find: e.target.value })} />
            </div>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select
                label="Cleared status"
                value={draftFilters.cleared}
                onChange={(value) => setDraftFilters({ ...draftFilters, cleared: value as Filters["cleared"] })}
                options={[
                  { value: "", label: "All" },
                  { value: "cleared", label: "Cleared" },
                  { value: "notCleared", label: "Not cleared" }
                ]}
                placeholder="All"
                allowCustomValue={false}
                showCheckmark
              />
              <Select label="Transaction type" value={draftFilters.type} onChange={(value) => setDraftFilters({ ...draftFilters, type: value })} options={typeOptions} placeholder="All" allowCustomValue={false} showCheckmark />
              <Select label="Payee" value={draftFilters.payee} onChange={(value) => setDraftFilters({ ...draftFilters, payee: value })} options={payeeOptions} placeholder="All" allowCustomValue={false} showCheckmark />
            </div>
            <div className="mb-5 grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
              <Select
                label="Date"
                value={draftFilters.dateMode}
                onChange={(value) => setDraftFilters({ ...draftFilters, dateMode: value as DateMode })}
                options={[
                  { value: "statement", label: "Statement ending date" },
                  { value: "custom", label: "Custom date" },
                  { value: "all", label: "All" }
                ]}
                placeholder="All"
                allowCustomValue={false}
                showCheckmark
              />
              <InputField label="From" type="date" disabled={draftFilters.dateMode !== "custom"} value={draftFilters.from} onChange={(e) => setDraftFilters({ ...draftFilters, from: e.target.value })} />
              <InputField label="To" type="date" disabled={draftFilters.dateMode !== "custom"} value={draftFilters.to} onChange={(e) => setDraftFilters({ ...draftFilters, to: e.target.value })} />
            </div>
            <div className="flex justify-between">
              <Button
                variant="secondary"
                onClick={() => {
                  setDraftFilters(DEFAULT_FILTERS);
                  setFilters(DEFAULT_FILTERS);
                  setFilterOpen(false);
                }}
              >
                Reset
              </Button>
              <Button
                onClick={() => {
                  setFilters(draftFilters);
                  setFilterOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="tw-override report-print-card overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">
                <button type="button" onClick={() => setSortDescending((descending) => !descending)} className="inline-flex items-center gap-1 uppercase" aria-label="Sort by date">
                  Date
                  {sortDescending ? <ArrowDown className="h-3 w-3" aria-hidden="true" /> : <ArrowUp className="h-3 w-3" aria-hidden="true" />}
                </button>
              </th>
              {visibleColumns.has("clearedDate") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Cleared date</th> : null}
              {visibleColumns.has("type") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Type</th> : null}
              {visibleColumns.has("ref") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Ref No.</th> : null}
              {visibleColumns.has("account") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Account</th> : null}
              {visibleColumns.has("payee") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Payee</th> : null}
              {visibleColumns.has("memo") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Memo</th> : null}
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">{paymentColumnLabel}</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">{depositColumnLabel}</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-center align-middle">
                <Checkbox checked={allVisibleChecked} indeterminate={!allVisibleChecked && someVisibleChecked} onChange={toggleAllVisible} aria-label="Mark all visible as cleared" disabled={selectableVisible.length === 0} />
              </th>
            </tr>
          </thead>
          <tbody className="content-table">
            {visibleEntries.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-sm text-[var(--color-text-primary)]">
                  There are no transactions showing for this account in this time period. If you&apos;re filtering transactions, they may be hiding.
                </td>
              </tr>
            ) : (
              visibleEntries.map((entry) => {
                const checked = pendingCleared.has(entry.transactionId);
                const canCheck = selectable(entry);
                const cell = "border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]";
                return (
                  <tr key={entry.id} className={`border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)] ${canCheck ? "" : "opacity-60"}`}>
                    <td className="p-2 align-top text-[13px] text-[var(--color-text-primary)]">
                      <Link href={`${registerLink}&tx=${entry.transactionId}`} target="_blank" className="hover:text-[var(--color-link-action)] hover:underline" title="Open this transaction in the register">
                        {entry.date}
                      </Link>
                    </td>
                    {visibleColumns.has("clearedDate") ? <td className={`${cell} text-[var(--color-text-primary)]`}>{checked ? endingDate : ""}</td> : null}
                    {visibleColumns.has("type") ? <td className={`${cell} text-[var(--color-text-primary)]`}>{prettifyType(entry.transactionType)}</td> : null}
                    {visibleColumns.has("ref") ? <td className={`${cell} text-[var(--color-text-primary)]`}>{entry.refNumber ?? ""}</td> : null}
                    {visibleColumns.has("account") ? <td className={`${cell} text-[var(--color-text-primary)]`}>{entry.accountLabel ?? ""}</td> : null}
                    {visibleColumns.has("payee") ? <td className={`${cell} text-[var(--color-text-global)]`}>{entry.payee ?? ""}</td> : null}
                    {visibleColumns.has("memo") ? <td className={`${cell} text-[var(--color-text-primary)]`}>{entry.memo ?? ""}</td> : null}
                    <td className={`${cell} text-right text-[var(--color-text-global)]`}>{entry.payment ? formatMoney(entry.payment) : ""}</td>
                    <td className={`${cell} text-right text-[var(--color-text-global)]`}>{entry.deposit ? formatMoney(entry.deposit) : ""}</td>
                    <td className={`${cell} text-center`}>
                      <Checkbox
                        checked={checked}
                        disabled={!canCheck}
                        onChange={() => toggleEntry(entry)}
                        aria-label="Cleared"
                        title={canCheck ? undefined : "Dated after the statement ending date"}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Modal open={editInfoOpen} onClose={() => setEditInfoOpen(false)} title="Edit the information from your statement*" size="md">
        <div className="mb-6 flex flex-wrap items-start gap-6">
          <div className="w-40">
            <p className="mb-1 text-sm font-semibold text-[var(--color-text-global)]">Beginning balance</p>
            <p className="flex h-9 items-center text-sm text-[var(--color-text-primary)]">{formatMoney(beginningBalance)}</p>
          </div>
          <div className="w-52">
            <NumberField label="Statement ending balance" currency placeholder="0.00" value={editBalance} onChange={(e) => setEditBalance(e.target.value)} />
          </div>
          <div className="w-52">
            <InputField label="Statement ending date" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => setEditInfoOpen(false)}>
            Cancel
          </Button>
          <Button onClick={saveEditInfo} disabled={editBalance.trim() === "" || !editDate}>
            Save
          </Button>
        </div>
      </Modal>

      <Modal open={outOfBalanceDifference !== null} onClose={() => setOutOfBalanceDifference(null)} title="Hold on! Your difference isn't $0.00 yet." size="sm">
        <p className="mb-4 text-sm text-[var(--color-text-primary)]">
          You aren&apos;t ready to reconcile yet because your selected transactions don&apos;t match your statement. When they match, you&apos;ll have a difference of $0.00.
        </p>
        <p className="mb-4 text-sm text-[var(--color-text-primary)]">
          If you&apos;d still like to proceed, confirm the adjustment date below and click <span className="font-medium text-[var(--color-text-global)]">Add adjustment and finish</span>. This
          posts a {formatMoney(Math.abs(outOfBalanceDifference ?? 0))} entry to Reconciliation Discrepancies to close the gap.
        </p>
        <div className="mb-6 w-48">
          <InputField label="Adjustment date*" type="date" value={adjustmentDate} onChange={(e) => setAdjustmentDate(e.target.value)} />
        </div>
        <div className="flex justify-between">
          <Button onClick={handleAddAdjustmentAndFinish} disabled={busy || !adjustmentDate}>
            {busy ? "Finishing…" : "Add adjustment and finish"}
          </Button>
          <Button variant="secondary" onClick={() => setOutOfBalanceDifference(null)}>
            Go back
          </Button>
        </div>
      </Modal>

      <Modal open={finishedReconciliationId !== null} onClose={() => router.push("/all-apps/reconcile")} title="You reconciled this account" size="sm">
        <p className="mb-6 text-sm text-[var(--color-text-primary)]">
          To see a report of this reconciliation, click{" "}
          {finishedReconciliationId ? (
            <Link href={`/all-apps/reconcile/report/${finishedReconciliationId}`} className="text-[var(--color-link-action)] hover:underline">
              View reconciliation report
            </Link>
          ) : null}
          . Otherwise, you&apos;re done!
        </p>
        <div className="flex justify-end">
          <Button onClick={() => router.push("/all-apps/reconcile")}>Done</Button>
        </div>
      </Modal>
    </>
  );
}
