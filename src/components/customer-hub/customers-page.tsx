"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, Printer, Search, Settings, Share } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, usePersistedJSON } from "@/lib/local-store/use-local-collection";
import { InvoiceFormDrawer } from "@/components/sales/invoice-form-drawer";
import { useSalesData } from "@/components/sales/use-sales-data";
import { ImportCustomersModal } from "@/components/customer-hub/import-customers-modal";
import type { Invoice } from "@/lib/local-store/sales-types";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ColumnId = "companyName" | "address" | "phone" | "email" | "attachments";
const COLUMN_LABELS: Record<ColumnId, string> = {
  companyName: "Company name",
  address: "Address",
  phone: "Phone",
  email: "Email",
  attachments: "Attachments"
};
const DEFAULT_COLUMNS: ColumnId[] = ["companyName", "phone"];

type SortKey = "name" | "companyName" | "openBalance";

// Phase 1: real local customers. "Check out the new view with filters"
// and per-invoice/credit balance detail beyond a plain sum are honestly
// disabled -- see each control's title.
export function CustomersPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const { customers, invoices, productsServices, estimates, addCustomerRecord, updateCustomer, addInvoice, addCustomer } = useSalesData();

  const [summaryOpen, setSummaryOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [newCustomerMenuOpen, setNewCustomerMenuOpen] = useState(false);
  const newCustomerMenuRef = useRef<HTMLDivElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [invoiceDrawerFor, setInvoiceDrawerFor] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (newCustomerMenuRef.current && !newCustomerMenuRef.current.contains(event.target as Node)) setNewCustomerMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const settingsKey = activeCompany ? companyScopedKey(activeCompany.name, "customers-list-settings") : "newgl:phase1:pending:customers-list-settings";
  const [listSettings, setListSettings] = usePersistedJSON(settingsKey, { columns: DEFAULT_COLUMNS, includeInactive: false });
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
    setListSettings((c) => ({ ...c, columns: checked ? [...c.columns, id] : c.columns.filter((x) => x !== id) }));
  }

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const openBalanceByCustomer = useMemo(() => {
    const totals = new Map<string, number>();
    invoices.filter((i) => i.status === "OPEN").forEach((i) => totals.set(i.customerId, (totals.get(i.customerId) ?? 0) + i.amount));
    return totals;
  }, [invoices]);

  const estimatesOpen = useMemo(() => estimates.filter((e) => e.status === "OPEN"), [estimates]);
  const estimatesOpenTotal = useMemo(() => estimatesOpen.reduce((sum, e) => sum + e.amount, 0), [estimatesOpen]);
  const overdueInvoices = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return invoices.filter((i) => i.status === "OPEN" && i.dueDate < today);
  }, [invoices]);
  const overdueTotal = useMemo(() => overdueInvoices.reduce((sum, i) => sum + i.amount, 0), [overdueInvoices]);
  const openInvoices = useMemo(() => invoices.filter((i) => i.status === "OPEN"), [invoices]);
  const openTotal = useMemo(() => openInvoices.reduce((sum, i) => sum + i.amount, 0), [openInvoices]);
  const recentlyPaid = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return invoices.filter((i) => i.status === "PAID" && new Date(i.createdAt).getTime() >= cutoff);
  }, [invoices]);
  const recentlyPaidTotal = useMemo(() => recentlyPaid.reduce((sum, i) => sum + i.amount, 0), [recentlyPaid]);

  const visibleCustomers = useMemo(() => {
    const filtered = customers.filter(
      (c) => (listSettings.includeInactive || c.status === "ACTIVE") && (search.trim() === "" || c.name.toLowerCase().includes(search.trim().toLowerCase()))
    );
    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortKey === "name") diff = a.name.localeCompare(b.name);
      else if (sortKey === "companyName") diff = (a.companyName ?? "").localeCompare(b.companyName ?? "");
      else diff = (openBalanceByCustomer.get(a.id) ?? 0) - (openBalanceByCustomer.get(b.id) ?? 0);
      return sortDir === "asc" ? diff : -diff;
    });
  }, [customers, search, listSettings.includeInactive, sortKey, sortDir, openBalanceByCustomer]);

  function resetForm() {
    setName("");
    setCompanyName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(id: string) {
    const customer = customers.find((c) => c.id === id);
    if (!customer) return;
    setEditingId(id);
    setName(customer.name);
    setCompanyName(customer.companyName ?? "");
    setEmail(customer.email ?? "");
    setPhone(customer.phone ?? "");
    setAddress(customer.address ?? "");
    setShowForm(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const patch = {
      name: name.trim(),
      companyName: companyName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined
    };
    if (editingId) {
      updateCustomer(editingId, patch);
      toast({ variant: "success", title: "Customer updated" });
    } else {
      addCustomerRecord(patch);
      toast({ variant: "success", title: "Customer added" });
    }
    resetForm();
  }

  function handleSaveInvoice(input: Omit<Invoice, "id" | "createdAt" | "status">) {
    addInvoice(input);
    setInvoiceDrawerFor(null);
    toast({ variant: "success", title: "Invoice created" });
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--color-text-global)]">
          Customers
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-sm font-medium text-[var(--color-link-action)] opacity-60">
            Check out the new view with filters
          </button>
        </h1>
        <div className="relative" ref={newCustomerMenuRef}>
          <div className="flex overflow-hidden rounded-full">
            <Button className="rounded-r-none" onClick={() => setShowForm(true)}>
              New customer
            </Button>
            <Button className="rounded-l-none border-l border-l-white/20 px-2" aria-label="More new-customer options" onClick={() => setNewCustomerMenuOpen((v) => !v)}>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {newCustomerMenuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setNewCustomerMenuOpen(false);
                  setShowImportModal(true);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
              >
                Import customers
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {summaryOpen ? (
        <div className="mb-2 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] sm:grid-cols-4">
          {[
            { label: `${estimatesOpen.length} estimates`, value: estimatesOpenTotal, bar: "bg-cyan-400" },
            { label: `${overdueInvoices.length} overdue invoices`, value: overdueTotal, bar: "bg-orange-400" },
            { label: `${openInvoices.length} open invoices and credits`, value: openTotal, bar: "bg-[var(--color-icon-secondary)]" },
            { label: `${recentlyPaid.length} recently paid`, value: recentlyPaidTotal, bar: "bg-[var(--color-positive)]" }
          ].map((tile) => (
            <div key={tile.label} className="bg-[var(--color-container-background-primary)] p-4">
              <p className="text-xl font-semibold text-[var(--color-text-global)]">{formatMoney(tile.value)}</p>
              <p className="text-xs text-[var(--color-text-primary)]">{tile.label}</p>
              <div className={`mt-3 h-1.5 rounded-full ${tile.bar}`} />
            </div>
          ))}
        </div>
      ) : null}
      <div className="mb-4 flex justify-end">
        <IconButton icon={summaryOpen ? ChevronUp : ChevronDown} label={summaryOpen ? "Collapse summary" : "Expand summary"} size="sm" onClick={() => setSummaryOpen((v) => !v)} />
      </div>

      {showForm ? (
        <Card title={editingId ? "Edit customer" : "Add a customer"} description="Not backed by a server yet -- saved to this browser only." className="mb-4">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <InputField label="Customer name" placeholder="e.g. Jane Smith" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="min-w-[180px] flex-1">
              <InputField label="Company name (optional)" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="min-w-[160px] flex-1">
              <InputField label="Email (optional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="w-40">
              <InputField label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="min-w-[200px] flex-1">
              <InputField label="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <Button type="submit" disabled={name.trim() === ""}>
              {editingId ? "Save changes" : "Add customer"}
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
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4 shadow-lg">
                <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Columns</p>
                <div className="mb-4 flex flex-col gap-2">
                  {(Object.keys(COLUMN_LABELS) as ColumnId[]).map((id) => (
                    <Checkbox key={id} label={COLUMN_LABELS[id]} checked={listSettings.columns.includes(id)} onChange={(e) => toggleColumn(id, e.target.checked)} />
                  ))}
                </div>
                <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Other</p>
                <Checkbox label="Include inactive" checked={listSettings.includeInactive} onChange={(e) => setListSettings((c) => ({ ...c, includeInactive: e.target.checked }))} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="w-10 px-2 pb-[5px] pt-2 text-left align-middle">
                <input type="checkbox" disabled />
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">
                <button type="button" onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-[var(--color-text-global)]">
                  Name {sortKey === "name" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                </button>
              </th>
              {listSettings.columns.includes("companyName") ? (
                <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">
                  <button type="button" onClick={() => toggleSort("companyName")} className="flex items-center gap-1 hover:text-[var(--color-text-global)]">
                    Company name {sortKey === "companyName" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                  </button>
                </th>
              ) : null}
              {listSettings.columns.includes("address") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Address</th> : null}
              {listSettings.columns.includes("phone") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Phone</th> : null}
              {listSettings.columns.includes("email") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Email</th> : null}
              {listSettings.columns.includes("attachments") ? <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Attachments</th> : null}
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">
                <button type="button" onClick={() => toggleSort("openBalance")} className="ml-auto flex items-center gap-1 hover:text-[var(--color-text-global)]">
                  Open balance {sortKey === "openBalance" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                </button>
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {visibleCustomers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-16 text-center">
                  <p className="text-lg font-semibold text-[var(--color-text-global)]">No customers found</p>
                  <p className="mt-1 text-sm text-[var(--color-text-disabled)]">Click &quot;New customer&quot; to add one.</p>
                </td>
              </tr>
            ) : (
              visibleCustomers.map((customer) => (
                <tr key={customer.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top">
                    <input type="checkbox" disabled />
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]">
                    <button type="button" onClick={() => startEdit(customer.id)} className="font-medium text-[var(--color-text-global)] hover:underline">
                      {customer.name}
                    </button>
                  </td>
                  {listSettings.columns.includes("companyName") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{customer.companyName || "--"}</td>
                  ) : null}
                  {listSettings.columns.includes("address") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{customer.address || "--"}</td>
                  ) : null}
                  {listSettings.columns.includes("phone") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{customer.phone || "--"}</td>
                  ) : null}
                  {listSettings.columns.includes("email") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{customer.email || "--"}</td>
                  ) : null}
                  {listSettings.columns.includes("attachments") ? (
                    <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-disabled)]">--</td>
                  ) : null}
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">
                    {formatMoney(openBalanceByCustomer.get(customer.id) ?? 0)}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px]">
                    <button type="button" onClick={() => setInvoiceDrawerFor(customer.id)} className="font-medium text-[var(--color-link-action)] hover:underline">
                      Create invoice
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {invoiceDrawerFor ? (
        <InvoiceFormDrawer
          customers={customers}
          productsServices={productsServices}
          initialCustomerId={invoiceDrawerFor}
          onAddCustomer={addCustomer}
          onSave={handleSaveInvoice}
          onClose={() => setInvoiceDrawerFor(null)}
        />
      ) : null}
      {showImportModal ? <ImportCustomersModal onClose={() => setShowImportModal(false)} /> : null}
    </>
  );
}
