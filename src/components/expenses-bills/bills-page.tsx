"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Bill, BillStatus, Vendor } from "@/lib/local-store/expenses-bills-types";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABEL: Record<BillStatus, string> = { DRAFT: "For review", OPEN: "Unpaid", PAID: "Paid" };
const STATUS_BADGE_VARIANT: Record<BillStatus, BadgeVariant> = { DRAFT: "neutral", OPEN: "warning", PAID: "success" };
const TABS: BillStatus[] = ["DRAFT", "OPEN", "PAID"];

// Phase 1: UI only, local-only data. Paying a bill for real (posting a
// beancount transaction) is Phase 1.5 -- "Paid" here is just a status
// label. See newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function BillsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const vendorsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const billsKey = activeCompany ? companyScopedKey(activeCompany.name, "bills") : null;
  const { items: vendors } = useLocalCollection<Vendor>(vendorsKey ?? "newgl:phase1:pending:vendors");
  const { items: bills, hydrated, add, update, remove } = useLocalCollection<Bill>(billsKey ?? "newgl:phase1:pending:bills");

  const vendorOptions = useMemo(() => vendors.filter((v) => v.status === "ACTIVE").map((v) => ({ value: v.id, label: v.name })), [vendors]);
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [v.id, v.name])), [vendors]);

  const [tab, setTab] = useState<BillStatus>("OPEN");
  const [vendorFilter, setVendorFilter] = useState("");
  const tabBills = useMemo(() => bills.filter((b) => b.status === tab && (vendorFilter === "" || b.vendorId === vendorFilter)), [bills, tab, vendorFilter]);
  const tabCounts = useMemo(() => Object.fromEntries(TABS.map((s) => [s, bills.filter((b) => b.status === s).length])), [bills]);
  const total = useMemo(() => tabBills.reduce((sum, b) => sum + b.amount, 0), [tabBills]);

  const today = new Date().toISOString().slice(0, 10);
  const [showForm, setShowForm] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function resetForm() {
    setVendorId("");
    setBillNumber("");
    setBillDate(today);
    setDueDate(today);
    setAmount("");
    setMemo("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(bill: Bill) {
    setEditingId(bill.id);
    setVendorId(bill.vendorId);
    setBillNumber(bill.billNumber ?? "");
    setBillDate(bill.billDate);
    setDueDate(bill.dueDate);
    setAmount(String(bill.amount));
    setMemo(bill.memo ?? "");
    setShowForm(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!vendorId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    const patch = { vendorId, billNumber: billNumber.trim() || undefined, billDate, dueDate, amount: parsedAmount, memo: memo.trim() || undefined };
    if (editingId) {
      update(editingId, patch);
      toast({ variant: "success", title: "Bill updated" });
    } else {
      add({ id: localId(), status: "OPEN", createdAt: new Date().toISOString(), ...patch });
      toast({ variant: "success", title: "Bill added" });
    }
    resetForm();
  }

  function setStatus(bill: Bill, status: BillStatus) {
    update(bill.id, { status });
  }

  function handleDelete(bill: Bill) {
    remove(bill.id);
    toast({ variant: "success", title: "Bill deleted" });
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--color-text-global)]">Bills</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add bill"}</Button>
      </div>

      {showForm ? (
        <Card title={editingId ? "Edit bill" : "Add a bill"} description="Not backed by a server yet -- saved to this browser only." className="mb-4">
          {vendors.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)]">Add a vendor first, then bills can be recorded against it.</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
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
              <div className="min-w-[160px] flex-1">
                <InputField label="Memo (optional)" placeholder="What's this for?" value={memo} onChange={(e) => setMemo(e.target.value)} />
              </div>
              <Button type="submit" disabled={!vendorId || amount.trim() === ""}>
                {editingId ? "Save changes" : "Add bill"}
              </Button>
            </form>
          )}
        </Card>
      ) : null}

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            {TABS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setTab(status)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === status ? "bg-[var(--color-action-passive-subtle-active)] text-[var(--color-text-global)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                }`}
              >
                {STATUS_LABEL[status]} {tabCounts[status] ? `(${tabCounts[status]})` : ""}
              </button>
            ))}
          </div>
          <div className="w-48">
            <Select value={vendorFilter} onChange={setVendorFilter} options={[{ value: "", label: "All vendors" }, ...vendorOptions]} placeholder="All vendors" allowCustomValue={false} optionSize="sm" />
          </div>
        </div>

        {!hydrated ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : tabBills.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">No {STATUS_LABEL[tab].toLowerCase()} bills.</p>
        ) : (
          <>
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Vendor</Table.HeaderCell>
                  <Table.HeaderCell>Bill #</Table.HeaderCell>
                  <Table.HeaderCell>Due date</Table.HeaderCell>
                  <Table.HeaderCell align="right">Bill amount</Table.HeaderCell>
                  <Table.HeaderCell>Status</Table.HeaderCell>
                  <Table.HeaderCell />
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {tabBills.map((bill) => (
                  <Table.Row key={bill.id}>
                    <Table.Cell className="font-medium text-[var(--color-text-global)]">{vendorNameById.get(bill.vendorId) ?? "Unknown vendor"}</Table.Cell>
                    <Table.Cell className="text-[var(--color-text-primary)]">{bill.billNumber || "--"}</Table.Cell>
                    <Table.Cell className="text-[var(--color-text-primary)]">{bill.dueDate}</Table.Cell>
                    <Table.Cell align="right" className="text-[var(--color-text-global)]">{formatMoney(bill.amount)}</Table.Cell>
                    <Table.Cell>
                      <Badge variant={STATUS_BADGE_VARIANT[bill.status]} size="sm">
                        {STATUS_LABEL[bill.status]}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell align="right">
                      <div className="flex justify-end gap-1.5">
                        {bill.status !== "PAID" ? (
                          <Button size="sm" onClick={() => setStatus(bill, "PAID")}>
                            Mark paid
                          </Button>
                        ) : null}
                        <Button variant="secondary" size="sm" onClick={() => startEdit(bill)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(bill)}>
                          Delete
                        </Button>
                      </div>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
            <div className="flex justify-end border-t border-[var(--color-divider-tertiary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-global)]">
              Total: {formatMoney(total)}
            </div>
          </>
        )}
      </Card>
    </>
  );
}
