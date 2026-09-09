"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, MessageSquarePlus, Printer, Search, Settings, Share } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, usePersistedJSON } from "@/lib/local-store/use-local-collection";
import { useVendors } from "@/lib/hooks/use-vendors";
import { useBills } from "@/lib/hooks/use-bills";
import type { Vendor } from "@/lib/services/vendors-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";
import { ImportVendorsModal } from "@/components/expenses-bills/import-vendors-modal";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ColumnId = "companyName" | "address" | "phone" | "email" | "tracking1099" | "attachments" | "billPayAch";
const DEFAULT_COLUMNS: ColumnId[] = ["companyName", "phone", "email", "tracking1099", "billPayAch"];

type SortKey = "name" | "companyName" | "openBalance";
type SortDir = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [50, 75, 100, 150, 300];

// Phase 1.5, Steps 1 + 3: real persistence for both Vendors and Bills --
// see newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md,
// @/lib/hooks/use-vendors, and @/lib/hooks/use-bills.
export function VendorsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: vendors, hydrated, add, update } = useVendors();
  const { items: bills } = useBills();

  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  const expenseAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );

  const openBalanceByVendor = useMemo(() => {
    const totals = new Map<string, number>();
    bills.filter((b) => b.status === "OPEN").forEach((b) => totals.set(b.vendorId, (totals.get(b.vendorId) ?? 0) + b.amount));
    return totals;
  }, [bills]);
  const paidLast30Days = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return bills.filter((b) => b.status === "PAID" && new Date(b.createdAt).getTime() >= cutoff);
  }, [bills]);
  const openBills = useMemo(() => bills.filter((b) => b.status === "OPEN"), [bills]);
  const overdueBills = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return bills.filter((b) => b.status === "OPEN" && b.dueDate < today);
  }, [bills]);
  const overdueTotal = useMemo(() => overdueBills.reduce((sum, b) => sum + b.amount, 0), [overdueBills]);
  const openTotal = useMemo(() => openBills.reduce((sum, b) => sum + b.amount, 0), [openBills]);
  const paidTotal = useMemo(() => paidLast30Days.reduce((sum, b) => sum + b.amount, 0), [paidLast30Days]);

  const [summaryOpen, setSummaryOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultExpenseAccountId, setDefaultExpenseAccountId] = useState("");
  const [is1099Contractor, setIs1099Contractor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [newVendorMenuOpen, setNewVendorMenuOpen] = useState(false);
  const newVendorMenuRef = useRef<HTMLDivElement>(null);
  const [payVendorsMenuOpen, setPayVendorsMenuOpen] = useState(false);
  const payVendorsMenuRef = useRef<HTMLDivElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newVendorMenuRef.current && !newVendorMenuRef.current.contains(event.target as Node)) setNewVendorMenuOpen(false);
      if (payVendorsMenuRef.current && !payVendorsMenuRef.current.contains(event.target as Node)) setPayVendorsMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function resetForm() {
    setName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setDefaultExpenseAccountId("");
    setIs1099Contractor(false);
    setEditingId(null);
    setShowForm(false);
  }

  function startAdd() {
    resetForm();
    setShowForm(true);
    setNewVendorMenuOpen(false);
  }

  function startEdit(vendor: Vendor) {
    setEditingId(vendor.id);
    setName(vendor.name);
    setCompanyName(vendor.companyName ?? "");
    setEmail(vendor.email ?? "");
    setPhone(vendor.phone ?? "");
    setDefaultExpenseAccountId(vendor.defaultExpenseAccountId ?? "");
    setIs1099Contractor(vendor.is1099Contractor);
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const patch = {
      name: name.trim(),
      companyName: companyName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      defaultExpenseAccountId: defaultExpenseAccountId || undefined,
      is1099Contractor
    };
    try {
      if (editingId) {
        await update(editingId, patch);
        toast({ variant: "success", title: "Vendor updated" });
      } else {
        await add(patch);
        toast({ variant: "success", title: "Vendor added" });
      }
      resetForm();
    } catch (err) {
      toast({ variant: "error", title: editingId ? "Could not update this vendor" : "Could not add this vendor", description: err instanceof Error ? err.message : undefined });
    }
  }

  // -- Columns / include-inactive / page size (persisted per company) --
  const settingsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors-list-settings") : "newgl:phase1:pending:vendors-list-settings";
  const [listSettings, setListSettings] = usePersistedJSON(settingsKey, { columns: DEFAULT_COLUMNS, includeInactive: false, pageSize: 50 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!settingsOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) setSettingsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [settingsOpen]);
  function toggleColumn(id: ColumnId, checked: boolean) {
    setListSettings((current) => ({ ...current, columns: checked ? [...current.columns, id] : current.columns.filter((c) => c !== id) }));
  }

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search, listSettings.includeInactive, listSettings.pageSize]);

  const visibleVendors = useMemo(() => {
    const filtered = vendors.filter(
      (v) => (listSettings.includeInactive || v.status === "ACTIVE") && (search.trim() === "" || v.name.toLowerCase().includes(search.trim().toLowerCase()))
    );
    const sorted = [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") diff = a.name.localeCompare(b.name);
      else if (sortKey === "companyName") diff = (a.companyName ?? "").localeCompare(b.companyName ?? "");
      else diff = (openBalanceByVendor.get(a.id) ?? 0) - (openBalanceByVendor.get(b.id) ?? 0);
      return sortDir === "asc" ? diff : -diff;
    });
    return sorted;
  }, [vendors, search, listSettings.includeInactive, sortKey, sortDir, openBalanceByVendor]);

  const totalPages = Math.max(1, Math.ceil(visibleVendors.length / listSettings.pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = visibleVendors.length === 0 ? 0 : (currentPage - 1) * listSettings.pageSize + 1;
  const pageEnd = Math.min(currentPage * listSettings.pageSize, visibleVendors.length);
  const pageRows = visibleVendors.slice((currentPage - 1) * listSettings.pageSize, currentPage * listSettings.pageSize);

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return null;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />;
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Vendors</h1>
        <div className="flex items-center gap-4">
          <button type="button" disabled title="Not available yet" className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Give feedback
          </button>
          <div className="relative" ref={payVendorsMenuRef}>
            <div className="flex overflow-hidden rounded-full">
              <Button variant="secondary" className="rounded-r-none" disabled title="No bill-pay integration yet">
                Pay vendors
              </Button>
              <Button variant="secondary" className="rounded-l-none border-l border-l-[var(--color-divider-tertiary)] px-2" aria-label="More pay-vendors options" onClick={() => setPayVendorsMenuOpen((v) => !v)}>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {payVendorsMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <a
                  href="/all-apps/expenses-bills/1099s"
                  onClick={() => setPayVendorsMenuOpen(false)}
                  className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                >
                  Prepare 1099s
                </a>
                <button type="button" disabled title="Not available yet" className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-sm text-[var(--color-text-disabled)]">
                  Order checks
                </button>
              </div>
            ) : null}
          </div>
          <div className="relative" ref={newVendorMenuRef}>
            <div className="flex overflow-hidden rounded-full">
              <Button className="rounded-r-none" onClick={startAdd}>
                New vendor
              </Button>
              <Button className="rounded-l-none border-l border-l-white/20 px-2" aria-label="More new-vendor options" onClick={() => setNewVendorMenuOpen((v) => !v)}>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {newVendorMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setNewVendorMenuOpen(false);
                    setShowImportModal(true);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                >
                  Import vendors
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {summaryOpen ? (
        <div className="mb-2">
          <div className="mb-1 flex justify-between px-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
            <span>Unpaid Last 365 Days</span>
            <span>Paid</span>
          </div>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg">
            <div className="bg-[var(--color-negative-subtle-hover)] p-4">
              <p className="text-2xl font-semibold text-[var(--color-negative)]">{formatMoney(overdueTotal)}</p>
              <p className="text-xs uppercase tracking-wide text-[var(--color-negative)]">{overdueBills.length} overdue</p>
            </div>
            <div className="bg-[var(--color-container-background-accent)] p-4">
              <p className="text-2xl font-semibold text-[var(--color-text-global)]">{formatMoney(openTotal)}</p>
              <p className="text-xs uppercase tracking-wide text-[var(--color-icon-secondary)]">{openBills.length} open bills</p>
            </div>
            <div className="bg-[var(--color-highlight-badge-background)] p-4">
              <p className="text-2xl font-semibold text-[var(--color-highlight-badge-text)]">{formatMoney(paidTotal)}</p>
              <p className="text-xs uppercase tracking-wide text-[var(--color-highlight-badge-text)]">{paidLast30Days.length} paid last 30 days</p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="mb-4 flex justify-end">
        <IconButton icon={summaryOpen ? ChevronUp : ChevronDown} label={summaryOpen ? "Collapse summary" : "Expand summary"} size="sm" onClick={() => setSummaryOpen((v) => !v)} />
      </div>

      {showForm ? (
        <Card title={editingId ? "Edit vendor" : "Add a vendor"} className="mb-4">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <InputField label="Vendor name" placeholder="e.g. Acme Office Supply" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="min-w-[180px] flex-1">
              <InputField label="Company name (optional)" placeholder="Acme Office Supply LLC" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="min-w-[160px] flex-1">
              <InputField label="Email (optional)" type="email" placeholder="billing@acme.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="w-40">
              <InputField label="Phone (optional)" placeholder="555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="w-56">
              <Select label="Default expense account" value={defaultExpenseAccountId} onChange={setDefaultExpenseAccountId} options={expenseAccountOptions} placeholder="None" allowCustomValue={false} />
            </div>
            <Checkbox label="Track for 1099" checked={is1099Contractor} onChange={(e) => setIs1099Contractor(e.target.checked)} />
            <Button type="submit" disabled={name.trim() === ""}>
              {editingId ? "Save changes" : "Add vendor"}
            </Button>
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          </form>
        </Card>
      ) : null}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
          <InputField placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-1">
          <IconButton icon={Printer} label="Print" size="sm" />
          <IconButton icon={Share} label="Export" size="sm" />
          <div className="relative" ref={settingsRef}>
            <IconButton icon={Settings} label="Settings" size="sm" onClick={() => setSettingsOpen((v) => !v)} />
            {settingsOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4 shadow-lg">
                <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Columns</p>
                <div className="mb-4 flex flex-col gap-2">
                  <Checkbox label="Company name" checked={listSettings.columns.includes("companyName")} onChange={(e) => toggleColumn("companyName", e.target.checked)} />
                  <Checkbox label="Address" checked={listSettings.columns.includes("address")} onChange={(e) => toggleColumn("address", e.target.checked)} />
                  <Checkbox label="Phone" checked={listSettings.columns.includes("phone")} onChange={(e) => toggleColumn("phone", e.target.checked)} />
                  <Checkbox label="Email" checked={listSettings.columns.includes("email")} onChange={(e) => toggleColumn("email", e.target.checked)} />
                  <Checkbox label="1099 Tracking" checked={listSettings.columns.includes("tracking1099")} onChange={(e) => toggleColumn("tracking1099", e.target.checked)} />
                  <Checkbox label="Attachments" checked={listSettings.columns.includes("attachments")} onChange={(e) => toggleColumn("attachments", e.target.checked)} />
                  <Checkbox label="Bill Pay ACH info" checked={listSettings.columns.includes("billPayAch")} onChange={(e) => toggleColumn("billPayAch", e.target.checked)} />
                </div>
                <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Other</p>
                <div className="mb-4">
                  <Checkbox label="Include inactive" checked={listSettings.includeInactive} onChange={(e) => setListSettings((c) => ({ ...c, includeInactive: e.target.checked }))} />
                </div>
                <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Page size</p>
                <div className="flex flex-col gap-1.5">
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <label key={size} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                      <input type="radio" name="page-size" checked={listSettings.pageSize === size} onChange={() => setListSettings((c) => ({ ...c, pageSize: size }))} />
                      {size}
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
              <th className="w-10 px-2 pb-[5px] pt-2 text-left align-middle">
                <input type="checkbox" disabled />
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">
                <button type="button" onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-[var(--color-text-global)]">
                  Vendor <SortIcon column="name" />
                </button>
              </th>
              {listSettings.columns.includes("companyName") ? (
                <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">
                  <button type="button" onClick={() => toggleSort("companyName")} className="flex items-center gap-1 hover:text-[var(--color-text-global)]">
                    Company name <SortIcon column="companyName" />
                  </button>
                </th>
              ) : null}
              {listSettings.columns.includes("address") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Address</th> : null}
              {listSettings.columns.includes("phone") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Phone</th> : null}
              {listSettings.columns.includes("email") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Email</th> : null}
              {listSettings.columns.includes("tracking1099") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">1099 tracking</th> : null}
              {listSettings.columns.includes("attachments") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Attachments</th> : null}
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">
                <button type="button" onClick={() => toggleSort("openBalance")} className="ml-auto flex items-center gap-1 hover:text-[var(--color-text-global)]">
                  Open balance <SortIcon column="openBalance" />
                </button>
              </th>
              {listSettings.columns.includes("billPayAch") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Bill pay ACH info</th> : null}
            </tr>
          </thead>
          <tbody className="content-table">
            {!hydrated ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-16 text-center">
                  <p className="text-lg font-semibold text-[var(--color-text-global)]">No vendors found</p>
                  <p className="mt-1 text-sm text-[var(--color-text-disabled)]">Click &quot;New vendor&quot; to add one.</p>
                </td>
              </tr>
            ) : (
              pageRows.map((vendor) => (
                <tr key={vendor.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top">
                    <input type="checkbox" disabled />
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]">
                    <button type="button" onClick={() => startEdit(vendor)} className="font-medium text-[var(--color-text-global)] hover:underline">
                      {vendor.name}
                    </button>
                  </td>
                  {listSettings.columns.includes("companyName") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{vendor.companyName || "--"}</td>
                  ) : null}
                  {listSettings.columns.includes("address") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">--</td>
                  ) : null}
                  {listSettings.columns.includes("phone") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{vendor.phone || "--"}</td>
                  ) : null}
                  {listSettings.columns.includes("email") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{vendor.email || "--"}</td>
                  ) : null}
                  {listSettings.columns.includes("tracking1099") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]">
                      {vendor.is1099Contractor ? (
                        <Badge variant="info" size="sm">
                          Tracked
                        </Badge>
                      ) : (
                        <span className="text-[var(--color-text-disabled)]">--</span>
                      )}
                    </td>
                  ) : null}
                  {listSettings.columns.includes("attachments") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-disabled)]">--</td>
                  ) : null}
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">
                    {formatMoney(openBalanceByVendor.get(vendor.id) ?? 0)}
                  </td>
                  {listSettings.columns.includes("billPayAch") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]">
                      <p className="text-[var(--color-text-disabled)]">Missing</p>
                      <button type="button" onClick={() => toast({ variant: "info", title: "Not available yet" })} className="text-[var(--color-link-action)] hover:underline">
                        Add payment info
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-center text-xs text-[var(--color-icon-secondary)]">Vendor bill-pay isn&apos;t connected yet.</p>

      <div className="mt-2 flex items-center justify-end gap-3 text-sm text-[var(--color-text-primary)]">
        <span>{visibleVendors.length === 0 ? "0-0 of 0" : `${pageStart}-${pageEnd} of ${visibleVendors.length}`}</span>
        <IconButton icon={ChevronLeft} label="Previous page" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
        <span className="flex h-7 w-8 items-center justify-center rounded border border-[var(--color-divider-tertiary)]">{currentPage}</span>
        <IconButton icon={ChevronRight} label="Next page" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
      </div>

      {showImportModal ? <ImportVendorsModal onClose={() => setShowImportModal(false)} onCreateVendor={add} /> : null}
    </>
  );
}
