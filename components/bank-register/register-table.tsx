import { useEffect, useMemo, useState } from "react";
import { AddTransactionForm } from "@/components/bank-register/add-transaction-form";
import { ActionToolbar } from "@/components/bank-register/action-toolbar";
import { EditTransactionForm } from "@/components/bank-register/edit-transaction-form";
import { FilterFormPopover } from "@/components/bank-register/filter-form-popover";
import { useRegisterExport } from "@/components/bank-register/hooks/use-register-export";
import { useRegisterFilters } from "@/components/bank-register/hooks/use-register-filters";
import { useRegisterPrint } from "@/components/bank-register/hooks/use-register-print";
import { PayeeSideModal } from "@/components/bank-register/payee-side-modal";
import type { PayeeOption } from "@/components/bank-register/payee-side-modal";
import { RegisterTableColumnGroup } from "@/components/bank-register/register-table-column-group";
import { RegisterTableHeader } from "@/components/bank-register/register-table-header";
import { Funnel, Printer, Settings2, Upload } from "lucide-react";
import type { RegisterEntry } from "@/modules/accounting/domain/models";
import {
  nextReconcileStatus
} from "@/modules/accounting/presentation/hooks/use-bank-register";
import type {
  DraftTransactionErrors,
  DraftTransactionForm,
  InlineEntryEditorInput
} from "@/modules/accounting/presentation/hooks/use-bank-register";
import {
  isAccountFieldDisabledForTransactionType,
  isInflowTransactionType,
  isOutflowTransactionType
} from "@/modules/accounting/presentation/transaction-type-policy";
import type {
  BankRegisterTransactionTypeId,
  BankRegisterTransactionTypeOption
} from "@/modules/accounting/presentation/transaction-type-policy";
import { TriangleArrowDownIcon } from "../icons/triangle-arrow-down-icon";

type RegisterTableProps = {
  entries: RegisterEntry[];
  draftTransaction: DraftTransactionForm | null;
  draftErrors: DraftTransactionErrors;
  isSavingDraft: boolean;
  onDraftFieldChange: (
    field: keyof Omit<DraftTransactionForm, "transactionTypeId" | "transactionTypeLabel">,
    value: string
  ) => void;
  onDraftSave: () => void;
  onDraftCancel: () => void;
  onDraftReconcileCycle: () => void;
  onUpdateEntry: (entryId: string, input: InlineEntryEditorInput) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onCycleReconcileStatus: (entryId: string) => void;
  availableTransactionTypes: BankRegisterTransactionTypeOption[];
  selectedTransactionType: BankRegisterTransactionTypeId;
  onAddSelectedTransaction: () => void;
  onSelectTransactionType: (transactionType: BankRegisterTransactionTypeId) => void;
  selectedAccountName: string;
  endingBalance: number;
  printUserName: string;
};

function rowStyle(status: RegisterEntry["status"]): string {
  if (status === "VOIDED" || status === "DELETED") {
    return "line-through text-gray-400";
  }
  if (status === "DRAFT") {
    return "text-gray-700";
  }
  return "text-gray-800";
}

function formatTransactionTypeLabel(transactionType: RegisterEntry["transactionType"]): string {
  return transactionType
    .toLowerCase()
    .split("_")
    .map((segment) => (segment ? segment[0].toUpperCase() + segment.slice(1) : segment))
    .join(" ");
}

const INFLOW_ROW_TYPES = new Set<RegisterEntry["transactionType"]>([
  "DEPOSIT",
  "SALES_RECEIPT",
  "RECEIVE_PAYMENT"
]);

const OUTFLOW_ROW_TYPES = new Set<RegisterEntry["transactionType"]>([
  "CHECK",
  "BILL_PAYMENT",
  "REFUND",
  "EXPENSE"
]);

export function RegisterTable({
  entries,
  draftTransaction,
  draftErrors,
  isSavingDraft,
  onDraftFieldChange,
  onDraftSave,
  onDraftCancel,
  onDraftReconcileCycle,
  onUpdateEntry,
  onDeleteEntry,
  onCycleReconcileStatus,
  availableTransactionTypes,
  selectedTransactionType,
  onAddSelectedTransaction,
  onSelectTransactionType,
  selectedAccountName,
  endingBalance,
  printUserName
}: RegisterTableProps) {
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [isSavingRow, setIsSavingRow] = useState(false);
  const [isDeletingRow, setIsDeletingRow] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [editor, setEditor] = useState<InlineEntryEditorInput>({
    date: "",
    refNo: "",
    payee: "",
    memo: "",
    payment: "",
    deposit: "",
    reconcileStatus: ""
  });
  const [accountLabel, setAccountLabel] = useState("");
  const [payees, setPayees] = useState<PayeeOption[]>([]);
  const [isPayeeModalOpen, setIsPayeeModalOpen] = useState(false);
  const [payeeModalTarget, setPayeeModalTarget] = useState<"draft" | "row">("draft");

  const payeeOptions = useMemo(
    () =>
      payees.map((payee) => ({
        value: payee.name,
        label: payee.name,
        rightLabel: payee.kind.toLowerCase()
      })),
    [payees]
  );
  const {
    filterPopoverRef,
    filterButtonRef,
    isFilterPopoverOpen,
    setIsFilterPopoverOpen,
    filterDraft,
    isFromDateActive,
    isToDateActive,
    filteredEntries,
    hasActiveFilters,
    activeFilterChips,
    reconcileFilterOptions,
    dateFilterOptions,
    transactionTypeOptions,
    payeeFilterOptions,
    handleFindChange,
    handleReconcileStatusChange,
    handleTransactionTypeChange,
    handlePayeeChange,
    handleDatePresetChange,
    handleFromFocus,
    handleFromBlur,
    handleFromChange,
    handleToFocus,
    handleToBlur,
    handleToChange,
    handleApplyFilters,
    handleResetFilters,
    removeActiveFilterChip
  } = useRegisterFilters({
    entries,
    payeeOptions,
    formatTransactionTypeLabel
  });
  const selectedEntry = useMemo(
    () => filteredEntries.find((entry) => entry.id === selectedEntryId) ?? null,
    [filteredEntries, selectedEntryId]
  );
  const selectedEntryIndex = useMemo(
    () => (selectedEntryId ? filteredEntries.findIndex((entry) => entry.id === selectedEntryId) : -1),
    [filteredEntries, selectedEntryId]
  );
  const entriesBeforeSelected = useMemo(
    () => (selectedEntryIndex >= 0 ? filteredEntries.slice(0, selectedEntryIndex) : filteredEntries),
    [filteredEntries, selectedEntryIndex]
  );
  const entriesAfterSelected = useMemo(
    () => (selectedEntryIndex >= 0 ? filteredEntries.slice(selectedEntryIndex + 1) : []),
    [filteredEntries, selectedEntryIndex]
  );
  const isDraftInflowType = draftTransaction
    ? isInflowTransactionType(draftTransaction.transactionTypeId)
    : false;
  const isDraftOutflowType = draftTransaction
    ? isOutflowTransactionType(draftTransaction.transactionTypeId)
    : false;
  const isDraftAccountFieldDisabled = draftTransaction
    ? isAccountFieldDisabledForTransactionType(draftTransaction.transactionTypeId)
    : false;
  const handlePrintRegister = useRegisterPrint({
    entries: filteredEntries,
    userName: printUserName,
    selectedAccountName,
    endingBalance,
    formatTransactionTypeLabel
  });
  const handleExportRegister = useRegisterExport({
    entries: filteredEntries,
    selectedAccountName,
    endingBalance,
    formatTransactionTypeLabel
  });

  useEffect(() => {
    setPayees((previous) => {
      const map = new Map(previous.map((item) => [item.name.toLowerCase(), item]));
      entries.forEach((entry) => {
        if (!entry.payee) return;
        const key = entry.payee.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: crypto.randomUUID(),
            name: entry.payee,
            kind: "VENDOR"
          });
        }
      });
      return [...map.values()];
    });
  }, [entries]);

  useEffect(() => {
    if (!selectedEntryId) return;
    const stillVisible = filteredEntries.some((entry) => entry.id === selectedEntryId);
    if (!stillVisible) {
      setSelectedEntryId(null);
      setRowError(null);
    }
  }, [filteredEntries, selectedEntryId]);

  function openRowEditor(entry: RegisterEntry) {
    setSelectedEntryId(entry.id);
    setRowError(null);
    setEditor({
      date: entry.date,
      refNo: entry.refNumber ?? "",
      payee: entry.payee ?? "",
      memo: entry.memo ?? "",
      payment: entry.payment ? String(entry.payment) : "",
      deposit: entry.deposit ? String(entry.deposit) : "",
      reconcileStatus: entry.reconcileStatus ?? ""
    });
    setAccountLabel(entry.accountLabel ?? "");
  }

  function cycleEditorReconcileStatus() {
    setEditor((current) => ({ ...current, reconcileStatus: nextReconcileStatus(current.reconcileStatus) }));
  }

  function openPayeeModal(target: "draft" | "row") {
    setPayeeModalTarget(target);
    setIsPayeeModalOpen(true);
  }

  async function handleSaveRow() {
    if (!selectedEntryId) return;
    const payment = Number(editor.payment || 0);
    const deposit = Number(editor.deposit || 0);
    if (!editor.date) {
      setRowError("Date is required.");
      return;
    }
    if ((payment > 0 && deposit > 0) || (payment <= 0 && deposit <= 0)) {
      setRowError("Use only payment or deposit and provide one amount.");
      return;
    }
    try {
      setIsSavingRow(true);
      setRowError(null);
      await onUpdateEntry(selectedEntryId, editor);
      setSelectedEntryId(null);
    } catch (error) {
      setRowError(error instanceof Error ? error.message : "Failed to save changes.");
    } finally {
      setIsSavingRow(false);
    }
  }

  async function handleDeleteRow() {
    if (!selectedEntryId) return;
    try {
      setIsDeletingRow(true);
      setRowError(null);
      await onDeleteEntry(selectedEntryId);
      setSelectedEntryId(null);
    } catch (error) {
      setRowError(error instanceof Error ? error.message : "Failed to delete entry.");
    } finally {
      setIsDeletingRow(false);
    }
  }

  const renderReadOnlyEntryTable = (entry: RegisterEntry) => (
    <div key={entry.id}>
      <table className="group w-full min-w-[1025px] table-fixed border-collapse text-sm">
        <RegisterTableColumnGroup />
        <tbody>
          <tr className={`cursor-pointer group-hover:bg-[#f3f8fe] ${rowStyle(entry.status)}`} onClick={() => openRowEditor(entry)}>
            <td className="p-2 text-[13px] align-top text-gray-800">
              {entry.date}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top">
              {entry.refNumber ?? ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top">
              {entry.payee ?? ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-gray-800">
              {entry.memo ?? ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-right align-top text-gray-800">
              {entry.payment ? entry.payment.toFixed(2) : ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-right align-top text-gray-800">
              {entry.deposit ? entry.deposit.toFixed(2) : ""}
            </td>
            <td className="border-l text-center border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-gray-800">
              {entry.reconcileStatus}
            </td>
            <td className="p-2 border-l border-l-dotted border-l-[var(--color-divider-tertiary)] text-[13px] text-right align-top font-medium text-gray-900">
              {entry.runningBalance.toFixed(2)}
            </td>
          </tr>
          <tr
            className={`cursor-pointer border-b border-gray-100 bg-[#f9fafb] group-hover:bg-[#ebf0f7]`}
            onClick={() => openRowEditor(entry)}
          >
            <td className="p-2 text-[13px] align-top text-gray-500">
              &nbsp;
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-gray-500">
              {formatTransactionTypeLabel(entry.transactionType)}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-gray-500">
              {entry.accountLabel ?? ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-gray-500">
              &nbsp;
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-right align-top text-gray-500">
              &nbsp;
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-right align-top text-gray-500">
              &nbsp;
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-center align-top text-gray-500">
              &nbsp;
            </td>
            <td className="p-2 border-l border-l-dotted border-l-[var(--color-divider-tertiary)] text-[13px] text-right align-top text-gray-500">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="register-table relative overflow-visible bg-white">
      <div className="action-bar flex h-[45px] items-center justify-between border-b border-gray-200 px-4">
        <div className="relative flex items-center gap-1">
          <button
            ref={filterButtonRef}
            type="button"
            className="flex h-full items-center gap-1 text-sm text-[#BABEC5] hover:text-[var(--color-icon-secondary)]"
            aria-label="Filter register rows"
            onClick={() => setIsFilterPopoverOpen((current) => !current)}
          >
            <Funnel className="h-[18px] w-[18px]" aria-hidden="true" />
            <TriangleArrowDownIcon className="h-[18px] w-[18px] text-[var(--color-icon-primary)]" />
          </button>
          {hasActiveFilters ? (
            <div className="ml-1 flex flex-wrap items-center gap-2">
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-0.5 text-[13px] text-gray-700"
                >
                  {chip.label}
                  <button
                    type="button"
                    className="text-gray-500 hover:text-gray-700"
                    aria-label={`Remove ${chip.label} filter`}
                    onClick={() => removeActiveFilterChip(chip.key)}
                  >
                    x
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="text-[13px] text-[var(--color-link-text)] hover:underline"
                onClick={handleResetFilters}
              >
                Clear filter / View All
              </button>
            </div>
          ) : (
            <span>All</span>
          )}
          {isFilterPopoverOpen ? (
            <FilterFormPopover
              popoverRef={filterPopoverRef}
              filterDraft={filterDraft}
              isFromDateActive={isFromDateActive}
              isToDateActive={isToDateActive}
              reconcileOptions={reconcileFilterOptions}
              transactionTypeOptions={transactionTypeOptions}
              payeeOptions={payeeFilterOptions}
              dateOptions={dateFilterOptions}
              onFindChange={handleFindChange}
              onReconcileStatusChange={handleReconcileStatusChange}
              onTransactionTypeChange={handleTransactionTypeChange}
              onPayeeChange={handlePayeeChange}
              onDatePresetChange={handleDatePresetChange}
              onFromFocus={handleFromFocus}
              onFromBlur={handleFromBlur}
              onFromChange={handleFromChange}
              onToFocus={handleToFocus}
              onToBlur={handleToBlur}
              onToChange={handleToChange}
              onReset={handleResetFilters}
              onApply={handleApplyFilters}
            />
          ) : null}
        </div>
        <div className="flex h-full items-center gap-4 text-[#BABEC5]">
          <button
            type="button"
            className="flex h-full items-center hover:text-[var(--color-icon-secondary)]"
            aria-label="Print"
            onClick={handlePrintRegister}
          >
            <Printer className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="flex h-full items-center hover:text-[var(--color-icon-secondary)]"
            aria-label="Export"
            onClick={handleExportRegister}
          >
            <Upload className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="flex h-full items-center hover:text-[var(--color-icon-secondary)]"
            aria-label="Settings"
          >
            <Settings2 className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>

      <RegisterTableHeader />

      <div className="content-table">
        <div className="actions-quickadd">
          <ActionToolbar
            availableTransactionTypes={availableTransactionTypes}
            selectedTransactionType={selectedTransactionType}
            onAddSelectedTransaction={onAddSelectedTransaction}
            onSelectTransactionType={onSelectTransactionType}
          />
        </div>

        {draftTransaction ? (
          <AddTransactionForm
            draftTransaction={draftTransaction}
            draftErrors={draftErrors}
            payeeOptions={payeeOptions}
            isDraftAccountFieldDisabled={isDraftAccountFieldDisabled}
            isDraftInflowType={isDraftInflowType}
            isDraftOutflowType={isDraftOutflowType}
            isSavingDraft={isSavingDraft}
            onDraftFieldChange={onDraftFieldChange}
            onDraftSave={onDraftSave}
            onDraftCancel={onDraftCancel}
            onReconcileCycle={onDraftReconcileCycle}
            onOpenPayeeModal={() => openPayeeModal("draft")}
          />
        ) : null}

        {filteredEntries.length === 0 ? (
          <div className="no-transactions-data ">There are no transactions matching the selected criteria</div>
        ) : (
          <>
            {entriesBeforeSelected.map(renderReadOnlyEntryTable)}

            {selectedEntry ? (
              <div key={selectedEntry.id}>
                <table className="w-full min-w-[1025px] table-fixed border-collapse text-sm">
                  <RegisterTableColumnGroup />
                  <tbody>
                    <tr>
                      <td colSpan={8} className="p-0">
                        <EditTransactionForm
                          entry={selectedEntry}
                          editor={editor}
                          accountLabel={accountLabel}
                          payeeOptions={payeeOptions}
                          rowError={rowError}
                          isSavingRow={isSavingRow}
                          isDeletingRow={isDeletingRow}
                          isPaymentDisabled={INFLOW_ROW_TYPES.has(selectedEntry.transactionType)}
                          isDepositDisabled={OUTFLOW_ROW_TYPES.has(selectedEntry.transactionType)}
                          onEditorChange={(field, value) => setEditor((current) => ({ ...current, [field]: value }))}
                          onReconcileCycle={cycleEditorReconcileStatus}
                          onAccountLabelChange={setAccountLabel}
                          onOpenPayeeModal={() => openPayeeModal("row")}
                          onDelete={handleDeleteRow}
                          onCancel={() => {
                            setSelectedEntryId(null);
                            setRowError(null);
                          }}
                          onSave={handleSaveRow}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            {entriesAfterSelected.map(renderReadOnlyEntryTable)}
          </>
        )}
      </div>

      <PayeeSideModal
        open={isPayeeModalOpen}
        onClose={() => setIsPayeeModalOpen(false)}
        onSave={(payee) => {
          setPayees((previous) => {
            const exists = previous.some((item) => item.name.toLowerCase() === payee.name.toLowerCase());
            return exists ? previous : [...previous, payee];
          });

          if (payeeModalTarget === "draft" && draftTransaction) {
            onDraftFieldChange("payee", payee.name);
          }
          if (payeeModalTarget === "row") {
            setEditor((current) => ({ ...current, payee: payee.name }));
          }
        }}
      />
    </div>
  );
}
