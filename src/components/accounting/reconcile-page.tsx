"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { ReconciliationRecord } from "@/lib/local-store/accounting-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import type { Account } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Phase 1: records that a reconciliation happened (account, statement
// dates/balances) -- doesn't actually walk through matching individual
// transactions against a statement yet (that needs the real Register data
// wired in, Phase 1.5). See newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function ReconcilePage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  const reconcilableAccounts = useMemo(() => accounts.filter((a) => isRegisterAccountCategory(a.category)), [accounts]);

  const recordsKey = activeCompany ? companyScopedKey(activeCompany.name, "reconciliations") : null;
  const { items: records, hydrated, add } = useLocalCollection<ReconciliationRecord>(recordsKey ?? "newgl:phase1:pending:reconciliations");

  const [accountId, setAccountId] = useState("");
  useEffect(() => {
    if (!accountId && reconcilableAccounts.length > 0) setAccountId(reconcilableAccounts[0].id);
  }, [reconcilableAccounts, accountId]);
  const selectedAccount = accounts.find((a) => a.id === accountId);

  const [statementEndingBalance, setStatementEndingBalance] = useState("");
  const [statementEndingDate, setStatementEndingDate] = useState("");
  const accountRecords = useMemo(() => records.filter((r) => r.accountId === accountId).sort((a, b) => b.completedAt.localeCompare(a.completedAt)), [records, accountId]);
  const beginningBalance = accountRecords[0]?.statementEndingBalance ?? 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(statementEndingBalance);
    if (!accountId || !statementEndingDate || !Number.isFinite(parsed)) return;
    add({
      id: localId(),
      accountId,
      statementEndingDate,
      statementEndingBalance: parsed,
      beginningBalance,
      completedAt: new Date().toISOString()
    });
    toast({ variant: "success", title: "Reconciliation recorded" });
    setStatementEndingBalance("");
    setStatementEndingDate("");
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <Card title="Reconcile" className="mb-6">
        {reconcilableAccounts.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">No bank or credit card accounts yet.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="w-64">
              <Select label="Which account do you want to reconcile?" value={accountId} onChange={setAccountId} options={reconcilableAccounts.map((a) => ({ value: a.id, label: a.name }))} placeholder="Select account" allowCustomValue={false} />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <p className="mb-1 text-xs text-[var(--color-icon-secondary)]">Beginning balance</p>
                <p className="flex h-9 items-center text-sm text-[var(--color-text-primary)]">{formatMoney(beginningBalance)}</p>
              </div>
              <div className="w-40">
                <NumberField label="Statement ending balance" currency placeholder="0.00" value={statementEndingBalance} onChange={(e) => setStatementEndingBalance(e.target.value)} />
              </div>
              <div className="w-40">
                <InputField label="Statement ending date" type="date" value={statementEndingDate} onChange={(e) => setStatementEndingDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Button type="submit" disabled={statementEndingBalance.trim() === "" || !statementEndingDate}>
                Start reconciling
              </Button>
            </div>
          </form>
        )}
      </Card>

      {selectedAccount ? (
        <Card title={`Reconciliation history — ${selectedAccount.name}`}>
          {!hydrated ? (
            <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
          ) : accountRecords.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)]">No reconciliations recorded yet for this account.</p>
          ) : (
            <Table.Root>
              <Table.Head>
                <Table.Row>
                  <Table.HeaderCell>Statement date</Table.HeaderCell>
                  <Table.HeaderCell align="right">Beginning balance</Table.HeaderCell>
                  <Table.HeaderCell align="right">Ending balance</Table.HeaderCell>
                  <Table.HeaderCell>Completed</Table.HeaderCell>
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {accountRecords.map((record) => (
                  <Table.Row key={record.id}>
                    <Table.Cell className="text-[var(--color-text-primary)]">{record.statementEndingDate}</Table.Cell>
                    <Table.Cell align="right" className="text-[var(--color-text-primary)]">{formatMoney(record.beginningBalance)}</Table.Cell>
                    <Table.Cell align="right" className="text-[var(--color-text-global)]">{formatMoney(record.statementEndingBalance)}</Table.Cell>
                    <Table.Cell className="text-[var(--color-text-primary)]">{new Date(record.completedAt).toLocaleDateString()}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Card>
      ) : null}
    </>
  );
}
