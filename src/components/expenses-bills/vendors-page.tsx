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
import type { Vendor } from "@/lib/local-store/expenses-bills-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

// Phase 1: UI only, local-only data -- see
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md. Real
// persistence (a `vendors` table + API routes) is Phase 1.5.
export function VendorsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const storageKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const { items: vendors, hydrated, add, update, remove } = useLocalCollection<Vendor>(storageKey ?? "newgl:phase1:pending:vendors");

  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  const expenseAccountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE")
        .map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [defaultExpenseAccountId, setDefaultExpenseAccountId] = useState("");
  const [is1099Contractor, setIs1099Contractor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setEmail("");
    setPhone("");
    setDefaultExpenseAccountId("");
    setIs1099Contractor(false);
    setEditingId(null);
  }

  function startEdit(vendor: Vendor) {
    setEditingId(vendor.id);
    setName(vendor.name);
    setEmail(vendor.email ?? "");
    setPhone(vendor.phone ?? "");
    setDefaultExpenseAccountId(vendor.defaultExpenseAccountId ?? "");
    setIs1099Contractor(vendor.is1099Contractor);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const patch = {
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      defaultExpenseAccountId: defaultExpenseAccountId || undefined,
      is1099Contractor
    };
    if (editingId) {
      update(editingId, patch);
      toast({ variant: "success", title: "Vendor updated", description: `"${name.trim()}" was updated.` });
    } else {
      add({ id: localId(), status: "ACTIVE", createdAt: new Date().toISOString(), ...patch });
      toast({ variant: "success", title: "Vendor added", description: `"${name.trim()}" was added.` });
    }
    resetForm();
  }

  function handleArchive(vendor: Vendor) {
    update(vendor.id, { status: vendor.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" });
  }

  function handleDelete(vendor: Vendor) {
    remove(vendor.id);
    toast({ variant: "success", title: "Vendor deleted", description: `"${vendor.name}" was removed.` });
  }

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <Card
        title={editingId ? "Edit vendor" : "Add a vendor"}
        description="Not backed by a server yet -- saved to this browser only, ready to wire to a real API next."
        className="mb-6"
      >
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <InputField label="Vendor name" placeholder="e.g. Acme Office Supply" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="min-w-[180px] flex-1">
            <InputField label="Email (optional)" type="email" placeholder="billing@acme.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="w-40">
            <InputField label="Phone (optional)" placeholder="555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="w-56">
            <Select
              label="Default expense account"
              value={defaultExpenseAccountId}
              onChange={setDefaultExpenseAccountId}
              options={expenseAccountOptions}
              placeholder="None"
              allowCustomValue={false}
            />
          </div>
          <Checkbox label="1099 contractor" checked={is1099Contractor} onChange={(e) => setIs1099Contractor(e.target.checked)} />
          <Button type="submit" disabled={name.trim() === ""}>
            {editingId ? "Save changes" : "Add vendor"}
          </Button>
          {editingId ? (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </form>
      </Card>

      <Card title="Vendors" description="Every vendor you've added for this company.">
        {!hydrated ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : vendors.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">No vendors yet. Add one above to get started.</p>
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Vendor</Table.HeaderCell>
                <Table.HeaderCell>Contact</Table.HeaderCell>
                <Table.HeaderCell>Default account</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {vendors.map((vendor) => (
                <Table.Row key={vendor.id}>
                  <Table.Cell>
                    <p className="font-medium text-[var(--color-text-global)]">{vendor.name}</p>
                    {vendor.is1099Contractor ? (
                      <Badge variant="info" size="sm" className="mt-1">
                        1099 contractor
                      </Badge>
                    ) : null}
                  </Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">
                    {vendor.email || vendor.phone ? (
                      <>
                        {vendor.email ? <p>{vendor.email}</p> : null}
                        {vendor.phone ? <p>{vendor.phone}</p> : null}
                      </>
                    ) : (
                      <span className="text-[var(--color-text-disabled)]">--</span>
                    )}
                  </Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">
                    {vendor.defaultExpenseAccountId ? accountNameById.get(vendor.defaultExpenseAccountId) ?? "--" : "--"}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant={vendor.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                      {vendor.status === "ACTIVE" ? "Active" : "Archived"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell align="right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => startEdit(vendor)}>
                        Edit
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleArchive(vendor)}>
                        {vendor.status === "ACTIVE" ? "Archive" : "Reactivate"}
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
