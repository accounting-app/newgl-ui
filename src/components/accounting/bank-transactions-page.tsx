"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { PendingBankTxn, PendingTxnStatus } from "@/lib/local-store/accounting-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import type { Account } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TABS: { value: PendingTxnStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "POSTED", label: "Posted" },
  { value: "EXCLUDED", label: "Excluded" }
];

// Phase 1: a staging area for reviewing/categorizing transactions before
// they post -- local-only data, entirely separate from the real Register
// and its own reconcile-status cell. See
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md. Real bank
// feed import is Phase 1.5; for now rows are added manually.
export function BankTransactionsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);

  const bankAccounts = useMemo(() => accounts.filter((a) => isRegisterAccountCategory(a.category)), [accounts]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  useEffect(() => {
    if (!selectedAccountId && bankAccounts.length > 0) setSelectedAccountId(bankAccounts[0].id);
  }, [bankAccounts, selectedAccountId]);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const txnsKey = activeCompany ? companyScopedKey(activeCompany.name, "pending-bank-txns") : null;
  const { items: allTxns, hydrated, add, update, remove } = useLocalCollection<PendingBankTxn>(
    txnsKey ?? "newgl:phase1:pending:pending-bank-txns"
  );
  const accountTxns = useMemo(() => allTxns.filter((t) => t.accountId === selectedAccountId), [allTxns, selectedAccountId]);

  const [tab, setTab] = useState<PendingTxnStatus>("PENDING");
  const visibleTxns = useMemo(() => accountTxns.filter((t) => t.status === tab), [accountTxns, tab]);
  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map(({ value }) => [value, accountTxns.filter((t) => t.status === value).length])),
    [accountTxns]
  );

  const expenseAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE" || a.category === "INCOME").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const [showAddForm, setShowAddForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [payee, setPayee] = useState("");
  const [direction, setDirection] = useState<"spent" | "received">("spent");
  const [amount, setAmount] = useState("");

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(amount);
    if (!selectedAccountId || !description.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    add({
      id: localId(),
      accountId: selectedAccountId,
      date,
      description: description.trim(),
      payee: payee.trim() || undefined,
      spent: direction === "spent" ? parsed : undefined,
      received: direction === "received" ? parsed : undefined,
      status: "PENDING",
      createdAt: new Date().toISOString()
    });
    setDescription("");
    setPayee("");
    setAmount("");
    setShowAddForm(false);
    toast({ variant: "success", title: "Transaction added" });
  }

  function handlePost(txn: PendingBankTxn) {
    if (!txn.categoryAccountId) {
      toast({ variant: "error", title: "Select a category first" });
      return;
    }
    update(txn.id, { status: "POSTED" });
    toast({
      variant: "success",
      title: "Marked posted",
      description: "Local-only for now -- this doesn't create a real transaction yet."
    });
  }

  function handleExclude(txn: PendingBankTxn) {
    update(txn.id, { status: "EXCLUDED" });
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--color-text-global)]">Bank Transactions</h1>
        <Link href="/register" className="text-sm text-[var(--color-link-action)] hover:underline">
          Go to bank register
        </Link>
      </div>

      {bankAccounts.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-text-disabled)]">
            No bank or credit card accounts yet. Add one from{" "}
            <Link href="/all-apps/chart-of-accounts" className="text-[var(--color-link-action)] hover:underline">
              Chart of Accounts
            </Link>
            .
          </p>
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-action-standard-subtle-hover)] text-[var(--color-ui-primary)]">
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="w-56">
                  <Select value={selectedAccountId} onChange={setSelectedAccountId} options={bankAccounts.map((a) => ({ value: a.id, label: a.name }))} placeholder="Select account" allowCustomValue={false} />
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-primary)]">
                Balance: <span className="font-semibold text-[var(--color-text-global)]">{formatMoney(selectedAccount?.currentBalance ?? 0)}</span>
              </p>
            </div>
          </Card>

          <Card
            title="Transactions"
            description={showAddForm ? undefined : "Not backed by a real bank feed yet -- add transactions here to try the review workflow."}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex gap-1">
                {TABS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTab(value)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                      tab === value
                        ? "bg-[var(--color-action-passive-subtle-active)] text-[var(--color-text-global)]"
                        : "text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                    }`}
                  >
                    {label} {tabCounts[value] ? `(${tabCounts[value]})` : ""}
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowAddForm((v) => !v)}>
                {showAddForm ? "Cancel" : "Add transaction"}
              </Button>
            </div>

            {showAddForm ? (
              <form onSubmit={handleAdd} className="mb-4 flex flex-wrap items-end gap-3 border-b border-[var(--color-divider-tertiary)] pb-4">
                <div className="w-36">
                  <InputField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="min-w-[160px] flex-1">
                  <InputField label="Description" placeholder="e.g. Printer Paper & Ink" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="w-40">
                  <InputField label="Payee (optional)" placeholder="From/To" value={payee} onChange={(e) => setPayee(e.target.value)} />
                </div>
                <div className="w-32">
                  <Select value={direction} onChange={(v) => setDirection(v as "spent" | "received")} options={[{ value: "spent", label: "Spent" }, { value: "received", label: "Received" }]} placeholder="Type" allowCustomValue={false} />
                </div>
                <div className="w-32">
                  <NumberField label="Amount" currency placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <Button type="submit" disabled={!description.trim() || amount.trim() === ""}>
                  Add
                </Button>
              </form>
            ) : null}

            {!hydrated ? (
              <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
            ) : visibleTxns.length === 0 ? (
              <p className="text-sm text-[var(--color-text-disabled)]">No {tab.toLowerCase()} transactions.</p>
            ) : (
              <Table.Root>
                <Table.Head>
                  <Table.Row>
                    <Table.HeaderCell>Date</Table.HeaderCell>
                    <Table.HeaderCell>Bank description</Table.HeaderCell>
                    <Table.HeaderCell align="right">Spent</Table.HeaderCell>
                    <Table.HeaderCell align="right">Received</Table.HeaderCell>
                    <Table.HeaderCell>From/To</Table.HeaderCell>
                    <Table.HeaderCell>Category</Table.HeaderCell>
                    <Table.HeaderCell />
                  </Table.Row>
                </Table.Head>
                <Table.Body>
                  {visibleTxns.map((txn) => (
                    <Table.Row key={txn.id}>
                      <Table.Cell className="text-[var(--color-text-primary)]">{txn.date}</Table.Cell>
                      <Table.Cell className="text-[var(--color-text-primary)]">{txn.description}</Table.Cell>
                      <Table.Cell align="right" className="text-[var(--color-text-global)]">
                        {txn.spent ? formatMoney(txn.spent) : ""}
                      </Table.Cell>
                      <Table.Cell align="right" className="text-[var(--color-text-global)]">
                        {txn.received ? formatMoney(txn.received) : ""}
                      </Table.Cell>
                      <Table.Cell className="text-[var(--color-text-primary)]">{txn.payee || "--"}</Table.Cell>
                      <Table.Cell className="w-48">
                        {tab === "PENDING" ? (
                          <Select
                            value={txn.categoryAccountId ?? ""}
                            onChange={(value) => update(txn.id, { categoryAccountId: value || undefined })}
                            options={expenseAccountOptions}
                            placeholder="Select category"
                            allowCustomValue={false}
                            optionSize="sm"
                          />
                        ) : (
                          <span className="text-[var(--color-text-primary)]">
                            {txn.categoryAccountId ? accountNameById.get(txn.categoryAccountId) ?? "--" : "--"}
                          </span>
                        )}
                      </Table.Cell>
                      <Table.Cell align="right">
                        {tab === "PENDING" ? (
                          <div className="flex justify-end gap-1.5">
                            <Button size="sm" onClick={() => handlePost(txn)}>
                              Post
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => handleExclude(txn)}>
                              Exclude
                            </Button>
                          </div>
                        ) : (
                          <Badge variant={tab === "POSTED" ? "success" : "neutral"} size="sm">
                            {tab === "POSTED" ? "Posted" : "Excluded"}
                          </Badge>
                        )}
                        {tab !== "PENDING" ? (
                          <Button variant="destructive" size="sm" className="ml-1.5" onClick={() => remove(txn.id)}>
                            Delete
                          </Button>
                        ) : null}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
          </Card>
        </>
      )}
    </>
  );
}
