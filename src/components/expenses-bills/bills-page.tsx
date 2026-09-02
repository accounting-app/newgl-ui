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

const STATUS_OPTIONS: { value: BillStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "OPEN", label: "Open" },
  { value: "PAID", label: "Paid" }
];

const STATUS_BADGE_VARIANT: Record<BillStatus, BadgeVariant> = {
  DRAFT: "neutral",
  OPEN: "warning",
  PAID: "success"
};

// Phase 1: UI only, local-only data -- see
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md. Paying a
// bill for real (posting a beancount transaction) is Phase 1.5 -- for now
// "Paid" is just a status label, not a real ledger entry.
export function BillsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const vendorsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const billsKey = activeCompany ? companyScopedKey(activeCompany.name, "bills") : null;
  const { items: vendors } = useLocalCollection<Vendor>(vendorsKey ?? "newgl:phase1:pending:vendors");
  const { items: bills, hydrated, add, update, remove } = useLocalCollection<Bill>(billsKey ?? "newgl:phase1:pending:bills");

  const vendorOptions = useMemo(
    () => vendors.filter((v) => v.status === "ACTIVE").map((v) => ({ value: v.id, label: v.name })),
    [vendors]
  );
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [v.id, v.name])), [vendors]);

  const today = new Date().toISOString().slice(0, 10);
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
  }

  function startEdit(bill: Bill) {
    setEditingId(bill.id);
    setVendorId(bill.vendorId);
    setBillNumber(bill.billNumber ?? "");
    setBillDate(bill.billDate);
    setDueDate(bill.dueDate);
    setAmount(String(bill.amount));
    setMemo(bill.memo ?? "");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!vendorId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    const patch = {
      vendorId,
      billNumber: billNumber.trim() || undefined,
      billDate,
      dueDate,
      amount: parsedAmount,
      memo: memo.trim() || undefined
    };
    if (editingId) {
      update(editingId, patch);
      toast({ variant: "success", title: "Bill updated" });
    } else {
      add({ id: localId(), status: "OPEN", createdAt: new Date().toISOString(), ...patch });
      toast({ variant: "success", title: "Bill added" });
    }
    resetForm();
  }

  function cycleStatus(bill: Bill) {
    const next: BillStatus = bill.status === "DRAFT" ? "OPEN" : bill.status === "OPEN" ? "PAID" : "DRAFT";
    update(bill.id, { status: next });
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
      <Card
        title={editingId ? "Edit bill" : "Add a bill"}
        description="Not backed by a server yet -- saved to this browser only. Marking a bill Paid doesn't post anything to your ledger."
        className="mb-6"
      >
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
            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </form>
        )}
      </Card>

      <Card title="Bills" description="Click a status badge to cycle Draft → Open → Paid.">
        {!hydrated ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : bills.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">No bills yet.</p>
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Vendor</Table.HeaderCell>
                <Table.HeaderCell>Bill #</Table.HeaderCell>
                <Table.HeaderCell>Due</Table.HeaderCell>
                <Table.HeaderCell align="right">Amount</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {bills.map((bill) => (
                <Table.Row key={bill.id}>
                  <Table.Cell className="font-medium text-[var(--color-text-global)]">
                    {vendorNameById.get(bill.vendorId) ?? "Unknown vendor"}
                  </Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">{bill.billNumber || "--"}</Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">{bill.dueDate}</Table.Cell>
                  <Table.Cell align="right" className="text-[var(--color-text-global)]">
                    {formatMoney(bill.amount)}
                  </Table.Cell>
                  <Table.Cell>
                    <button type="button" onClick={() => cycleStatus(bill)}>
                      <Badge variant={STATUS_BADGE_VARIANT[bill.status]} size="sm" className="cursor-pointer">
                        {STATUS_OPTIONS.find((o) => o.value === bill.status)?.label}
                      </Badge>
                    </button>
                  </Table.Cell>
                  <Table.Cell align="right">
                    <div className="flex justify-end gap-1.5">
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
        )}
      </Card>
    </>
  );
}
