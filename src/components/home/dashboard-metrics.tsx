"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SelectField } from "@/components/bank-register/select-field";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

type Preset = "this_month" | "this_quarter" | "ytd" | "this_year" | "last_year";

const PRESET_OPTIONS = [
  { value: "this_month", label: "This month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "ytd", label: "Year to date" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" }
];

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rangeForPreset(preset: Preset, today = new Date()): { from: string; to: string; label: string } {
  const year = today.getFullYear();
  switch (preset) {
    case "this_month": {
      const from = new Date(year, today.getMonth(), 1);
      const to = new Date(year, today.getMonth() + 1, 0);
      return { from: isoDate(from), to: isoDate(to), label: "This month" };
    }
    case "this_quarter": {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      const from = new Date(year, quarterStartMonth, 1);
      const to = new Date(year, quarterStartMonth + 3, 0);
      return { from: isoDate(from), to: isoDate(to), label: "This quarter" };
    }
    case "this_year":
      return { from: `${year}-01-01`, to: `${year}-12-31`, label: "This year" };
    case "last_year":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31`, label: "Last year" };
    case "ytd":
    default:
      return { from: `${year}-01-01`, to: isoDate(today), label: `YTD ${year}` };
  }
}

function signedImpact(account: Account, type: "DEBIT" | "CREDIT", amount: number): number {
  if (DEBIT_NORMAL_CATEGORIES.has(account.category)) {
    return type === "DEBIT" ? amount : -amount;
  }
  return type === "CREDIT" ? amount : -amount;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

export function DashboardMetrics() {
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>("ytd");

  useEffect(() => {
    Promise.all([services.accountService.listAccounts(), services.transactionService.listTransactions({ status: "POSTED" })])
      .then(([accountList, transactionList]) => {
        setAccounts(accountList);
        setTransactions(transactionList);
      })
      .finally(() => setLoading(false));
  }, [services]);

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const range = useMemo(() => rangeForPreset(preset), [preset]);

  const periodTransactions = useMemo(
    () => transactions.filter((t) => t.transactionDate >= range.from && t.transactionDate <= range.to),
    [transactions, range]
  );

  const cashOnHand = useMemo(
    () => accounts.filter((a) => a.category === "BANK").reduce((sum, a) => sum + a.currentBalance, 0),
    [accounts]
  );

  const arOutstanding = useMemo(
    () => accounts.filter((a) => a.category === "ACCOUNTS_RECEIVABLE").reduce((sum, a) => sum + a.currentBalance, 0),
    [accounts]
  );

  const { income, expenses, topPayees } = useMemo(() => {
    const incomeCategories = new Set(["INCOME", "OTHER_INCOME"]);
    const expenseCategories = new Set(["EXPENSE", "OTHER_EXPENSE"]);
    let incomeTotal = 0;
    let expenseTotal = 0;
    const payeeIncome = new Map<string, number>();

    periodTransactions.forEach((t) => {
      t.postings.forEach((posting) => {
        const account = accountById.get(posting.accountId);
        if (!account) return;
        const impact = signedImpact(account, posting.type, posting.amount);
        if (incomeCategories.has(account.category)) {
          incomeTotal += impact;
          const label = t.payee || t.memo || account.name;
          payeeIncome.set(label, (payeeIncome.get(label) ?? 0) + impact);
        }
        if (expenseCategories.has(account.category)) {
          expenseTotal += impact;
        }
      });
    });

    const topPayees = [...payeeIncome.entries()]
      .filter(([, amount]) => amount > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { income: incomeTotal, expenses: expenseTotal, topPayees };
  }, [periodTransactions, accountById]);

  const netIncome = income - expenses;
  const maxBar = Math.max(income, expenses, 1);

  const recentActivity = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
        .slice(0, 6)
        .map((t) => {
          // A handful of legacy transactions have no postings recorded (no ledger
          // effect) -- show "—" for those rather than a misleading $0.00.
          const top = [...t.postings].sort((a, b) => b.amount - a.amount)[0];
          const account = top ? accountById.get(top.accountId) : undefined;
          const amount = top && account ? signedImpact(account, top.type, top.amount) : null;
          return { id: t.id, date: t.transactionDate, label: t.payee || t.memo || "—", amount };
        }),
    [transactions, accountById]
  );

  if (loading) {
    return (
      <section className="mx-auto mt-6 w-full max-w-6xl">
        <p className="text-sm text-[var(--color-text-primary)]">Loading dashboard…</p>
      </section>
    );
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-6xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[var(--color-text-global)]">Dashboard</h2>
        <div className="w-44">
          <SelectField
            value={preset}
            onChange={(value) => setPreset(value as Preset)}
            options={PRESET_OPTIONS}
            placeholder="Period"
            allowCustomValue={false}
            optionSize="sm"
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4">
          <p className="text-xs text-[var(--color-icon-secondary)]">Cash on hand</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-global)]">{formatMoney(cashOnHand)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4">
          <p className="text-xs text-[var(--color-icon-secondary)]">A/R outstanding</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-global)]">{formatMoney(arOutstanding)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4">
          <p className="text-xs text-[var(--color-icon-secondary)]">Net income · {range.label}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-global)]">{formatMoney(netIncome)}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4">
          <p className="text-xs text-[var(--color-icon-secondary)]">Transactions · {range.label}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-global)]">{periodTransactions.length}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-6">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-global)]">
            Income vs. expenses · {range.label}
          </h3>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="w-16 text-xs text-[var(--color-icon-secondary)]">Income</span>
              <div className="h-3 flex-1 rounded-full bg-[var(--color-container-background-accent)]">
                <div
                  className="h-3 rounded-full bg-emerald-500"
                  style={{ width: `${Math.round((income / maxBar) * 100)}%` }}
                />
              </div>
              <span className="w-28 text-right text-xs text-[var(--color-text-primary)]">{formatMoney(income)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-16 text-xs text-[var(--color-icon-secondary)]">Expenses</span>
              <div className="h-3 flex-1 rounded-full bg-[var(--color-container-background-accent)]">
                <div
                  className="h-3 rounded-full bg-red-500"
                  style={{ width: `${Math.round((expenses / maxBar) * 100)}%` }}
                />
              </div>
              <span className="w-28 text-right text-xs text-[var(--color-text-primary)]">{formatMoney(expenses)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-[var(--color-divider-tertiary)] pt-2 text-sm font-semibold text-[var(--color-text-global)]">
              <span>Net</span>
              <span>{formatMoney(netIncome)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-6">
          <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-global)]">
            Top income sources · {range.label}
          </h3>
          {topPayees.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)]">No income yet this period.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-container-background-secondary)]">
              {topPayees.map(([payee, amount]) => (
                <li key={payee} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-[var(--color-text-primary)]">{payee}</span>
                  <span className="text-[var(--color-text-global)]">{formatMoney(amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-6 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text-global)]">Recent activity</h3>
            <Link href="/register" className="text-xs text-[var(--color-link-action)] hover:underline">
              Go to Register
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)]">No transactions yet.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-divider-tertiary)] text-left text-xs text-[var(--color-icon-secondary)]">
                  <th className="py-1 pr-3 font-medium">Date</th>
                  <th className="py-1 pr-3 font-medium">Payee / memo</th>
                  <th className="py-1 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((entry) => (
                  <tr key={entry.id} className="border-b border-[var(--color-container-background-secondary)]">
                    <td className="py-1.5 pr-3 text-[var(--color-icon-secondary)]">{formatDate(entry.date)}</td>
                    <td className="py-1.5 pr-3 text-[var(--color-text-primary)]">{entry.label}</td>
                    <td className="py-1.5 text-right text-[var(--color-text-primary)]">
                      {entry.amount === null ? "—" : formatMoney(entry.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
