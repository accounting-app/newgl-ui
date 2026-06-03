import { useEffect, useMemo, useRef, useState } from "react";
import type { RegisterEntry } from "@/modules/accounting/domain/models";
import { getAllBankRegisterTransactionTypes } from "@/modules/accounting/presentation/transaction-type-policy";
import type { SelectFieldOption } from "@/components/bank-register/select-field";

type ReconcileFilterValue = "ALL" | "RECONCILED" | "CLEAR" | "NO_STATUS" | "NO_RECONCILED";
type DateFilterValue =
  | "ALL_DATES"
  | "CUSTOM"
  | "TODAY"
  | "YESTERDAY"
  | "THIS_WEEK"
  | "THIS_MONTH"
  | "THIS_QUARTER"
  | "THIS_YEAR"
  | "LAST_WEEK"
  | "LAST_MONTH"
  | "LAST_QUARTER"
  | "LAST_YEAR";

type RegisterFilterState = {
  find: string;
  reconcileStatus: ReconcileFilterValue;
  transactionType: string;
  payee: string;
  datePreset: DateFilterValue;
  from: string;
  to: string;
};

type ActiveFilterChipKey =
  | "find"
  | "reconcileStatus"
  | "transactionType"
  | "payee"
  | "datePreset"
  | "from"
  | "to";

type ActiveFilterChip = {
  key: ActiveFilterChipKey;
  label: string;
};

const DATE_FILTER_OPTIONS: SelectFieldOption[] = [
  { value: "ALL_DATES", label: "All dates" },
  { value: "CUSTOM", label: "Custom" },
  { value: "TODAY", label: "Today" },
  { value: "YESTERDAY", label: "Yesterday" },
  { value: "THIS_WEEK", label: "This week" },
  { value: "THIS_MONTH", label: "This month" },
  { value: "THIS_QUARTER", label: "This quarter" },
  { value: "THIS_YEAR", label: "This year" },
  { value: "LAST_WEEK", label: "Last week" },
  { value: "LAST_MONTH", label: "Last month" },
  { value: "LAST_QUARTER", label: "Last quarter" },
  { value: "LAST_YEAR", label: "Last year" }
];

const RECONCILE_FILTER_OPTIONS: SelectFieldOption[] = [
  { value: "ALL", label: "All" },
  { value: "RECONCILED", label: "Reconciled" },
  { value: "CLEAR", label: "Clear" },
  { value: "NO_STATUS", label: "No status" },
  { value: "NO_RECONCILED", label: "No reconciled" }
];

const INITIAL_FILTER_STATE: RegisterFilterState = {
  find: "",
  reconcileStatus: "ALL",
  transactionType: "ALL",
  payee: "ALL",
  datePreset: "ALL_DATES",
  from: "",
  to: ""
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function withDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function resolveDateRange(preset: DateFilterValue, reference = new Date()): { from: string; to: string } {
  const today = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());

  if (preset === "ALL_DATES" || preset === "CUSTOM") return { from: "", to: "" };
  if (preset === "TODAY") {
    const value = toIsoDate(today);
    return { from: value, to: value };
  }
  if (preset === "YESTERDAY") {
    const yesterday = withDays(today, -1);
    const value = toIsoDate(yesterday);
    return { from: value, to: value };
  }

  const startOfWeek = withDays(today, -((today.getDay() + 6) % 7));
  const endOfWeek = withDays(startOfWeek, 6);
  if (preset === "THIS_WEEK") return { from: toIsoDate(startOfWeek), to: toIsoDate(endOfWeek) };
  if (preset === "LAST_WEEK") {
    const start = withDays(startOfWeek, -7);
    return { from: toIsoDate(start), to: toIsoDate(withDays(start, 6)) };
  }

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  if (preset === "THIS_MONTH") return { from: toIsoDate(startOfMonth), to: toIsoDate(endOfMonth) };
  if (preset === "LAST_MONTH") {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }

  const quarter = Math.floor(today.getMonth() / 3);
  const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
  const endOfQuarter = new Date(today.getFullYear(), quarter * 3 + 3, 0);
  if (preset === "THIS_QUARTER") return { from: toIsoDate(startOfQuarter), to: toIsoDate(endOfQuarter) };
  if (preset === "LAST_QUARTER") {
    const start = new Date(today.getFullYear(), quarter * 3 - 3, 1);
    const end = new Date(today.getFullYear(), quarter * 3, 0);
    return { from: toIsoDate(start), to: toIsoDate(end) };
  }

  if (preset === "THIS_YEAR") {
    return { from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to: toIsoDate(new Date(today.getFullYear(), 11, 31)) };
  }
  return {
    from: toIsoDate(new Date(today.getFullYear() - 1, 0, 1)),
    to: toIsoDate(new Date(today.getFullYear() - 1, 11, 31))
  };
}

function parseAmountCondition(find: string): { operator: "lt" | "gt" | "eq"; amount: number } | null {
  const value = find.trim();
  if (!value) return null;
  const greater = value.match(/^>\s*\$?\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (greater) return { operator: "gt", amount: Number(greater[1]) };
  const less = value.match(/^<\s*\$?\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (less) return { operator: "lt", amount: Number(less[1]) };
  const exact = value.match(/^\$?\s*([0-9]+(?:\.[0-9]+)?)$/);
  if (exact) return { operator: "eq", amount: Number(exact[1]) };
  return null;
}

type UseRegisterFiltersParams = {
  entries: RegisterEntry[];
  payeeOptions: SelectFieldOption[];
  formatTransactionTypeLabel: (transactionType: RegisterEntry["transactionType"]) => string;
};

export function useRegisterFilters({ entries, payeeOptions, formatTransactionTypeLabel }: UseRegisterFiltersParams) {
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<RegisterFilterState>(INITIAL_FILTER_STATE);
  const [appliedFilter, setAppliedFilter] = useState<RegisterFilterState>(INITIAL_FILTER_STATE);
  const [isFromDateActive, setIsFromDateActive] = useState(false);
  const [isToDateActive, setIsToDateActive] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement | null>(null);

  const transactionTypeOptions = useMemo<SelectFieldOption[]>(
    () => [{ value: "ALL", label: "All" }, ...getAllBankRegisterTransactionTypes().map((item) => ({ value: item.id, label: item.label }))],
    []
  );
  const payeeFilterOptions = useMemo<SelectFieldOption[]>(
    () => [{ value: "ALL", label: "All" }, ...payeeOptions.map((option) => ({ value: option.value, label: option.label }))],
    [payeeOptions]
  );

  const filteredEntries = useMemo(() => {
    const amountCondition = parseAmountCondition(appliedFilter.find);
    const findText = appliedFilter.find.trim().toLowerCase();

    return entries.filter((entry) => {
      if (appliedFilter.reconcileStatus === "RECONCILED" && entry.reconcileStatus !== "R") return false;
      if (appliedFilter.reconcileStatus === "CLEAR" && entry.reconcileStatus !== "C") return false;
      if (appliedFilter.reconcileStatus === "NO_STATUS" && entry.reconcileStatus !== "") return false;
      if (appliedFilter.reconcileStatus === "NO_RECONCILED" && entry.reconcileStatus === "R") return false;
      if (appliedFilter.transactionType !== "ALL" && entry.transactionType !== appliedFilter.transactionType) return false;
      if (appliedFilter.payee !== "ALL" && (entry.payee ?? "") !== appliedFilter.payee) return false;
      if (appliedFilter.from && entry.date < appliedFilter.from) return false;
      if (appliedFilter.to && entry.date > appliedFilter.to) return false;
      if (!findText) return true;

      if (amountCondition) {
        const amount = entry.payment ?? entry.deposit ?? 0;
        if (amountCondition.operator === "gt") return amount > amountCondition.amount;
        if (amountCondition.operator === "lt") return amount < amountCondition.amount;
        return amount === amountCondition.amount;
      }

      const entryTypeLabel = formatTransactionTypeLabel(entry.transactionType).toLowerCase();
      return (
        entry.memo?.toLowerCase().includes(findText) ||
        entry.refNumber?.toLowerCase().includes(findText) ||
        entry.payee?.toLowerCase().includes(findText) ||
        entry.accountLabel?.toLowerCase().includes(findText) ||
        entryTypeLabel.includes(findText)
      );
    });
  }, [appliedFilter, entries, formatTransactionTypeLabel]);

  const hasActiveFilters = useMemo(
    () =>
      appliedFilter.find !== "" ||
      appliedFilter.reconcileStatus !== "ALL" ||
      appliedFilter.transactionType !== "ALL" ||
      appliedFilter.payee !== "ALL" ||
      appliedFilter.from !== "" ||
      appliedFilter.to !== "",
    [appliedFilter]
  );

  const reconcileFilterLabelByValue = useMemo(
    () => new Map(RECONCILE_FILTER_OPTIONS.map((option) => [option.value, option.label])),
    []
  );
  const dateFilterLabelByValue = useMemo(
    () => new Map(DATE_FILTER_OPTIONS.map((option) => [option.value, option.label])),
    []
  );
  const transactionTypeLabelByValue = useMemo(
    () => new Map(transactionTypeOptions.map((option) => [option.value, option.label])),
    [transactionTypeOptions]
  );
  const payeeLabelByValue = useMemo(
    () => new Map(payeeFilterOptions.map((option) => [option.value, option.label])),
    [payeeFilterOptions]
  );

  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];
    if (appliedFilter.transactionType !== "ALL") {
      chips.push({
        key: "transactionType",
        label: transactionTypeLabelByValue.get(appliedFilter.transactionType) ?? appliedFilter.transactionType
      });
    }
    if (appliedFilter.find.trim()) chips.push({ key: "find", label: appliedFilter.find.trim() });
    if (appliedFilter.reconcileStatus !== "ALL") {
      chips.push({
        key: "reconcileStatus",
        label: reconcileFilterLabelByValue.get(appliedFilter.reconcileStatus) ?? appliedFilter.reconcileStatus
      });
    }
    if (appliedFilter.payee !== "ALL") {
      chips.push({ key: "payee", label: payeeLabelByValue.get(appliedFilter.payee) ?? appliedFilter.payee });
    }
    if (appliedFilter.datePreset !== "ALL_DATES") {
      chips.push({
        key: "datePreset",
        label: dateFilterLabelByValue.get(appliedFilter.datePreset) ?? appliedFilter.datePreset
      });
    }
    if (appliedFilter.from) chips.push({ key: "from", label: `From ${appliedFilter.from}` });
    if (appliedFilter.to) chips.push({ key: "to", label: `To ${appliedFilter.to}` });
    return chips;
  }, [appliedFilter, dateFilterLabelByValue, payeeLabelByValue, reconcileFilterLabelByValue, transactionTypeLabelByValue]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const clickedPopover = filterPopoverRef.current?.contains(target);
      const clickedButton = filterButtonRef.current?.contains(target);
      if (!clickedPopover && !clickedButton) setIsFilterPopoverOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleDatePresetChange(value: string) {
    const preset = value as DateFilterValue;
    if (preset === "CUSTOM") {
      setFilterDraft((current) => ({ ...current, datePreset: "CUSTOM" }));
      return;
    }
    const range = resolveDateRange(preset);
    setFilterDraft((current) => ({ ...current, datePreset: preset, from: range.from, to: range.to }));
  }

  function handleApplyFilters() {
    setAppliedFilter(filterDraft);
    setIsFilterPopoverOpen(false);
  }

  function handleResetFilters() {
    setFilterDraft(INITIAL_FILTER_STATE);
    setAppliedFilter(INITIAL_FILTER_STATE);
    setIsFromDateActive(false);
    setIsToDateActive(false);
    setIsFilterPopoverOpen(false);
  }

  function removeActiveFilterChip(key: ActiveFilterChipKey) {
    const nextFilter: RegisterFilterState = { ...appliedFilter };
    if (key === "find") nextFilter.find = "";
    if (key === "reconcileStatus") nextFilter.reconcileStatus = "ALL";
    if (key === "transactionType") nextFilter.transactionType = "ALL";
    if (key === "payee") nextFilter.payee = "ALL";
    if (key === "datePreset") {
      nextFilter.datePreset = "ALL_DATES";
      nextFilter.from = "";
      nextFilter.to = "";
      setIsFromDateActive(false);
      setIsToDateActive(false);
    }
    if (key === "from") {
      nextFilter.from = "";
      nextFilter.datePreset = "CUSTOM";
      setIsFromDateActive(false);
    }
    if (key === "to") {
      nextFilter.to = "";
      nextFilter.datePreset = "CUSTOM";
      setIsToDateActive(false);
    }
    setAppliedFilter(nextFilter);
    setFilterDraft(nextFilter);
  }

  function handleFindChange(value: string) {
    setFilterDraft((current) => ({ ...current, find: value }));
  }
  function handleReconcileStatusChange(value: string) {
    setFilterDraft((current) => ({ ...current, reconcileStatus: value as ReconcileFilterValue }));
  }
  function handleTransactionTypeChange(value: string) {
    setFilterDraft((current) => ({ ...current, transactionType: value }));
  }
  function handlePayeeChange(value: string) {
    setFilterDraft((current) => ({ ...current, payee: value }));
  }
  function handleFromFocus() {
    setIsFromDateActive(true);
  }
  function handleFromBlur() {
    if (!filterDraft.from) setIsFromDateActive(false);
  }
  function handleFromChange(value: string) {
    setFilterDraft((current) => ({ ...current, datePreset: "CUSTOM", from: value }));
  }
  function handleToFocus() {
    setIsToDateActive(true);
  }
  function handleToBlur() {
    if (!filterDraft.to) setIsToDateActive(false);
  }
  function handleToChange(value: string) {
    setFilterDraft((current) => ({ ...current, datePreset: "CUSTOM", to: value }));
  }

  return {
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
    reconcileFilterOptions: RECONCILE_FILTER_OPTIONS,
    dateFilterOptions: DATE_FILTER_OPTIONS,
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
  };
}
