import { useEffect, useMemo, useRef, useState } from "react";
import { AddTransactionForm } from "@/components/bank-register/add-transaction-form";
import { ActionToolbar } from "@/components/bank-register/action-toolbar";
import { EditTransactionForm } from "@/components/bank-register/edit-transaction-form";
import { FilterFormPopover } from "@/components/bank-register/filter-form-popover";
import { useRegisterExport } from "@hooks/use-register-export";
import { useRegisterFilters } from "@hooks/use-register-filters";
import { useRegisterPrint } from "@hooks/use-register-print";
import { PayeeSideModal } from "@/components/bank-register/payee-side-modal";
import type { PayeeOption } from "@/components/bank-register/payee-side-modal";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { RegisterTableColumnGroup } from "@/components/bank-register/register-table-column-group";
import { RegisterTableHeader } from "@/components/bank-register/register-table-header";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { TablePagination } from "@/components/bank-register/table-pagination";
import Link from "next/link";
import { BookOpenText, Database, Download, FileUp, Funnel, Printer, Settings } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import {
  REGISTER_INFLOW_ROW_TYPES,
  REGISTER_OUTFLOW_ROW_TYPES,
  REGISTER_ROWS_PER_PAGE_OPTIONS
} from "@/constants/ui";
import type { Account, RegisterEntry } from "@/modules/accounting/domain/models";
import {
  nextReconcileStatus
} from "@hooks/use-bank-register";
import type {
  DraftSplitLine,
  DraftTransactionErrors,
  DraftTransactionForm,
  InlineEntryEditorInput
} from "@hooks/use-bank-register";
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
import { BatchEditRow } from "@/components/bank-register/batch-edit-row";
import { BatchFieldsModal } from "@/components/bank-register/batch-fields-modal";
import { requestConfirmation } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast/toast-context";
import type { BatchRegisterEntryUpdate } from "@/modules/accounting/application/contracts";
import {
  EMPTY_BATCH_FIELDS,
  EMPTY_BATCH_VALUES,
  batchLockedReason,
  buildBatchUpdates,
  isBatchSelectable,
  summarizeBatchSelection,
  validateBatchEdit
} from "@/lib/accounting/register-batch";
import type { BatchEditFields, BatchEditValues } from "@/lib/accounting/register-batch";

type RegisterTableProps = {
  entries: RegisterEntry[];
  /** Deep-link from another screen (e.g. a duplicate-transaction warning during CSV import): opens this entry's inline editor and jumps to its page once entries have loaded. */
  deepLinkTransactionId?: string | null;
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
  /** Every update applies or none does (one ledger version per batch). */
  onBatchUpdate: (updates: BatchRegisterEntryUpdate[]) => Promise<void>;
  onBatchDelete: (entryIds: string[]) => Promise<void>;
  /** The register's own account, so a batch can't make it its own offset. */
  registerAccountId: string;
  onCycleReconcileStatus: (entryId: string) => void;
  accountOptions: SelectFieldOption[];
  accounts: Account[];
  onCreateAccount: (input: { name: string; category: Account["category"]; subtype?: string; openingBalance?: number }) => Promise<Account>;
  availableTransactionTypes: BankRegisterTransactionTypeOption[];
  selectedTransactionType: BankRegisterTransactionTypeId;
  onAddSelectedTransaction: () => void;
  onSelectTransactionType: (transactionType: BankRegisterTransactionTypeId) => void;
  selectedAccountName: string;
  endingBalance: number;
  printUserName: string;
  onOpenImport: () => void;
  savedImportRowCount: number;
  onOpenJournalEntry: () => void;
  isSplitMode: boolean;
  draftSplits: DraftSplitLine[];
  onToggleSplitMode: () => void;
  onAddSplitLine: () => void;
  onRemoveSplitLine: (clientId: string) => void;
  onUpdateSplitLine: (clientId: string, patch: Partial<Omit<DraftSplitLine, "clientId">>) => void;
};

const batchSelectedRowClass = "bg-[color-mix(in_srgb,var(--color-negative)_10%,transparent)]";

function rowStyle(status: RegisterEntry["status"]): string {
  if (status === "VOIDED" || status === "DELETED") {
    return "line-through text-[var(--color-text-disabled)]";
  }
  if (status === "DRAFT") {
    return "text-[var(--color-text-primary)]";
  }
  return "text-[var(--color-text-primary)]";
}

function formatTransactionTypeLabel(transactionType: RegisterEntry["transactionType"]): string {
  return transactionType
    .toLowerCase()
    .split("_")
    .map((segment) => (segment ? segment[0].toUpperCase() + segment.slice(1) : segment))
    .join(" ");
}

export function RegisterTable({
  entries,
  deepLinkTransactionId,
  draftTransaction,
  draftErrors,
  isSavingDraft,
  onDraftFieldChange,
  onDraftSave,
  onDraftCancel,
  onDraftReconcileCycle,
  onUpdateEntry,
  onDeleteEntry,
  onBatchUpdate,
  onBatchDelete,
  registerAccountId,
  onCycleReconcileStatus,
  accountOptions,
  accounts,
  onCreateAccount,
  availableTransactionTypes,
  selectedTransactionType,
  onAddSelectedTransaction,
  onSelectTransactionType,
  selectedAccountName,
  endingBalance,
  printUserName,
  onOpenImport,
  savedImportRowCount,
  onOpenJournalEntry,
  isSplitMode,
  draftSplits,
  onToggleSplitMode,
  onAddSplitLine,
  onRemoveSplitLine,
  onUpdateSplitLine
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
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalTarget, setAccountModalTarget] = useState<"draft" | "row">("draft");
  const [isSettingsPopoverOpen, setIsSettingsPopoverOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState<number>(40);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const appliedDeepLinkRef = useRef(false);
  const { toast } = useToast();
  const topRef = useRef<HTMLDivElement>(null);

  // Batch mode: BATCH -> tick rows -> EDIT (pick fields, fill the pink row,
  // Confirm Batch) or DELETE. Selection is by id so it survives paging and
  // refreshes; rows that stop being selectable (cleared meanwhile) drop out
  // in selectedBatchEntries below.
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(() => new Set());
  const [batchFields, setBatchFields] = useState<BatchEditFields>(EMPTY_BATCH_FIELDS);
  const [batchValues, setBatchValues] = useState<BatchEditValues>(EMPTY_BATCH_VALUES);
  const [isChoosingBatchFields, setIsChoosingBatchFields] = useState(false);
  const [isBatchEditing, setIsBatchEditing] = useState(false);
  const [isApplyingBatch, setIsApplyingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Jump To Last: the last row you opened or ticked, so after paging away
  // or scrolling you can get straight back to it.
  const [lastTouchedEntryId, setLastTouchedEntryId] = useState<string | null>(null);
  const [jumpTargetId, setJumpTargetId] = useState<string | null>(null);

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
  // Plain arithmetic, not memoized -- cheap enough that useMemo's own
  // dependency-array check costs more than just recomputing it.
  const paginationStart = filteredEntries.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
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

  const selectableEntries = useMemo(() => filteredEntries.filter(isBatchSelectable), [filteredEntries]);
  const selectedBatchEntries = useMemo(
    () => entries.filter((entry) => batchSelectedIds.has(entry.id) && isBatchSelectable(entry)),
    [batchSelectedIds, entries]
  );

  // Scroll to and flash the Jump To Last target once its page is showing.
  useEffect(() => {
    if (!jumpTargetId) return;
    const element = document.querySelector<HTMLElement>(`[data-entry-id="${jumpTargetId}"]`);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.style.outline = "2px solid var(--override-focus)";
    const timer = window.setTimeout(() => {
      element.style.outline = "";
    }, 1600);
    setJumpTargetId(null);
    return () => window.clearTimeout(timer);
  }, [jumpTargetId, paginatedEntries]);

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

  // Deep-link (e.g. a duplicate-transaction warning during CSV import):
  // once entries have loaded, jump to the page containing the target entry
  // and open its inline editor. Gated on a ref, not just the prop, so a
  // later entries refresh (e.g. after saving) can't re-fire this.
  useEffect(() => {
    if (appliedDeepLinkRef.current || !deepLinkTransactionId || filteredEntries.length === 0) return;
    const index = filteredEntries.findIndex((entry) => entry.transactionId === deepLinkTransactionId);
    if (index >= 0) {
      setCurrentPage(Math.floor(index / rowsPerPage) + 1);
      openRowEditor(filteredEntries[index]);
    }
    appliedDeepLinkRef.current = true;
  }, [deepLinkTransactionId, filteredEntries, rowsPerPage]);

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

  function jumpToLast() {
    if (!lastTouchedEntryId) return;
    const index = filteredEntries.findIndex((entry) => entry.id === lastTouchedEntryId);
    if (index < 0) {
      toast({ variant: "info", title: "That transaction isn't in the current view" });
      return;
    }
    setCurrentPage(Math.floor(index / rowsPerPage) + 1);
    setJumpTargetId(lastTouchedEntryId);
  }

  function resetBatch() {
    setIsBatchMode(false);
    setBatchSelectedIds(new Set());
    setBatchFields(EMPTY_BATCH_FIELDS);
    setBatchValues(EMPTY_BATCH_VALUES);
    setIsChoosingBatchFields(false);
    setIsBatchEditing(false);
    setIsApplyingBatch(false);
    setBatchError(null);
  }

  function startBatch() {
    setSelectedEntryId(null);
    setRowError(null);
    setIsBatchMode(true);
  }

  function toggleBatchEntry(entry: RegisterEntry) {
    if (!isBatchSelectable(entry)) return;
    setLastTouchedEntryId(entry.id);
    setBatchSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(entry.id)) next.delete(entry.id);
      else next.add(entry.id);
      return next;
    });
  }

  function toggleSelectAllBatch() {
    setBatchSelectedIds((current) =>
      selectableEntries.length > 0 && selectableEntries.every((entry) => current.has(entry.id))
        ? new Set()
        : new Set(selectableEntries.map((entry) => entry.id))
    );
  }

  function activateRow(entry: RegisterEntry) {
    if (isBatchMode) {
      toggleBatchEntry(entry);
      return;
    }
    openRowEditor(entry);
  }

  async function confirmBatchEdit() {
    const problem = validateBatchEdit(batchFields, batchValues, registerAccountId);
    if (problem) {
      setBatchError(problem);
      return;
    }
    const { count, paymentTotal, depositTotal } = summarizeBatchSelection(selectedBatchEntries);
    const confirmed = await requestConfirmation({
      title: `Apply batch edit to ${count} transaction${count === 1 ? "" : "s"}?`,
      message:
        `Payments ${paymentTotal.toFixed(2)}, deposits ${depositTotal.toFixed(2)} are affected. ` +
        "All changes are applied together or not at all, and the batch is one entry in Settings > Ledger > Version history if you need to undo it.",
      confirmLabel: "Confirm Batch"
    });
    if (!confirmed) return;
    try {
      setIsApplyingBatch(true);
      setBatchError(null);
      await onBatchUpdate(buildBatchUpdates(selectedBatchEntries, batchFields, batchValues));
      toast({ variant: "success", title: `Updated ${count} transaction${count === 1 ? "" : "s"}` });
      resetBatch();
    } catch (error) {
      setBatchError(error instanceof Error ? error.message : "The batch couldn't be applied. Nothing was changed.");
      setIsApplyingBatch(false);
    }
  }

  async function deleteBatch() {
    const { count, paymentTotal, depositTotal } = summarizeBatchSelection(selectedBatchEntries);
    if (count === 0) return;
    const confirmed = await requestConfirmation({
      title: `Delete ${count} transaction${count === 1 ? "" : "s"}?`,
      message:
        `Payments ${paymentTotal.toFixed(2)}, deposits ${depositTotal.toFixed(2)} will be removed from the ledger. ` +
        "All are deleted together or none are, and the batch is one entry in Settings > Ledger > Version history.",
      confirmLabel: "Delete"
    });
    if (!confirmed) return;
    try {
      await onBatchDelete(selectedBatchEntries.map((entry) => entry.id));
      toast({ variant: "success", title: `Deleted ${count} transaction${count === 1 ? "" : "s"}` });
      resetBatch();
    } catch (error) {
      toast({
        variant: "error",
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Nothing was deleted."
      });
    }
  }

  function openRowEditor(entry: RegisterEntry) {
    setLastTouchedEntryId(entry.id);
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

  function openAccountModal(target: "draft" | "row") {
    setAccountModalTarget(target);
    setIsAccountModalOpen(true);
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
    <div key={entry.id} data-entry-id={entry.id}>
      <table className="group w-full min-w-[1025px] table-fixed border-collapse text-sm">
        <RegisterTableColumnGroup />
        <tbody>
          <tr
            className={`cursor-pointer group-hover:bg-[var(--color-table-row-hover)] ${rowStyle(entry.status)} ${batchSelectedIds.has(entry.id) ? batchSelectedRowClass : ""}`}
            onClick={() => activateRow(entry)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              activateRow(entry);
            }}
            role="button"
            tabIndex={0}
          >
            <td className="p-2 text-[13px] align-top text-[var(--color-text-primary)]">
              {entry.date}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top">
              {entry.refNumber ?? ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top">
              {entry.payee ?? ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-[var(--color-text-primary)]">
              {entry.memo ?? ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-right align-top text-[var(--color-text-primary)]">
              {entry.payment ? entry.payment.toFixed(2) : ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-right align-top text-[var(--color-text-primary)]">
              {entry.deposit ? entry.deposit.toFixed(2) : ""}
            </td>
            <td className="border-l text-center border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-[var(--color-text-primary)]">
              {entry.reconcileStatus}
            </td>
            <td className="p-2 border-l border-l-dotted border-l-[var(--color-divider-tertiary)] text-[13px] text-right align-top font-medium text-[var(--color-text-global)]">
              {entry.runningBalance.toFixed(2)}
            </td>
          </tr>
          <tr
            className={`cursor-pointer border-b border-[var(--color-divider-tertiary)] bg-[var(--color-table-row-secondary)] group-hover:bg-[var(--color-table-row-secondary-hover)] ${batchSelectedIds.has(entry.id) ? batchSelectedRowClass : ""}`}
            onClick={() => activateRow(entry)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              activateRow(entry);
            }}
            role="button"
            tabIndex={0}
          >
            <td className="p-2 text-[13px] align-top text-[var(--color-icon-secondary)]">
              {isBatchMode ? (
                <input
                  type="checkbox"
                  checked={batchSelectedIds.has(entry.id)}
                  disabled={!isBatchSelectable(entry)}
                  title={batchLockedReason(entry) ?? undefined}
                  aria-label={`Select transaction ${entry.refNumber || entry.date}`}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => toggleBatchEntry(entry)}
                />
              ) : (
                <>&nbsp;</>
              )}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-[var(--color-icon-secondary)]">
              {formatTransactionTypeLabel(entry.transactionType)}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-[var(--color-icon-secondary)]">
              {entry.accountLabel ?? ""}
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] align-top text-[var(--color-icon-secondary)]">
              &nbsp;
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-right align-top text-[var(--color-icon-secondary)]">
              &nbsp;
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-right align-top text-[var(--color-icon-secondary)]">
              &nbsp;
            </td>
            <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-[13px] text-center align-top text-[var(--color-icon-secondary)]">
              &nbsp;
            </td>
            <td className="p-2 border-l border-l-dotted border-l-[var(--color-divider-tertiary)] text-[13px] text-right align-top text-[var(--color-icon-secondary)]">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <div ref={topRef} />
      <TablePagination
        totalItems={filteredEntries.length}
        currentPage={filteredEntries.length > 0 ? currentPage : 0}
        totalPages={totalPages}
        start={paginationStart}
        end={paginationEnd}
        onPageChange={setCurrentPage}
      />
      <div className="register-table relative overflow-visible bg-[var(--color-container-background-primary)]">
      <div className="action-bar flex h-[45px] items-center justify-between border-b border-[var(--color-divider-tertiary)] px-4">
        <div className="relative flex items-center gap-1">
          <button
            ref={filterButtonRef}
            type="button"
            className="flex h-full items-center gap-1 text-sm text-[var(--color-icon-muted)] hover:text-[var(--color-icon-secondary)]"
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
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-container-border-secondary)] bg-[var(--color-container-background-primary)] px-2 py-0.5 text-[13px] text-[var(--color-text-primary)]"
                >
                  {chip.label}
                  <button
                    type="button"
                    className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-primary)]"
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
          <button
            type="button"
            className="ml-3 text-[13px] text-[var(--color-link-text)] hover:underline"
            onClick={resetBatch}
          >
            Reset Batch Buttons
          </button>
          <button
            type="button"
            className="ml-3 text-[13px] text-[var(--color-link-text)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)] disabled:no-underline"
            onClick={jumpToLast}
            disabled={!lastTouchedEntryId}
          >
            Jump To Last
          </button>
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
        <div className="flex h-full items-center gap-4 text-[var(--color-icon-muted)]">
          <Tooltip label="Print" side="bottom">
            <IconButton icon={Printer} label="Print" onClick={handlePrintRegister} />
          </Tooltip>
          <Tooltip label="Export" side="bottom">
            <IconButton icon={Download} label="Export" onClick={handleExportRegister} />
          </Tooltip>
          <Tooltip label="Import" side="bottom">
            <span className="relative inline-flex">
              <IconButton icon={FileUp} label="Import" onClick={onOpenImport} />
              {savedImportRowCount > 0 ? (
                <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-ui-primary)] px-1 text-[10px] font-medium leading-none text-white">
                  {savedImportRowCount}
                </span>
              ) : null}
            </span>
          </Tooltip>
          <Tooltip label="Journal Entry" side="bottom">
            <IconButton icon={BookOpenText} label="New Journal Entry" onClick={onOpenJournalEntry} />
          </Tooltip>
          <Tooltip label="Manage .bean file" side="bottom">
            <Link
              href="/settings/ledger"
              className="flex h-full items-center hover:text-[var(--color-icon-secondary)]"
              aria-label="Manage .bean file"
            >
              <Database className="h-[18px] w-[18px]" aria-hidden="true" />
            </Link>
          </Tooltip>
          <div className="relative flex h-full items-center" data-settings-popover-root>
            <Tooltip label="Settings" side="bottom">
              <IconButton
                icon={Settings}
                label="Settings"
                onClick={() => setIsSettingsPopoverOpen((current) => !current)}
              />
            </Tooltip>
            {isSettingsPopoverOpen ? (
              <div className="dgrid-03 absolute">
                <div className="dgrid-hider-menu">
                  <div className="hiderMenuConnector" />
                  <div className="hiderMenuContainer">
                  <SelectField
                    label="Rows"
                    value={String(rowsPerPage)}
                    onChange={(value) => {
                      const nextRows = Number(value);
                      if (!Number.isFinite(nextRows)) return;
                      setRowsPerPage(nextRows);
                      setCurrentPage(1);
                      setIsSettingsPopoverOpen(false);
                    }}
                    options={REGISTER_ROWS_PER_PAGE_OPTIONS.map((option) => ({
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

      <RegisterTableHeader
        batch={{
          active: isBatchMode,
          selectedCount: selectedBatchEntries.length,
          selectableCount: selectableEntries.length,
          onStart: startBatch,
          onEdit: () => setIsChoosingBatchFields(true),
          onDelete: () => void deleteBatch(),
          onToggleSelectAll: toggleSelectAllBatch
        }}
      />

      <div className="content-table">
        <div className="actions-quickadd">
          <ActionToolbar
            availableTransactionTypes={availableTransactionTypes}
            selectedTransactionType={selectedTransactionType}
            onAddSelectedTransaction={onAddSelectedTransaction}
            onSelectTransactionType={onSelectTransactionType}
          />
        </div>

        {isBatchEditing ? (
          <BatchEditRow
            fields={batchFields}
            values={batchValues}
            selectedCount={selectedBatchEntries.length}
            payeeOptions={payeeOptions}
            accountOptions={accountOptions}
            error={batchError}
            isApplying={isApplyingBatch}
            onChange={(patch) => {
              setBatchValues((current) => ({ ...current, ...patch }));
              setBatchError(null);
            }}
            onChooseFields={() => setIsChoosingBatchFields(true)}
            onConfirm={() => void confirmBatchEdit()}
            onCancel={() => {
              setIsBatchEditing(false);
              setBatchError(null);
            }}
          />
        ) : null}

        {draftTransaction && !isBatchEditing ? (
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
            onOpenAccountModal={() => openAccountModal("draft")}
            isSplitMode={isSplitMode}
            draftSplits={draftSplits}
            onToggleSplitMode={onToggleSplitMode}
            onAddSplitLine={onAddSplitLine}
            onRemoveSplitLine={onRemoveSplitLine}
            onUpdateSplitLine={onUpdateSplitLine}
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
                          isPaymentDisabled={REGISTER_INFLOW_ROW_TYPES.has(selectedEntry.transactionType)}
                          isDepositDisabled={REGISTER_OUTFLOW_ROW_TYPES.has(selectedEntry.transactionType)}
                          onEditorChange={(field, value) => setEditor((current) => ({ ...current, [field]: value }))}
                          onReconcileCycle={cycleEditorReconcileStatus}
                          onOpenPayeeModal={() => openPayeeModal("row")}
                          onOpenAccountModal={() => openAccountModal("row")}
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
        onBackToTop={() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
      />
      {/**
       * Aqui
       */}
      <BatchFieldsModal
        open={isChoosingBatchFields}
        selectedCount={selectedBatchEntries.length}
        fields={batchFields}
        onChange={setBatchFields}
        onClose={() => setIsChoosingBatchFields(false)}
        onContinue={() => {
          setIsChoosingBatchFields(false);
          setIsBatchEditing(true);
          setBatchError(null);
        }}
      />
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
      <AddAccountModal
        open={isAccountModalOpen}
        accounts={accounts}
        onClose={() => setIsAccountModalOpen(false)}
        onSave={async (input) => {
          const created = await onCreateAccount(input);
          if (accountModalTarget === "draft" && draftTransaction) {
            onDraftFieldChange("accountTypeId", created.id);
          }
          if (accountModalTarget === "row") {
            setEditor((current) => ({ ...current, accountTypeId: created.id }));
          }
          return created;
        }}
      />
    </>
  );
}
