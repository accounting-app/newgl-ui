"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Bill } from "@/lib/local-store/expenses-bills-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function signedImpact(account: Account, type: "DEBIT" | "CREDIT", amount: number): number {
  if (DEBIT_NORMAL_CATEGORIES.has(account.category)) return type === "DEBIT" ? amount : -amount;
  return type === "CREDIT" ? amount : -amount;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type FunnelStageProps = { label: string; value: string; last?: boolean };

function FunnelStage({ label, value, last = false }: FunnelStageProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-[140px] flex-1 rounded-lg border border-[var(--color-divider-tertiary)] p-4">
        <p className="text-xs uppercase tracking-wide text-[var(--color-icon-secondary)]">{label}</p>
        <p className="mt-1 text-lg font-semibold text-[var(--color-text-global)]">{value}</p>
      </div>
      {!last ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-icon-secondary)]" aria-hidden="true" /> : null}
    </div>
  );
}

// Phase 1: the funnel stages read local-only Bills data; the spend chart
// reads real posted transactions (expense postings), same source as
// Expense Transactions. See
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function ExpensesBillsOverviewPage() {
  const { activeCompany } = useCompany();
  const services = useMemo(() => getServiceContainer(), []);

  const billsKey = activeCompany ? companyScopedKey(activeCompany.name, "bills") : null;
  const { items: bills, hydrated: billsHydrated } = useLocalCollection<Bill>(billsKey ?? "newgl:phase1:pending:bills");

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(true);
  useEffect(() => {
    Promise.all([services.transactionService.listTransactions({ status: "POSTED" }), services.accountService.listAccounts()])
      .then(([txns, accts]) => {
        setTransactions(txns);
        setAccounts(accts);
      })
      .finally(() => setTxnsLoading(false));
  }, [services]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const forReviewTotal = useMemo(() => bills.filter((b) => b.status === "DRAFT").reduce((s, b) => s + b.amount, 0), [bills]);
  const unpaidTotal = useMemo(() => bills.filter((b) => b.status === "OPEN").reduce((s, b) => s + b.amount, 0), [bills]);
  const paidTotal = useMemo(() => bills.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amount, 0), [bills]);

  const monthlySpend = useMemo(() => {
    const year = new Date().getFullYear();
    const totals = new Array(12).fill(0);
    transactions.forEach((txn) => {
      if (!txn.transactionDate.startsWith(String(year))) return;
      const month = Number(txn.transactionDate.slice(5, 7)) - 1;
      const expense = txn.postings.reduce((sum, posting) => {
        const account = accountById.get(posting.accountId);
        if (!account || (account.category !== "EXPENSE" && account.category !== "OTHER_EXPENSE")) return sum;
        return sum + signedImpact(account, posting.type, posting.amount);
      }, 0);
      if (expense > 0) totals[month] += expense;
    });
    return totals;
  }, [transactions, accountById]);
  const maxMonthly = Math.max(...monthlySpend, 1);

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <h1 className="mb-4 text-xl font-semibold text-[var(--color-text-global)]">Expenses & Bills overview</h1>

      <Card title="Bills funnel" description="Where your bills stand right now." className="mb-4">
        {!billsHydrated ? (
          <div className="flex gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 flex-1 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <FunnelStage label="For review" value={formatMoney(forReviewTotal)} />
            <FunnelStage label="Unpaid" value={formatMoney(unpaidTotal)} />
            <FunnelStage label="Paid" value={formatMoney(paidTotal)} last />
          </div>
        )}
        <div className="mt-4 flex gap-4 text-sm">
          <Link href="/all-apps/expenses-bills/bills" className="text-[var(--color-link-action)] hover:underline">
            Add a bill
          </Link>
          <Link href="/all-apps/expenses-bills/vendors" className="text-[var(--color-link-action)] hover:underline">
            Add a vendor
          </Link>
          <Link href="/all-apps/expenses-bills/mileage" className="text-[var(--color-link-action)] hover:underline">
            Log mileage
          </Link>
        </div>
      </Card>

      <Card title="Spend over time" description={`Expense transactions posted in ${new Date().getFullYear()}.`}>
        {txnsLoading ? (
          <Skeleton className="h-40 w-full rounded" />
        ) : (
          // Pixel heights, not percentages -- a percentage height only
          // resolves against an ancestor with an explicit height, and
          // these bars sit in an auto-height flex column (items-end sizes
          // each column to its own content, it doesn't stretch to h-40).
          <div className="flex h-[144px] items-end gap-2">
            {monthlySpend.map((value, i) => (
              <div key={MONTH_LABELS[i]} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-[var(--color-positive)]"
                  style={{ height: `${Math.max((value / maxMonthly) * 128, value > 0 ? 4 : 0)}px` }}
                  title={formatMoney(value)}
                />
                <span className="text-[10px] text-[var(--color-icon-secondary)]">{MONTH_LABELS[i]}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
