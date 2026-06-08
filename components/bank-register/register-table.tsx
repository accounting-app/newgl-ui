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
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { TablePagination } from "@/components/bank-register/table-pagination";
import { Funnel, Printer, Settings, Upload } from "lucide-react";
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
  accountOptions: SelectFieldOption[];
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

const ROWS_PER_PAGE_OPTIONS = [4, 40, 60, 80, 100, 125, 150] as const;

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
  accountOptions,
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
    accountTypeId: "",
    memo: "",
    payment: "",
    deposit: "",
    reconcileStatus: ""
  });
  const [payees, setPayees] = useState<PayeeOption[]>([]);
  const [isPayeeModalOpen, setIsPayeeModalOpen] = useState(false);
  const [payeeModalTarget, setPayeeModalTarget] = useState<"draft" | "row">("draft");
  const [isSettingsPopoverOpen, setIsSettingsPopoverOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState<number>(40);
  const [currentPage, setCurrentPage] = useState<number>(1);

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
    () => {
      const startIndex = (currentPage - 1) * rowsPerPage;
      const pageEntries = filteredEntries.slice(startIndex, startIndex + rowsPerPage);
      return pageEntries.find((entry) => entry.id === selectedEntryId) ?? null;
    },
    [currentPage, filteredEntries, rowsPerPage, selectedEntryId]
  );
  const totalPages = useMemo(
    () => (filteredEntries.length > 0 ? Math.ceil(filteredEntries.length / rowsPerPage) : 0),
    [filteredEntries.length, rowsPerPage]
  );
  const paginatedEntries = useMemo(() => {
    if (filteredEntries.length === 0) return [];
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredEntries.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, filteredEntries, rowsPerPage]);
  const paginationStart = useMemo(
    () => (filteredEntries.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1),
    [currentPage, filteredEntries.length, rowsPerPage]
  );
  const paginationEnd = useMemo(
    () => (filteredEntries.length === 0 ? 0 : Math.min(currentPage * rowsPerPage, filteredEntries.length)),
    [currentPage, filteredEntries.length, rowsPerPage]
  );
  const selectedEntryIndex = useMemo(
    () => (selectedEntryId ? paginatedEntries.findIndex((entry) => entry.id === selectedEntryId) : -1),
    [paginatedEntries, selectedEntryId]
  );
  const entriesBeforeSelected = useMemo(
    () => (selectedEntryIndex >= 0 ? paginatedEntries.slice(0, selectedEntryIndex) : paginatedEntries),
    [paginatedEntries, selectedEntryIndex]
  );
  const entriesAfterSelected = useMemo(
    () => (selectedEntryIndex >= 0 ? paginatedEntries.slice(selectedEntryIndex + 1) : []),
    [paginatedEntries, selectedEntryIndex]
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
    const stillVisible = paginatedEntries.some((entry) => entry.id === selectedEntryId);
    if (!stillVisible) {
      setSelectedEntryId(null);
      setRowError(null);
    }
  }, [paginatedEntries, selectedEntryId]);

  useEffect(() => {
    if (totalPages === 0) {
      if (currentPage !== 1) setCurrentPage(1);
      return;
    }
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-settings-popover-root]")) {
        setIsSettingsPopoverOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function openRowEditor(entry: RegisterEntry) {
    setSelectedEntryId(entry.id);
    setRowError(null);
    const matchedAccount = accountOptions.find((option) => option.label === entry.accountLabel);
    setEditor({
      date: entry.date,
      refNo: entry.refNumber ?? "",
      payee: entry.payee ?? "",
      accountTypeId: matchedAccount?.value ?? "",
      memo: entry.memo ?? "",
      payment: entry.payment ? String(entry.payment) : "",
      deposit: entry.deposit ? String(entry.deposit) : "",
      reconcileStatus: entry.reconcileStatus ?? ""
    });
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
    <>
      <TablePagination
        totalItems={filteredEntries.length}
        currentPage={filteredEntries.length > 0 ? currentPage : 0}
        totalPages={totalPages}
        start={paginationStart}
        end={paginationEnd}
        onPageChange={setCurrentPage}
      />
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
          <div className="relative flex h-full items-center" data-settings-popover-root>
            <button
              type="button"
              className="flex h-full items-center hover:text-[var(--color-icon-secondary)]"
              aria-label="Settings"
              onClick={() => setIsSettingsPopoverOpen((current) => !current)}
            >
              <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            {isSettingsPopoverOpen ? (
              <div className="dgrid-03 absolute">
                <div className="dgrid-hider-menu">
                  <div className="hiderMenuConnector" />
                  <div className="hiderMenuContainer">
                  <label className="mb-1 block text-[13px] text-gray-700">Rows</label>
                  <SelectField
                    value={String(rowsPerPage)}
                    onChange={(value) => {
                      const nextRows = Number(value);
                      if (!Number.isFinite(nextRows)) return;
                      setRowsPerPage(nextRows);
                      setCurrentPage(1);
                      setIsSettingsPopoverOpen(false);
                    }}
                    options={ROWS_PER_PAGE_OPTIONS.map((option) => ({
                      value: String(option),
                      label: String(option)
                    }))}
                    placeholder="Rows"
                    allowCustomValue={false}
                    optionSize="sm"
                  />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
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
            accountOptions={accountOptions}
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
                          payeeOptions={payeeOptions}
                          accountOptions={accountOptions}
                          rowError={rowError}
                          isSavingRow={isSavingRow}
                          isDeletingRow={isDeletingRow}
                          isPaymentDisabled={INFLOW_ROW_TYPES.has(selectedEntry.transactionType)}
                          isDepositDisabled={OUTFLOW_ROW_TYPES.has(selectedEntry.transactionType)}
                          onEditorChange={(field, value) => setEditor((current) => ({ ...current, [field]: value }))}
                          onReconcileCycle={cycleEditorReconcileStatus}
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

      </div>
      <TablePagination
        totalItems={filteredEntries.length}
        currentPage={filteredEntries.length > 0 ? currentPage : 0}
        totalPages={totalPages}
        start={paginationStart}
        end={paginationEnd}
        onPageChange={setCurrentPage}
      />
      {/**
       * Aqui
       */}
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
    </>
  );
}
