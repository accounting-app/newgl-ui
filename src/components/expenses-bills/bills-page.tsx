"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, GripVertical, HelpCircle, MessageSquarePlus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, usePersistedJSON } from "@/lib/local-store/use-local-collection";
import { useVendors } from "@/lib/hooks/use-vendors";
import { useBills } from "@/lib/hooks/use-bills";
import type { Bill, BillStatus } from "@/lib/services/bills-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";
import { TransactionFormModal } from "@/components/expenses-bills/transaction-form-modal";
import { PayBillsModal } from "@/components/expenses-bills/pay-bills-modal";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABEL: Record<BillStatus, string> = { DRAFT: "For review", OPEN: "Unpaid", PAID: "Paid" };
const TABS: BillStatus[] = ["DRAFT", "OPEN", "PAID"];

type ColumnId = "source" | "vendor" | "billNo" | "billDate" | "category" | "dueDate" | "billAmount";
const COLUMN_LABELS: Record<ColumnId, string> = {
  source: "Source",
  vendor: "Vendor",
  billNo: "Bill No",
  billDate: "Bill Date",
  category: "Category",
  dueDate: "Due Date",
  billAmount: "Bill Amount"
};
const DEFAULT_COLUMN_ORDER: ColumnId[] = ["source", "vendor", "billNo", "billDate", "category", "dueDate", "billAmount"];
const SORTABLE_COLUMNS: ColumnId[] = ["vendor", "billNo", "billDate", "category", "dueDate", "billAmount"];
const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

type ListSettings = {
  columnOrder: ColumnId[];
  hiddenColumns: ColumnId[];
  sortKey: ColumnId;
  sortDir: "asc" | "desc";
  rowsPerPage: number;
  rowHeight: "comfortable" | "compact";
  alternateRowColor: boolean;
};
const DEFAULT_LIST_SETTINGS: ListSettings = {
  columnOrder: DEFAULT_COLUMN_ORDER,
  hiddenColumns: [],
  sortKey: "vendor",
  sortDir: "asc",
  rowsPerPage: 10,
  rowHeight: "comfortable",
  alternateRowColor: false
};

// Phase 1.5, Step 3: real persistence, and paying/entering a bill now
// posts a real beancount transaction (see @/lib/hooks/use-bills and
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md).
// The email-in banner other Accounting screens show ("Anyone can autofill
// receipts... by sending files to <address>") is intentionally left off
// here too, same as Receipts -- there's no real inbound-email pipeline
// behind it yet.
export function BillsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: vendors } = useVendors();
  const { items: bills, hydrated, add, update, pay, remove } = useBills();

  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  const categoryOptions = useMemo(
    () => accounts.filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const categoryNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const vendorOptions = useMemo(() => vendors.filter((v) => v.status === "ACTIVE").map((v) => ({ value: v.id, label: v.name })), [vendors]);
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [v.id, v.name])), [vendors]);

  const [tab, setTab] = useState<BillStatus>("DRAFT");
  const tabCounts = useMemo(() => Object.fromEntries(TABS.map((s) => [s, bills.filter((b) => b.status === s).length])), [bills]);
  const openBillCount = tabCounts.OPEN ?? 0;

  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [vendorFilter, setVendorFilter] = useState("");
  useEffect(() => {
    if (!filterOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) setFilterOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filterOpen]);

  // -- Edit form (real, existing capability) --
  const today = new Date().toISOString().slice(0, 10);
  const [showEditForm, setShowEditForm] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [categoryAccountId, setCategoryAccountId] = useState("");
  const [memo, setMemo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetEditForm() {
    setVendorId("");
    setBillNumber("");
    setBillDate(today);
    setDueDate(today);
    setAmount("");
    setCategoryAccountId("");
    setMemo("");
    setEditingId(null);
    setShowEditForm(false);
  }

  function startEdit(bill: Bill) {
    setEditingId(bill.id);
    setVendorId(bill.vendorId);
    setBillNumber(bill.billNumber ?? "");
    setBillDate(bill.billDate);
    setDueDate(bill.dueDate);
    setAmount(String(bill.amount));
    setCategoryAccountId(bill.categoryAccountId ?? "");
    setMemo(bill.memo ?? "");
    setShowEditForm(true);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!vendorId || !editingId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    try {
      await update(editingId, {
        vendorId,
        billNumber: billNumber.trim() || undefined,
        billDate,
        dueDate,
        amount: parsedAmount,
        categoryAccountId: categoryAccountId || undefined,
        memo: memo.trim() || undefined
      });
      toast({ variant: "success", title: "Bill updated" });
      resetEditForm();
    } catch (err) {
      toast({ variant: "error", title: "Could not update this bill", description: err instanceof Error ? err.message : undefined });
    }
  }

  // -- Mark paid: needs a payment account, so it opens a small dialog
  // rather than flipping status directly -- paying a bill posts a real
  // Dr Accounts Payable / Cr Cash-or-Bank transaction now (Phase 1.5,
  // Step 3), which requires knowing which bank/credit account to credit.
  const [payingBill, setPayingBill] = useState<Bill | null>(null);

  async function handleConfirmPay(paymentAccountId: string, paymentDate: string) {
    if (!payingBill) return;
    try {
      await pay(payingBill.id, { paymentAccountId, paymentDate });
      toast({ variant: "success", title: "Bill marked paid" });
      setPayingBill(null);
    } catch (err) {
      toast({ variant: "error", title: "Could not mark this bill paid", description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleDelete(bill: Bill) {
    try {
      await remove(bill.id);
      toast({ variant: "success", title: "Bill deleted" });
    } catch (err) {
      toast({ variant: "error", title: "Could not delete this bill", description: err instanceof Error ? err.message : undefined });
    }
  }

  // -- New bill (via the shared full-screen form, real save) + Pay bills --
  const [showNewBillModal, setShowNewBillModal] = useState(false);
  const [showPayBills, setShowPayBills] = useState(false);
  const [addBillMenuOpen, setAddBillMenuOpen] = useState(false);
  const addBillMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addBillMenuRef.current && !addBillMenuRef.current.contains(event.target as Node)) setAddBillMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -- Customize (sort/rows/columns), persisted per company --
  const settingsKey = activeCompany ? companyScopedKey(activeCompany.name, "bills-list-settings") : "newgl:phase1:pending:bills-list-settings";
  const [listSettings, setListSettings] = usePersistedJSON<ListSettings>(settingsKey, DEFAULT_LIST_SETTINGS);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const dragColumnRef = useRef<ColumnId | null>(null);

  function reorderColumn(targetId: ColumnId) {
    const draggedId = dragColumnRef.current;
    dragColumnRef.current = null;
    if (!draggedId || draggedId === targetId) return;
    setListSettings((current) => {
      const order = [...current.columnOrder];
      const from = order.indexOf(draggedId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return current;
      order.splice(from, 1);
      order.splice(to, 0, draggedId);
      return { ...current, columnOrder: order };
    });
  }
  function toggleColumn(id: ColumnId, checked: boolean) {
    setListSettings((current) => ({ ...current, hiddenColumns: checked ? current.hiddenColumns.filter((c) => c !== id) : [...current.hiddenColumns, id] }));
  }

  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [tab, vendorFilter, listSettings.rowsPerPage]);

  const sortedFilteredBills = useMemo(() => {
    const filtered = bills.filter((b) => b.status === tab && (vendorFilter === "" || b.vendorId === vendorFilter));
    const { sortKey, sortDir } = listSettings;
    const sorted = [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortKey === "vendor") diff = (vendorNameById.get(a.vendorId) ?? "").localeCompare(vendorNameById.get(b.vendorId) ?? "");
      else if (sortKey === "billNo") diff = (a.billNumber ?? "").localeCompare(b.billNumber ?? "");
      else if (sortKey === "billDate") diff = a.billDate.localeCompare(b.billDate);
      else if (sortKey === "category") diff = (categoryNameById.get(a.categoryAccountId ?? "") ?? "").localeCompare(categoryNameById.get(b.categoryAccountId ?? "") ?? "");
      else if (sortKey === "dueDate") diff = a.dueDate.localeCompare(b.dueDate);
      else if (sortKey === "billAmount") diff = a.amount - b.amount;
      return sortDir === "asc" ? diff : -diff;
    });
    return sorted;
  }, [bills, tab, vendorFilter, listSettings, vendorNameById, categoryNameById]);

  const total = useMemo(() => sortedFilteredBills.reduce((sum, b) => sum + b.amount, 0), [sortedFilteredBills]);
  const totalPages = Math.max(1, Math.ceil(sortedFilteredBills.length / listSettings.rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = sortedFilteredBills.length === 0 ? 0 : (currentPage - 1) * listSettings.rowsPerPage + 1;
  const pageEnd = Math.min(currentPage * listSettings.rowsPerPage, sortedFilteredBills.length);
  const pageRows = sortedFilteredBills.slice((currentPage - 1) * listSettings.rowsPerPage, currentPage * listSettings.rowsPerPage);

  const visibleColumns = listSettings.columnOrder.filter((id) => !listSettings.hiddenColumns.includes(id));
  const cellPadding = listSettings.rowHeight === "compact" ? "p-1" : "p-2";

  function columnValue(id: ColumnId, bill: Bill): string {
    switch (id) {
      case "source":
        return "Manual";
      case "vendor":
        return vendorNameById.get(bill.vendorId) ?? "Unknown vendor";
      case "billNo":
        return bill.billNumber || "--";
      case "billDate":
        return bill.billDate;
      case "category":
        return bill.categoryAccountId ? categoryNameById.get(bill.categoryAccountId) ?? "--" : "--";
      case "dueDate":
        return bill.dueDate;
      case "billAmount":
        return formatMoney(bill.amount);
    }
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Bills</h1>
        <div className="flex items-center gap-4">
          <button type="button" disabled title="Not available yet" className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Give feedback
          </button>
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)]">
            Manage email settings
          </button>
          <Button variant="secondary" onClick={() => setShowPayBills(true)}>
            Pay bills
          </Button>
          <div className="relative" ref={addBillMenuRef}>
            <div className="flex overflow-hidden rounded-full">
              <Button className="rounded-r-none" onClick={() => setShowNewBillModal(true)}>
                Add bill
              </Button>
              <Button className="rounded-l-none border-l border-l-white/20 px-2" aria-label="More add-bill options" onClick={() => setAddBillMenuOpen((v) => !v)}>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {addBillMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setAddBillMenuOpen(false);
                    setShowNewBillModal(true);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                >
                  Create bill
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-lg border border-[var(--color-divider-tertiary)] p-1">
          {TABS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setTab(status)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === status ? "bg-[var(--color-container-background-accent)] text-[var(--color-text-global)]" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
              }`}
            >
              {STATUS_LABEL[status]} {tabCounts[status] ? `(${tabCounts[status]})` : ""}
            </button>
          ))}
        </div>
        <button type="button" disabled title="Not available yet" className="flex cursor-not-allowed items-center gap-1 text-sm font-medium text-[var(--color-text-disabled)]">
          How to manage bills
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
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
            <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4 shadow-lg">
              <div className="mb-3 flex flex-col gap-1">
                <span className="text-xs text-[var(--color-icon-secondary)]">Vendor</span>
                <Select value={vendorFilter} onChange={setVendorFilter} options={[{ value: "", label: "All vendors" }, ...vendorOptions]} placeholder="All vendors" allowCustomValue={false} optionSize="sm" />
              </div>
              <div className="flex justify-between">
                <Button variant="secondary" size="sm" onClick={() => setVendorFilter("")}>
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
          onClick={() => setCustomizeOpen(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Customize
        </button>
      </div>

      {showEditForm ? (
        <Card title="Edit bill" className="mb-4">
          <form onSubmit={handleEditSubmit} className="flex flex-wrap items-end gap-3">
            <div className="w-56">
              <Select label="Vendor" value={vendorId} onChange={setVendorId} options={vendorOptions} placeholder="Select a vendor" allowCustomValue={false} />
            </div>
            <div className="w-36">
              <InputField label="Bill # (optional)" placeholder="INV-1001" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
            </div>
            <div className="w-40">
              <InputField label="Bill date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
            </div>
            <div className="w-40">
              <InputField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="w-36">
              <NumberField label="Amount" currency placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="w-48">
              <Select label="Category" value={categoryAccountId} onChange={setCategoryAccountId} options={categoryOptions} placeholder="None" allowCustomValue={false} />
            </div>
            <div className="min-w-[160px] flex-1">
              <InputField label="Memo (optional)" placeholder="What's this for?" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </div>
            <Button type="submit" disabled={!vendorId || amount.trim() === ""}>
              Save changes
            </Button>
            <Button type="button" variant="secondary" onClick={resetEditForm}>
              Cancel
            </Button>
          </form>
        </Card>
      ) : null}

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="w-10 px-2 pb-[5px] pt-2 text-left align-middle">
                <input type="checkbox" disabled />
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Bill</th>
              {visibleColumns.map((id) => (
                <th key={id} className={`border-l-custom px-2 pb-[5px] pt-2 align-middle ${id === "billAmount" ? "text-right" : "text-left"}`}>
                  {id === "source" ? (
                    <span className="inline-flex items-center gap-1">
                      {COLUMN_LABELS[id]}
                      <span title="How this bill was created">
                        <HelpCircle className="h-3 w-3 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                      </span>
                    </span>
                  ) : SORTABLE_COLUMNS.includes(id) ? (
                    <button
                      type="button"
                      onClick={() => setListSettings((c) => ({ ...c, sortKey: id, sortDir: c.sortKey === id && c.sortDir === "asc" ? "desc" : "asc" }))}
                      className={`flex items-center gap-1 hover:text-[var(--color-text-global)] ${id === "billAmount" ? "ml-auto" : ""}`}
                    >
                      {COLUMN_LABELS[id]}
                      {listSettings.sortKey === id ? <ChevronDown className={`h-3 w-3 transition-transform ${listSettings.sortDir === "asc" ? "rotate-180" : ""}`} aria-hidden="true" /> : null}
                    </button>
                  ) : (
                    COLUMN_LABELS[id]
                  )}
                </th>
              ))}
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {!hydrated ? (
              <tr>
                <td colSpan={visibleColumns.length + 3} className="px-3 py-10 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 3} className="px-3 py-16 text-center">
                  <p className="text-lg font-semibold text-[var(--color-text-global)]">No bills found</p>
                  {tab === "DRAFT" ? (
                    <>
                      <p className="mt-1 text-sm text-[var(--color-text-disabled)]">Select Upload files to create bills automatically.</p>
                      <button type="button" onClick={() => setShowNewBillModal(true)} className="mt-1 text-sm text-[var(--color-link-action)] hover:underline">
                        Upload files
                      </button>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--color-text-disabled)]">Try to change some filters to see more results.</p>
                  )}
                </td>
              </tr>
            ) : (
              pageRows.map((bill, index) => (
                <tr
                  key={bill.id}
                  className={`border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)] ${
                    listSettings.alternateRowColor && index % 2 === 1 ? "bg-[var(--color-container-background-accent)]" : ""
                  }`}
                >
                  <td className={`${cellPadding} align-top`}>
                    <input type="checkbox" disabled />
                  </td>
                  <td className={`border-l border-l-dotted border-l-[var(--color-divider-tertiary)] ${cellPadding} align-top text-[13px]`}>
                    <button type="button" onClick={() => startEdit(bill)} className="font-medium text-[var(--color-text-global)] hover:underline">
                      {bill.billNumber || "Bill"}
                    </button>
                  </td>
                  {visibleColumns.map((id) => (
                    <td
                      key={id}
                      className={`border-l border-l-dotted border-l-[var(--color-divider-tertiary)] ${cellPadding} align-top text-[13px] text-[var(--color-text-primary)] ${
                        id === "billAmount" ? "text-right text-[var(--color-text-global)]" : ""
                      }`}
                    >
                      {columnValue(id, bill)}
                    </td>
                  ))}
                  <td className={`border-l border-l-dotted border-l-[var(--color-divider-tertiary)] ${cellPadding} align-top text-right`}>
                    <div className="flex justify-end gap-3 text-[13px]">
                      {bill.status !== "PAID" ? (
                        <button type="button" onClick={() => setPayingBill(bill)} className="font-medium text-[var(--color-link-action)] hover:underline">
                          Mark paid
                        </button>
                      ) : null}
                      <button type="button" onClick={() => handleDelete(bill)} className="font-medium text-[var(--color-negative)] hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageRows.length > 0 ? (
        <div className="mt-1 flex justify-end border-t border-[var(--color-divider-tertiary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-global)]">Total: {formatMoney(total)}</div>
      ) : null}

      <div className="mt-2 flex items-center justify-end gap-3 text-sm text-[var(--color-text-primary)]">
        <span>{sortedFilteredBills.length === 0 ? "0 - 0 of 0 items" : `${pageStart} - ${pageEnd} of ${sortedFilteredBills.length} items`}</span>
        <IconButton icon={ChevronLeft} label="Previous page" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
        <span className="flex h-7 w-8 items-center justify-center rounded border border-[var(--color-divider-tertiary)]">{currentPage}</span>
        <span>of {totalPages}</span>
        <IconButton icon={ChevronRight} label="Next page" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
      </div>

      {customizeOpen ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setCustomizeOpen(false)} />
          <div className="relative flex h-full w-[380px] max-w-full flex-col overflow-y-auto bg-[var(--color-container-background-primary)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-5 py-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-global)]">Customize</h2>
              <button type="button" onClick={() => setCustomizeOpen(false)} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 px-5 py-4">
              <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Sort</p>
              <div className="mb-4 rounded-lg border border-[var(--color-divider-tertiary)] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex-1">
                    <Select
                      value={listSettings.sortKey}
                      onChange={(v) => setListSettings((c) => ({ ...c, sortKey: v as ColumnId }))}
                      options={SORTABLE_COLUMNS.map((id) => ({ value: id, label: COLUMN_LABELS[id].toUpperCase() }))}
                      placeholder="Sort by"
                      allowCustomValue={false}
                      optionSize="sm"
                    />
                  </div>
                  <button type="button" onClick={() => setListSettings((c) => ({ ...c, sortKey: DEFAULT_LIST_SETTINGS.sortKey, sortDir: DEFAULT_LIST_SETTINGS.sortDir }))} className="text-[var(--color-icon-secondary)] hover:text-[var(--color-negative)]">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <Select
                  value={listSettings.sortDir}
                  onChange={(v) => setListSettings((c) => ({ ...c, sortDir: v as "asc" | "desc" }))}
                  options={[
                    { value: "asc", label: "Ascending" },
                    { value: "desc", label: "Descending" }
                  ]}
                  placeholder="Direction"
                  allowCustomValue={false}
                  optionSize="sm"
                />
              </div>
              <button type="button" disabled title="Multi-column sort isn't available yet" className="mb-6 cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)]">
                + Add sort
              </button>

              <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Rows</p>
              <div className="mb-4 flex flex-col gap-3">
                <div>
                  <p className="mb-1 text-xs text-[var(--color-icon-secondary)]">Rows per page</p>
                  <Select
                    value={String(listSettings.rowsPerPage)}
                    onChange={(v) => setListSettings((c) => ({ ...c, rowsPerPage: Number(v) }))}
                    options={ROWS_PER_PAGE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                    placeholder="Rows per page"
                    allowCustomValue={false}
                    optionSize="sm"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-[var(--color-icon-secondary)]">Row height</p>
                  <Select
                    value={listSettings.rowHeight}
                    onChange={(v) => setListSettings((c) => ({ ...c, rowHeight: v as "comfortable" | "compact" }))}
                    options={[
                      { value: "comfortable", label: "Comfortable" },
                      { value: "compact", label: "Compact" }
                    ]}
                    placeholder="Row height"
                    allowCustomValue={false}
                    optionSize="sm"
                  />
                </div>
                <Checkbox
                  label="Alternate row color"
                  checked={listSettings.alternateRowColor}
                  onChange={(e) => setListSettings((c) => ({ ...c, alternateRowColor: e.target.checked }))}
                />
              </div>

              <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Columns</p>
              <p className="mb-2 text-xs text-[var(--color-icon-secondary)]">Drag to change the order of columns</p>
              <div className="flex flex-col gap-0.5">
                {listSettings.columnOrder.map((id) => (
                  <div
                    key={id}
                    draggable
                    onDragStart={() => {
                      dragColumnRef.current = id;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => reorderColumn(id)}
                    className="flex items-center gap-2.5 rounded-lg px-1 py-2 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[var(--color-icon-secondary)]" aria-hidden="true" />
                    <Checkbox checked={!listSettings.hiddenColumns.includes(id)} onChange={(e) => toggleColumn(id, e.target.checked)} label={COLUMN_LABELS[id].toUpperCase()} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showNewBillModal ? (
        <TransactionFormModal
          type="BILL"
          accounts={accounts}
          vendors={vendors}
          nextCheckNumber={1}
          onSaveBill={async (input) => {
            await add({
              vendorId: input.vendorId,
              billNumber: input.billNumber || undefined,
              billDate: input.billDate,
              dueDate: input.dueDate,
              amount: input.amount,
              categoryAccountId: input.categoryAccountId,
              memo: input.memo || undefined
            });
          }}
          onClose={() => setShowNewBillModal(false)}
        />
      ) : null}

      {showPayBills ? (
        <PayBillsModal
          accounts={accounts}
          openBillCount={openBillCount}
          onEnterNewBill={() => {
            setShowPayBills(false);
            setShowNewBillModal(true);
          }}
          onClose={() => setShowPayBills(false)}
        />
      ) : null}

      {payingBill ? (
        <PayBillDialog
          bill={payingBill}
          vendorName={vendorNameById.get(payingBill.vendorId) ?? "this vendor"}
          accounts={accounts}
          onConfirm={handleConfirmPay}
          onClose={() => setPayingBill(null)}
        />
      ) : null}
    </>
  );
}

// A real bank/credit account is required to post the payment leg (Dr
// Accounts Payable, Cr Cash-or-Bank) -- this small dialog is the minimum
// needed to collect that, rather than the full "Pay Bills" batch screen
// (PayBillsModal), which isn't wired up to actually schedule payments yet.
function PayBillDialog({
  bill,
  vendorName,
  accounts,
  onConfirm,
  onClose
}: {
  bill: Bill;
  vendorName: string;
  accounts: Account[];
  onConfirm: (paymentAccountId: string, paymentDate: string) => Promise<void>;
  onClose: () => void;
}) {
  const bankAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "BANK" || a.category === "CREDIT_CARD").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const [paymentAccountId, setPaymentAccountId] = useState(bankAccountOptions[0]?.value ?? "");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentAccountId) return;
    setSubmitting(true);
    try {
      await onConfirm(paymentAccountId, paymentDate);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="w-full max-w-sm rounded-lg bg-[var(--color-container-background-primary)] p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-[var(--color-text-global)]">Mark bill paid</h2>
        <p className="mb-4 text-sm text-[var(--color-text-primary)]">
          {formatMoney(bill.amount)} to {vendorName}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Select label="Payment account" value={paymentAccountId} onChange={setPaymentAccountId} options={bankAccountOptions} placeholder="Select account" allowCustomValue={false} />
          <InputField label="Payment date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!paymentAccountId || submitting}>
              {submitting ? "Marking paid…" : "Mark paid"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
