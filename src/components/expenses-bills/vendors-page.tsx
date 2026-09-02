"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Bill, Vendor } from "@/lib/local-store/expenses-bills-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Phase 1: UI only, local-only data -- see
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md. Real
// persistence (a `vendors` table + API routes) is Phase 1.5.
export function VendorsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const storageKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const { items: vendors, hydrated, add, update, remove } = useLocalCollection<Vendor>(storageKey ?? "newgl:phase1:pending:vendors");
  const billsKey = activeCompany ? companyScopedKey(activeCompany.name, "bills") : null;
  const { items: bills } = useLocalCollection<Bill>(billsKey ?? "newgl:phase1:pending:bills");

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
  const paidLast30DaysTotal = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return bills.filter((b) => b.status === "PAID" && new Date(b.createdAt).getTime() >= cutoff).reduce((sum, b) => sum + b.amount, 0);
  }, [bills]);
  const totalOpen = useMemo(() => [...openBalanceByVendor.values()].reduce((sum, v) => sum + v, 0), [openBalanceByVendor]);
  const overdueTotal = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return bills.filter((b) => b.status === "OPEN" && b.dueDate < today).reduce((sum, b) => sum + b.amount, 0);
  }, [bills]);

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultExpenseAccountId, setDefaultExpenseAccountId] = useState("");
  const [is1099Contractor, setIs1099Contractor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
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
    if (editingId) {
      update(editingId, patch);
      toast({ variant: "success", title: "Vendor updated" });
    } else {
      add({ id: localId(), status: "ACTIVE", createdAt: new Date().toISOString(), ...patch });
      toast({ variant: "success", title: "Vendor added" });
    }
    resetForm();
  }

  function handleDelete(vendor: Vendor) {
    remove(vendor.id);
    toast({ variant: "success", title: "Vendor deleted" });
  }

  const visibleVendors = useMemo(
    () => vendors.filter((v) => v.status === "ACTIVE" && (search.trim() === "" || v.name.toLowerCase().includes(search.trim().toLowerCase()))),
    [vendors, search]
  );

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--color-text-global)]">Vendors</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New vendor"}</Button>
      </div>

      <div className="mb-4 grid gap-px overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)] sm:grid-cols-3">
        <div className="bg-[var(--color-warning-bg)] p-4">
          <p className="text-2xl font-semibold text-[var(--color-warning-text)]">{formatMoney(overdueTotal)}</p>
          <p className="text-xs uppercase tracking-wide text-[var(--color-warning-text)]">Overdue</p>
        </div>
        <div className="bg-[var(--color-container-background-accent)] p-4">
          <p className="text-2xl font-semibold text-[var(--color-text-global)]">{formatMoney(totalOpen)}</p>
          <p className="text-xs uppercase tracking-wide text-[var(--color-icon-secondary)]">Open bills</p>
        </div>
        <div className="bg-[var(--color-highlight-badge-background)] p-4">
          <p className="text-2xl font-semibold text-[var(--color-highlight-badge-text)]">{formatMoney(paidLast30DaysTotal)}</p>
          <p className="text-xs uppercase tracking-wide text-[var(--color-highlight-badge-text)]">Paid last 30 days</p>
        </div>
      </div>

      {showForm ? (
        <Card title={editingId ? "Edit vendor" : "Add a vendor"} description="Not backed by a server yet -- saved to this browser only." className="mb-4">
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
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="mb-4 w-64">
          <InputField placeholder="Search vendors" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {!hydrated ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : visibleVendors.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">No vendors yet. Click "New vendor" to add one.</p>
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Vendor</Table.HeaderCell>
                <Table.HeaderCell>Company name</Table.HeaderCell>
                <Table.HeaderCell>Phone</Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>1099 tracking</Table.HeaderCell>
                <Table.HeaderCell align="right">Open balance</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {visibleVendors.map((vendor) => (
                <Table.Row key={vendor.id}>
                  <Table.Cell className="font-medium text-[var(--color-text-global)]">{vendor.name}</Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">{vendor.companyName || "--"}</Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">{vendor.phone || "--"}</Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">{vendor.email || "--"}</Table.Cell>
                  <Table.Cell>{vendor.is1099Contractor ? <Badge variant="info" size="sm">Tracked</Badge> : <span className="text-[var(--color-text-disabled)]">--</span>}</Table.Cell>
                  <Table.Cell align="right" className="text-[var(--color-text-global)]">
                    {formatMoney(openBalanceByVendor.get(vendor.id) ?? 0)}
                  </Table.Cell>
                  <Table.Cell align="right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => startEdit(vendor)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(vendor)}>
                        Delete
                      </Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </>
  );
}
