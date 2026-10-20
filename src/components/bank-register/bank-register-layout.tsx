"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

export function BankRegisterLayout() {
  return (
    <Suspense fallback={null}>
      <BankRegisterLayoutInner />
    </Suspense>
  );
}

function BankRegisterLayoutInner() {
  const searchParams = useSearchParams();
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
      <header className="header mb-4">
        {/* .header is a flex row, so the breadcrumb and the title block share
            one column wrapper to stack the breadcrumb above the title. */}
        <div className="w-full space-y-4">
          {/* The register has no entry point of its own (QBO has none either):
              it's reached from Bank transactions' "Go to bank register" or
              Chart of accounts' "View register", and this path -- plus "Back To
              Banking" -- is how you retrace that route. */}
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[var(--color-text-primary)]">
            <Link href="/all-apps/bank-transactions" className="hover:text-[var(--color-link-action)] hover:underline">
              Accounting
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/all-apps/chart-of-accounts" className="hover:text-[var(--color-link-action)] hover:underline">
              Chart of accounts
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{registerTitle}</span>
            <Link href="/all-apps/bank-transactions" className="ml-3 font-medium text-[var(--color-link-action)] hover:underline">
              &lt; Back To Banking
            </Link>
          </nav>
          <div className="w-full flex flex-wrap items-center justify-between gap-4">
            <div className="">
              <h1 className="page-title">{registerTitle}</h1>
              <AccountSelector
                accounts={registerAccounts}
                selectedAccountId={selectedAccountId}
                onChange={setSelectedAccountId}
              />
            </div>

            <div className="space-y-3 pb-3 text-right">
              {selectedAccountId ? <RegisterHeaderActions accountId={selectedAccountId} /> : null}
              <div>
                <p className="balance-label tracking-wide">Ending Balance</p>
                <p className="balance-amount">
                  {generalBalance.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD"
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <section className="page-content ">
        <RegisterTable
          entries={entries}
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
