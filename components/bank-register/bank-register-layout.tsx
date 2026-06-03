"use client";

import { AccountSelector } from "@/components/bank-register/account-selector";
import { RegisterTable } from "@/components/bank-register/register-table";
import { getRegisterTitle } from "@/components/bank-register/register-title";
import { TablePagination } from "@/components/bank-register/table-pagination";
import { DEFAULT_TOP_HEADER_USER_NAME } from "@/components/layout/top-header";
import { useBankRegister } from "@/modules/accounting/presentation/hooks/use-bank-register";

export function BankRegisterLayout() {
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
    selectTransactionType,
    saveDraftTransaction,
    updateRegisterEntryInline,
    updateDraftField,
  } = useBankRegister();

  const registerTitle = getRegisterTitle(selectedAccount);

  return (
    <main className="tw-override main bg-white text-sm text-gray-800">
      <header className="header mb-4 space-y-4">
        <div className="w-full flex flex-wrap items-center justify-between gap-4">
          <div className="">
            <h1 className="page-title">{registerTitle}</h1>
            <AccountSelector
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onChange={setSelectedAccountId}
            />
          </div>

          <div className="space-y-3 text-right">
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
      </header>

      {error ? <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <section className="page-content ">
        <TablePagination totalItems={entries.length} />
        <RegisterTable
          entries={entries}
          draftTransaction={draftTransaction}
          draftErrors={draftErrors}
          isSavingDraft={isSavingDraft}
          onDraftFieldChange={updateDraftField}
          onDraftSave={saveDraftTransaction}
          onDraftCancel={cancelDraftTransaction}
          onDraftReconcileCycle={cycleDraftReconcileStatus}
          onUpdateEntry={updateRegisterEntryInline}
          onDeleteEntry={deleteRegisterEntryInline}
          onCycleReconcileStatus={cycleReconcileStatus}
          availableTransactionTypes={availableTransactionTypes}
          selectedTransactionType={selectedTransactionType}
          onAddSelectedTransaction={addSelectedTransaction}
          onSelectTransactionType={selectTransactionType}
          selectedAccountName={selectedAccount?.name ?? "Account"}
          endingBalance={generalBalance}
          printUserName={DEFAULT_TOP_HEADER_USER_NAME}
        />
        <TablePagination totalItems={entries.length} />
      </section>
    </main>
  );
}
