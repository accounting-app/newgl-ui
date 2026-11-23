"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AccountSelector } from "@/components/bank-register/account-selector";
import { RegisterTable } from "@/components/bank-register/register-table";
import { getRegisterTitle } from "@/components/bank-register/register-title";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { ImportModal } from "@/components/csv-import/import-modal";
import { RegisterHeaderActions } from "@/components/bank-register/register-header-actions";
import { JournalEntryModal } from "@/components/bank-register/journal-entry-modal";
import { ACCOUNT_CATEGORY_LABELS, DEFAULT_TOP_HEADER_USER_NAME } from "@/constants/ui";
import { loadCsvImportSession } from "@/modules/accounting/domain/csv-import-session";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import { useBankRegister } from "@hooks/use-bank-register";
import { Maximize, SquareArrowOutUpRight } from "lucide-react";
import { getReconciliationSetup } from "@/lib/services/reconciliation-service";

export function BankRegisterLayout() {
  return (
    <Suspense fallback={null}>
      <BankRegisterLayoutInner />
    </Suspense>
  );
}

function BankRegisterLayoutInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const {
    accounts,
    availableTransactionTypes,
    entries,
    generalBalance,
    selectedAccountId,
    selectedAccount,
    selectedTransactionType,
    draftErrors,
    draftTransaction,
    error,
    isSavingDraft,
    setSelectedAccountId,
    addSelectedTransaction,
    cancelDraftTransaction,
    cycleDraftReconcileStatus,
    cycleReconcileStatus,
    deleteRegisterEntryInline,
    batchUpdateRegisterEntries,
    batchDeleteRegisterEntries,
    selectTransactionType,
    saveDraftTransaction,
    updateRegisterEntryInline,
    updateDraftField,
    importTransactions,
    createJournalEntry,
    createAccount,
    isSplitMode,
    draftSplits,
    toggleSplitMode,
    addDraftSplitLine,
    removeDraftSplitLine,
    updateDraftSplitLine,
  } = useBankRegister();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isJournalEntryModalOpen, setIsJournalEntryModalOpen] = useState(false);
  const [isSavingJournalEntry, setIsSavingJournalEntry] = useState(false);
  const [savedImportRowCount, setSavedImportRowCount] = useState(0);
  // "Reconciled through <date>" + "Show Unreconciled Only", as in RT's register header.
  const [reconciledThrough, setReconciledThrough] = useState<string | null>(null);
  const [unreconciledOnly, setUnreconciledOnly] = useState(false);

  useEffect(() => {
    setUnreconciledOnly(false);
    if (!selectedAccountId) {
      setReconciledThrough(null);
      return;
    }
    let cancelled = false;
    getReconciliationSetup(selectedAccountId)
      .then((setup) => {
        if (!cancelled) setReconciledThrough(setup.lastStatementEndingDate ?? null);
      })
      .catch(() => {
        if (!cancelled) setReconciledThrough(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedAccountId]);

  const visibleEntries = useMemo(
    () => (unreconciledOnly ? entries.filter((entry) => entry.reconcileStatus !== "R") : entries),
    [entries, unreconciledOnly]
  );
  const reconciledThroughLabel = reconciledThrough
    ? `${reconciledThrough.slice(5, 7)}/${reconciledThrough.slice(8, 10)}/${reconciledThrough.slice(0, 4)}`
    : null;

  useEffect(() => {
    if (!selectedAccountId) {
      setSavedImportRowCount(0);
      return;
    }
    setSavedImportRowCount(loadCsvImportSession(selectedAccountId)?.rows.length ?? 0);
  }, [selectedAccountId]);

  // Deep-link from the Chart of Accounts page ("View register" per account):
  // /register?accountId=<id>, the same shape as QBO's app/register?accountId=.
  // The older ?account=<id> is still accepted as an alias. Applied once
  // accounts have loaded and the id is real -- gated on a ref (not just the
  // URL) so a later account refresh (e.g. after saving a transaction) can't
  // re-fire this and silently override an account the user has since
  // switched to in the dropdown.
  const appliedAccountParamRef = useRef(false);
  useEffect(() => {
    if (appliedAccountParamRef.current || accounts.length === 0) return;
    const accountParam = searchParams.get("accountId") ?? searchParams.get("account");
    if (accountParam && accounts.some((a) => a.id === accountParam)) {
      setSelectedAccountId(accountParam);
    }
    appliedAccountParamRef.current = true;
  }, [searchParams, accounts, setSelectedAccountId]);

  // Keep ?accountId= equal to the account on screen (QBO's register does the
  // same), so the page can be reloaded, bookmarked or shared. Other params
  // (e.g. a ?tx= deep link) are preserved. Skipped while a different, valid
  // ?accountId= is still waiting to be applied above.
  useEffect(() => {
    if (!selectedAccountId || !appliedAccountParamRef.current) return;
    const current = searchParams.get("accountId");
    if (current === selectedAccountId) return;
    if (current && accounts.some((a) => a.id === current)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("account");
    params.set("accountId", selectedAccountId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [selectedAccountId, searchParams, accounts, pathname, router]);

  function handleAccountChange(accountId: string) {
    setSelectedAccountId(accountId);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("account");
    params.delete("tx");
    params.set("accountId", accountId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const registerTitle = getRegisterTitle(selectedAccount);

  // Top selector: only balance-sheet accounts that actually have a register.
  const registerAccounts = useMemo(
    () => accounts.filter((account) => isRegisterAccountCategory(account.category)),
    [accounts]
  );

  // Form offset/category field: the full chart of accounts. The working account is
  // included (as in QuickBooks), but self-offset is blocked on save so a transaction
  // never posts both sides to the same account (double-entry needs two accounts).
  const accountOptions = useMemo<SelectFieldOption[]>(
    () =>
      accounts.map((account) => ({
        value: account.id,
        label: account.name,
        rightLabel: ACCOUNT_CATEGORY_LABELS[account.category],
        keywords: [ACCOUNT_CATEGORY_LABELS[account.category]]
      })),
    [accounts]
  );

  return (
    <main className="tw-override main bg-[var(--color-container-background-primary)] text-sm text-[var(--color-text-primary)]">
      <header className="px-[30px] pb-3 pt-4">
        {/* The register has no entry point of its own (QBO has none either):
            it's reached from Bank transactions' "Go to bank register" or
            Chart of accounts' "View register", and this path -- plus "Back To
            Banking" -- is how you retrace that route. */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[#555756]">
            <Link href="/all-apps/bank-transactions" className="hover:text-[var(--color-link-action)] hover:underline">
              Accounting
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/all-apps/chart-of-accounts" className="hover:text-[var(--color-link-action)] hover:underline">
              Chart of accounts
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{registerTitle}</span>
            <Link href="/all-apps/bank-transactions" className="ml-3 text-[var(--color-link-text)] hover:underline">
              &lt; Back To Banking
            </Link>
          </nav>
          <div className="flex items-center gap-4 text-[#505252]">
            <button type="button" aria-label="Open in a new window" title="Open in a new window" onClick={() => window.open(window.location.href, "_blank")} className="hover:text-[var(--color-text-global)]">
              <SquareArrowOutUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Toggle full screen"
              title="Full screen"
              onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen())}
              className="hover:text-[var(--color-text-global)]"
            >
              <Maximize className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[32px] font-normal leading-10 text-[var(--color-text-global)]">{registerTitle}</h1>
            <div className="mt-3 flex items-center gap-4">
              <AccountSelector
                accounts={registerAccounts}
                selectedAccountId={selectedAccountId}
                onChange={handleAccountChange}
              />
              <div className="text-sm leading-5 text-[var(--color-text-primary)]">
                <div>Bank Balance</div>
                <div>Not Connected</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            {selectedAccountId ? <RegisterHeaderActions accountId={selectedAccountId} /> : null}
            <div className="text-right">
              <p className="text-xs font-normal uppercase leading-5 tracking-wide text-[var(--color-text-primary)]">Ending Balance</p>
              <p className="text-[32px] font-normal leading-9 tracking-tight text-[var(--color-text-global)]">
                {generalBalance.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD"
                })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <section className="px-[30px] pb-[30px]">
        <RegisterTable
          topLeft={
            <p className="flex items-center gap-3 text-base text-[var(--color-text-primary)]">
              {reconciledThroughLabel ? <span>Reconciled through {reconciledThroughLabel}</span> : <span>Never reconciled</span>}
              <button type="button" onClick={() => setUnreconciledOnly((current) => !current)} className="text-[var(--color-link-text)] hover:underline">
                {unreconciledOnly ? "Show All" : "Show Unreconciled Only"}
              </button>
            </p>
          }
          entries={visibleEntries}
          deepLinkTransactionId={searchParams.get("tx")}
          draftTransaction={draftTransaction}
          draftErrors={draftErrors}
          isSavingDraft={isSavingDraft}
          onDraftFieldChange={updateDraftField}
          onDraftSave={saveDraftTransaction}
          onDraftCancel={cancelDraftTransaction}
          onDraftReconcileCycle={cycleDraftReconcileStatus}
          onUpdateEntry={updateRegisterEntryInline}
          onDeleteEntry={deleteRegisterEntryInline}
          onBatchUpdate={batchUpdateRegisterEntries}
          onBatchDelete={batchDeleteRegisterEntries}
          registerAccountId={selectedAccountId}
          onCycleReconcileStatus={cycleReconcileStatus}
          accountOptions={accountOptions}
          accounts={accounts}
          onCreateAccount={createAccount}
          availableTransactionTypes={availableTransactionTypes}
          selectedTransactionType={selectedTransactionType}
          onAddSelectedTransaction={addSelectedTransaction}
          onSelectTransactionType={selectTransactionType}
          selectedAccountName={selectedAccount?.name ?? "Account"}
          endingBalance={generalBalance}
          printUserName={DEFAULT_TOP_HEADER_USER_NAME}
          onOpenImport={() => setIsImportModalOpen(true)}
          savedImportRowCount={savedImportRowCount}
          onOpenJournalEntry={() => setIsJournalEntryModalOpen(true)}
          isSplitMode={isSplitMode}
          draftSplits={draftSplits}
          onToggleSplitMode={toggleSplitMode}
          onAddSplitLine={addDraftSplitLine}
          onRemoveSplitLine={removeDraftSplitLine}
          onUpdateSplitLine={updateDraftSplitLine}
        />
      </section>

      <ImportModal
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        defaultMainAccountId={selectedAccountId}
        accountOptions={accountOptions}
        onImportTransactions={importTransactions}
        onSessionChange={setSavedImportRowCount}
      />

      <JournalEntryModal
        open={isJournalEntryModalOpen}
        accountOptions={accountOptions}
        isSaving={isSavingJournalEntry}
        onClose={() => setIsJournalEntryModalOpen(false)}
        onSave={async (input) => {
          setIsSavingJournalEntry(true);
          try {
            await createJournalEntry(input);
          } finally {
            setIsSavingJournalEntry(false);
          }
        }}
      />
    </main>
  );
}
