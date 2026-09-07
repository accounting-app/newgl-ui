"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MessageSquarePlus, Printer, Settings, SlidersHorizontal, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, useLocalCollection, usePersistedJSON } from "@/lib/local-store/use-local-collection";
import { useBills } from "@/lib/hooks/use-bills";
import { useVendors } from "@/lib/hooks/use-vendors";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, Transaction, TransactionType } from "@/modules/accounting/domain/models";
import { TransactionFormModal } from "@/components/expenses-bills/transaction-form-modal";
import type { TxnFormType } from "@/components/expenses-bills/transaction-form-modal";
import { PayBillsModal } from "@/components/expenses-bills/pay-bills-modal";
import { PrintChecksSetupModal } from "@/components/expenses-bills/print-checks-setup-modal";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function signedImpact(account: Account, type: "DEBIT" | "CREDIT", amount: number): number {
  if (DEBIT_NORMAL_CATEGORIES.has(account.category)) return type === "DEBIT" ? amount : -amount;
  return type === "CREDIT" ? amount : -amount;
}

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  CHECK: "Check",
  DEPOSIT: "Deposit",
  SALES_RECEIPT: "Sales receipt",
  RECEIVE_PAYMENT: "Payment",
  BILL_PAYMENT: "Bill payment",
  REFUND: "Refund",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  JOURNAL_ENTRY: "Journal entry"
};

// Matches the reference's exact "All transactions" filter list, not a raw
// dump of every TransactionType (which included Deposit/Sales receipt/
// Transfer/Journal entry -- not things that belong in an *expense*
// transactions filter -- and was missing Bill/Recently paid/Credit card
// payment/Expense (Receipt reminder)). Values with no real TransactionType
// behind them (Bill, Recently paid, Credit card payment, the receipt-
// reminder variant of Expense) are honestly non-matching -- selecting one
// filters to zero rows rather than mislabeling other data as that type,
// since none of those concepts exist in this app yet.
const TRANSACTION_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All transactions" },
  { value: "EXPENSE", label: "Expense" },
  { value: "BILL", label: "Bill" },
  { value: "BILL_PAYMENT", label: "Bill payment" },
  { value: "CHECK", label: "Check" },
  { value: "RECENTLY_PAID", label: "Recently paid" },
  { value: "CREDIT_CARD_PAYMENT", label: "Credit card payment" },
  { value: "EXPENSE_RECEIPT_REMINDER", label: "Expense (Receipt reminder)" }
];

const NEW_TRANSACTION_ITEMS: { type: TxnFormType; label: string }[] = [
  { type: "BILL", label: "Bill" },
  { type: "EXPENSE", label: "Expense" },
  { type: "CHECK", label: "Check" },
  { type: "VENDOR_CREDIT", label: "Vendor credit" },
  { type: "CREDIT_CARD_CREDIT", label: "Credit card credit" }
];

type ColumnId = "date" | "type" | "no" | "payee" | "class" | "location" | "project" | "status" | "method" | "source" | "category" | "memo";
const COLUMN_ORDER: ColumnId[] = ["date", "type", "no", "payee", "class", "location", "project", "status", "method", "source", "category", "memo"];
const COLUMN_LABELS: Record<ColumnId, string> = {
  date: "Date",
  type: "Type",
  no: "No.",
  payee: "Payee",
  class: "Class",
  location: "Location",
  project: "Project",
  status: "Status",
  method: "Method",
  source: "Source",
  category: "Category",
  memo: "Memo"
};
const DEFAULT_COLUMNS: ColumnId[] = ["date", "type", "no", "payee", "category"];

type DateRange = "12m" | "ytd" | "all";

// Real transaction data (this app already tracks it), filtered to expense
// postings -- unlike Vendors/Bills/Mileage, this doesn't need a new
// backend concept. Vendor tagging is still local-only (vendors themselves
// are Phase 1 local data), and the New transaction / Print Checks flows
// are UI-only for now per the user's direction -- see
// transaction-form-modal.tsx's comment for why Save doesn't post yet.
export function ExpenseTransactionsPage() {
  const { activeCompany } = useCompany();
  const services = useMemo(() => getServiceContainer(), []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([services.transactionService.listTransactions({ status: "POSTED" }), services.accountService.listAccounts()])
      .then(([txns, accts]) => {
        setTransactions(txns);
        setAccounts(accts);
      })
      .finally(() => setLoading(false));
  }, [services]);

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const tagsKey = activeCompany ? companyScopedKey(activeCompany.name, "expense-transaction-vendor-tags") : null;
  const { items: vendors } = useVendors();
  const { items: tagRows, add: addTagRow, update: updateTagRow } = useLocalCollection<{ id: string; vendorId: string }>(
    tagsKey ?? "newgl:phase1:pending:tags"
  );
  const tags = useMemo(() => Object.fromEntries(tagRows.map((row) => [row.id, row.vendorId])), [tagRows]);

  function setVendorTag(transactionId: string, vendorId: string) {
    const existing = tagRows.find((row) => row.id === transactionId);
    if (!vendorId) return;
    if (existing) updateTagRow(transactionId, { vendorId });
    else addTagRow({ id: transactionId, vendorId });
  }

  const { items: bills } = useBills();
  const openBillCount = useMemo(() => bills.filter((b) => b.status === "OPEN").length, [bills]);

  // -- Toolbar: transaction-type filter, date range, real Filter panel --
  const [typeFilter, setTypeFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>("12m");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!filterOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  const rangeStart = useMemo(() => {
    const now = new Date();
    if (dateRange === "12m") return new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()).toISOString().slice(0, 10);
    if (dateRange === "ytd") return `${now.getFullYear()}-01-01`;
    return "0000-01-01";
  }, [dateRange]);

  const categoryOptions = useMemo(
    () => accounts.filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v.id, label: v.name })), [vendors]);

  const expenseRows = useMemo(() => {
    return transactions
      .filter((txn) => txn.transactionDate >= rangeStart)
      .filter((txn) => typeFilter === "" || txn.type === typeFilter)
      .map((txn) => {
        let expenseAmount = 0;
        let categoryAccountId: string | undefined;
        let categoryAmount = 0;
        txn.postings.forEach((posting) => {
          const account = accountById.get(posting.accountId);
          if (!account || (account.category !== "EXPENSE" && account.category !== "OTHER_EXPENSE")) return;
          const impact = signedImpact(account, posting.type, posting.amount);
          expenseAmount += impact;
          if (impact > categoryAmount) {
            categoryAmount = impact;
            categoryAccountId = account.id;
          }
        });
        return { txn, expenseAmount, categoryAccountId };
      })
      .filter(({ expenseAmount }) => expenseAmount > 0)
      .filter(({ categoryAccountId }) => categoryFilter === "" || categoryAccountId === categoryFilter)
      .filter(({ txn }) => vendorFilter === "" || tags[txn.id] === vendorFilter)
      .sort((a, b) => b.txn.transactionDate.localeCompare(a.txn.transactionDate));
  }, [transactions, accountById, rangeStart, typeFilter, categoryFilter, vendorFilter, tags]);

  function resetFilters() {
    setCategoryFilter("");
    setVendorFilter("");
    setDateRange("12m");
  }

  // -- Columns panel (persisted per company) --
  const columnsKey = activeCompany ? companyScopedKey(activeCompany.name, "expense-transactions-columns") : "newgl:phase1:pending:expense-transactions-columns";
  const [visibleColumns, setVisibleColumns] = usePersistedJSON<ColumnId[]>(columnsKey, DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!columnsOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node)) setColumnsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnsOpen]);
  function toggleColumn(id: ColumnId, checked: boolean) {
    setVisibleColumns((current) => (checked ? [...current, id] : current.filter((c) => c !== id)));
  }

  function columnValue(id: ColumnId, row: { txn: Transaction; categoryAccountId?: string }): string {
    switch (id) {
      case "date":
        return row.txn.transactionDate;
      case "type":
        return TRANSACTION_TYPE_LABELS[row.txn.type];
      case "no":
        return row.txn.referenceNumber || "--";
      case "payee":
        return row.txn.payee || "--";
      case "status":
        return row.txn.status.charAt(0) + row.txn.status.slice(1).toLowerCase();
      case "category":
        return row.categoryAccountId ? accountById.get(row.categoryAccountId)?.name ?? "--" : "--";
      case "memo":
        return row.txn.memo || "--";
      default:
        // Class/Location/Project/Method/Source aren't modeled yet -- an
        // honest "--" rather than fabricated data.
        return "--";
    }
  }

  // -- New transaction / Print Checks menus + modals --
  const [newTxnMenuOpen, setNewTxnMenuOpen] = useState(false);
  const newTxnMenuRef = useRef<HTMLDivElement>(null);
  const [printChecksMenuOpen, setPrintChecksMenuOpen] = useState(false);
  const printChecksMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newTxnMenuRef.current && !newTxnMenuRef.current.contains(event.target as Node)) setNewTxnMenuOpen(false);
      if (printChecksMenuRef.current && !printChecksMenuRef.current.contains(event.target as Node)) setPrintChecksMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [activeFormType, setActiveFormType] = useState<TxnFormType | null>(null);
  const [showPayBills, setShowPayBills] = useState(false);
  const [showPrintSetup, setShowPrintSetup] = useState(false);

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Expenses</h1>
        <div className="flex items-center gap-4">
          <button type="button" disabled title="Not available yet" className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Give feedback
          </button>
          <button
            type="button"
            disabled
            title="Not available yet"
            className="cursor-not-allowed rounded-full border border-[var(--color-ui-primary)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]"
          >
            Purchase notifications
          </button>
          <div className="relative" ref={printChecksMenuRef}>
            <div className="flex overflow-hidden rounded-full">
              <Button className="rounded-r-none" onClick={() => setShowPrintSetup(true)}>
                Print Checks
              </Button>
              <Button className="rounded-l-none border-l border-l-white/20 px-2" aria-label="More print-checks options" onClick={() => setPrintChecksMenuOpen((v) => !v)}>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {printChecksMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setPrintChecksMenuOpen(false);
                    setShowPayBills(true);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                >
                  Pay bills
                </button>
                <button type="button" disabled title="Not available yet" className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-sm text-[var(--color-text-disabled)]">
                  Order checks
                </button>
              </div>
            ) : null}
          </div>
          <div className="relative" ref={newTxnMenuRef}>
            <div className="flex overflow-hidden rounded-full">
              <Button className="rounded-r-none" onClick={() => setNewTxnMenuOpen((v) => !v)}>
                New transaction
              </Button>
              <Button className="rounded-l-none border-l border-l-white/20 px-2" aria-label="More new-transaction options" onClick={() => setNewTxnMenuOpen((v) => !v)}>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {newTxnMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                {NEW_TRANSACTION_ITEMS.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => {
                      setNewTxnMenuOpen(false);
                      setActiveFormType(item.type);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-48">
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              options={TRANSACTION_TYPE_FILTER_OPTIONS}
              placeholder="All transactions"
              allowCustomValue={false}
              optionSize="sm"
            />
          </div>
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-button-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)]"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
              Filter
            </button>
            {filterOpen ? (
              <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4 shadow-lg">
                <div className="mb-3 flex flex-col gap-1">
                  <span className="text-xs text-[var(--color-icon-secondary)]">Status</span>
                  <Select value="" onChange={() => {}} options={[{ value: "", label: "All statuses" }]} placeholder="All statuses" allowCustomValue={false} optionSize="sm" />
                </div>
                <div className="mb-3 flex flex-col gap-1">
                  <span className="text-xs text-[var(--color-icon-secondary)]">Delivery method</span>
                  <Select value="" onChange={() => {}} options={[{ value: "", label: "Any" }]} placeholder="Any" allowCustomValue={false} optionSize="sm" />
                </div>
                <div className="mb-3 flex flex-col gap-1">
                  <span className="text-xs text-[var(--color-icon-secondary)]">Date</span>
                  <Select
                    value={dateRange}
                    onChange={(v) => setDateRange(v as DateRange)}
                    options={[
                      { value: "12m", label: "Last 12 months" },
                      { value: "ytd", label: "This year" },
                      { value: "all", label: "All time" }
                    ]}
                    placeholder="Date range"
                    allowCustomValue={false}
                    optionSize="sm"
                  />
                </div>
                <div className="mb-3 flex flex-col gap-1">
                  <span className="text-xs text-[var(--color-icon-secondary)]">Payee</span>
                  <Select value={vendorFilter} onChange={setVendorFilter} options={[{ value: "", label: "All" }, ...vendorOptions]} placeholder="All" allowCustomValue={false} optionSize="sm" />
                </div>
                <div className="mb-3 flex flex-col gap-1">
                  <span className="text-xs text-[var(--color-icon-secondary)]">Category</span>
                  <Select value={categoryFilter} onChange={setCategoryFilter} options={[{ value: "", label: "All" }, ...categoryOptions]} placeholder="All" allowCustomValue={false} optionSize="sm" />
                </div>
                <div className="mb-4 flex flex-col gap-1">
                  <span className="text-xs text-[var(--color-icon-secondary)]">Project</span>
                  <Select value="" onChange={() => {}} options={[{ value: "", label: "All" }]} placeholder="All" allowCustomValue={false} optionSize="sm" />
                </div>
                <div className="flex justify-between">
                  <Button variant="secondary" size="sm" onClick={resetFilters}>
                    Reset
                  </Button>
                  <Button size="sm" onClick={() => setFilterOpen(false)}>
                    Apply
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className="rounded-full bg-[var(--color-container-background-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            Dates: <span className="font-semibold text-[var(--color-text-global)]">{dateRange === "12m" ? "Last 12 months" : dateRange === "ytd" ? "This year" : "All time"}</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon={Share} label="Export" size="sm" />
          <IconButton icon={Printer} label="Print" size="sm" />
          <div className="relative" ref={columnsRef}>
            <IconButton icon={Settings} label="Columns" size="sm" onClick={() => setColumnsOpen((v) => !v)} />
            {columnsOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4 shadow-lg">
                <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Columns</p>
                <div className="flex flex-col gap-2">
                  {COLUMN_ORDER.map((id) => (
                    <label key={id} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                      <input type="checkbox" checked={visibleColumns.includes(id)} onChange={(e) => toggleColumn(id, e.target.checked)} className="h-4 w-4 accent-[var(--color-action-standard)]" />
                      {COLUMN_LABELS[id]}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              {COLUMN_ORDER.filter((id) => visibleColumns.includes(id)).map((id, index) => (
                <th key={id} className={`px-2 pb-[5px] pt-2 text-left align-middle ${index > 0 ? "border-l-custom" : ""}`}>
                  {COLUMN_LABELS[id]}
                </th>
              ))}
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Amount</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Vendor tag</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {loading ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="px-3 py-10 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : expenseRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} className="px-3 py-16 text-center">
                  <p className="text-2xl font-semibold text-[var(--color-text-global)]">No expenses found</p>
                  <p className="mt-2 text-sm text-[var(--color-text-disabled)]">Try to change some filters to see more results.</p>
                </td>
              </tr>
            ) : (
              expenseRows.map((row) => (
                <tr key={row.txn.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  {COLUMN_ORDER.filter((id) => visibleColumns.includes(id)).map((id, index) => (
                    <td key={id} className={`p-2 align-top text-[13px] text-[var(--color-text-primary)] ${index > 0 ? "border-l border-l-dotted border-l-[var(--color-divider-tertiary)]" : ""}`}>
                      {columnValue(id, row)}
                    </td>
                  ))}
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] font-medium text-[var(--color-text-global)]">
                    {formatMoney(row.expenseAmount)}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] w-44 p-2 align-top">
                    <Select
                      value={tags[row.txn.id] ?? ""}
                      onChange={(value) => setVendorTag(row.txn.id, value)}
                      options={[{ value: "", label: "None" }, ...vendorOptions]}
                      placeholder="None"
                      allowCustomValue={false}
                      optionSize="sm"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {activeFormType ? (
        <TransactionFormModal type={activeFormType} accounts={accounts} vendors={vendors} nextCheckNumber={9} onClose={() => setActiveFormType(null)} />
      ) : null}
      {showPayBills ? (
        <PayBillsModal
          accounts={accounts}
          openBillCount={openBillCount}
          onEnterNewBill={() => {
            setShowPayBills(false);
            setActiveFormType("BILL");
          }}
          onClose={() => setShowPayBills(false)}
        />
      ) : null}
      {showPrintSetup ? <PrintChecksSetupModal onClose={() => setShowPrintSetup(false)} /> : null}
    </>
  );
}
