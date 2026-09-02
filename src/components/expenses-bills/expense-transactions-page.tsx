"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Vendor } from "@/lib/local-store/expenses-bills-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function signedImpact(account: Account, type: "DEBIT" | "CREDIT", amount: number): number {
  if (DEBIT_NORMAL_CATEGORIES.has(account.category)) {
    return type === "DEBIT" ? amount : -amount;
  }
  return type === "CREDIT" ? amount : -amount;
}

type VendorTags = Record<string, string>; // transactionId -> vendorId, local-only tagging

// Real transaction data (this app already tracks it), filtered to expense
// postings -- unlike Vendors/Bills/Mileage, this doesn't need a new
// backend concept. The only local-only piece is tagging a transaction
// with a vendor, since vendors themselves are still Phase 1 local data.
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

  const vendorsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const tagsKey = activeCompany ? companyScopedKey(activeCompany.name, "expense-transaction-vendor-tags") : null;
  const { items: vendors } = useLocalCollection<Vendor>(vendorsKey ?? "newgl:phase1:pending:vendors");
  const { items: tagRows, add: addTagRow, update: updateTagRow } = useLocalCollection<{ id: string; vendorId: string }>(
    tagsKey ?? "newgl:phase1:pending:tags"
  );
  const tags: VendorTags = useMemo(
    () => Object.fromEntries(tagRows.map((row) => [row.id, row.vendorId])),
    [tagRows]
  );

  function setVendorTag(transactionId: string, vendorId: string) {
    const existing = tagRows.find((row) => row.id === transactionId);
    if (!vendorId) return; // "None" selected -- nothing to persist, leave untagged
    if (existing) updateTagRow(transactionId, { vendorId });
    else addTagRow({ id: transactionId, vendorId });
  }

  const [dateRange, setDateRange] = useState<"12m" | "ytd" | "all">("12m");
  const rangeStart = useMemo(() => {
    const now = new Date();
    if (dateRange === "12m") return new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()).toISOString().slice(0, 10);
    if (dateRange === "ytd") return `${now.getFullYear()}-01-01`;
    return "0000-01-01";
  }, [dateRange]);

  const expenseTransactions = useMemo(() => {
    return transactions
      .filter((txn) => txn.transactionDate >= rangeStart)
      .map((txn) => {
        const expenseAmount = txn.postings.reduce((sum, posting) => {
          const account = accountById.get(posting.accountId);
          if (!account || (account.category !== "EXPENSE" && account.category !== "OTHER_EXPENSE")) return sum;
          return sum + signedImpact(account, posting.type, posting.amount);
        }, 0);
        return { txn, expenseAmount };
      })
      .filter(({ expenseAmount }) => expenseAmount > 0)
      .sort((a, b) => b.txn.transactionDate.localeCompare(a.txn.transactionDate));
  }, [transactions, accountById, rangeStart]);

  const vendorOptions = useMemo(() => [{ value: "", label: "None" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))], [vendors]);

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--color-text-global)]">Expenses</h1>
        <div className="w-40">
          <Select
            value={dateRange}
            onChange={(v) => setDateRange(v as "12m" | "ytd" | "all")}
            options={[
              { value: "12m", label: "Last 12 months" },
              { value: "ytd", label: "This year" },
              { value: "all", label: "All time" }
            ]}
            placeholder="Dates"
            allowCustomValue={false}
            optionSize="sm"
          />
        </div>
      </div>
      <Card>
      {loading ? (
        <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
      ) : expenseTransactions.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-base font-semibold text-[var(--color-text-global)]">No expenses found</p>
          <p className="mt-1 text-sm text-[var(--color-text-disabled)]">
            Record one from the{" "}
            <Link href="/register" className="text-[var(--color-link-action)] hover:underline">
              Register
            </Link>
            .
          </p>
        </div>
      ) : (
        <Table.Root>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Date</Table.HeaderCell>
              <Table.HeaderCell>Payee</Table.HeaderCell>
              <Table.HeaderCell>Memo</Table.HeaderCell>
              <Table.HeaderCell align="right">Amount</Table.HeaderCell>
              <Table.HeaderCell>Vendor</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {expenseTransactions.map(({ txn, expenseAmount }) => (
              <Table.Row key={txn.id}>
                <Table.Cell className="text-[var(--color-text-primary)]">{txn.transactionDate}</Table.Cell>
                <Table.Cell className="text-[var(--color-text-primary)]">{txn.payee || "--"}</Table.Cell>
                <Table.Cell className="text-[var(--color-text-primary)]">{txn.memo || "--"}</Table.Cell>
                <Table.Cell align="right" className="text-[var(--color-text-global)]">
                  {formatMoney(expenseAmount)}
                </Table.Cell>
                <Table.Cell className="w-44">
                  <Select
                    value={tags[txn.id] ?? ""}
                    onChange={(value) => setVendorTag(txn.id, value)}
                    options={vendorOptions}
                    placeholder="None"
                    allowCustomValue={false}
                    optionSize="sm"
                  />
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
