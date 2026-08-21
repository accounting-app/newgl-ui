"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { SelectField } from "@/components/bank-register/select-field";
import { Card } from "@/components/ui/card";
import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { useTenant } from "@/lib/tenant/tenant-provider";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import { computeAging, overdueTotal } from "@/modules/accounting/domain/aging";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

type Preset = "this_month" | "this_quarter" | "ytd" | "this_year" | "last_year";

const PRESET_OPTIONS = [
  { value: "this_month", label: "This month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "ytd", label: "Year to date" },
  { value: "this_year", label: "This year" },
  { value: "last_year", label: "Last year" }
];

// Same categorical palette used for every donut/legend pairing on this
// card -- ordered so the largest slice always lands on the brand green.
const DONUT_COLORS = ["#16a34a", "#0ea5e9", "#f59e0b", "#a855f7", "#ef4444", "#94a3b8"];

type UsageSummary = {
  summary: { totalActions: number };
  limits: { monthlyAiActions: number; monthlyTokenCap: number } | null;
};

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

/** Same-length window immediately preceding `range`, for "vs prior period" comparisons. */
function previousRange(range: { from: string; to: string }): { from: string; to: string } {
  const [fy, fm, fd] = range.from.split("-").map(Number);
  const [ty, tm, td] = range.to.split("-").map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td);
  const lengthMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000);
  const prevFrom = new Date(prevTo.getTime() - lengthMs);
  return { from: isoDate(prevFrom), to: isoDate(prevTo) };
}

/** null = no baseline to compare against ("New" rather than a misleading %). */
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
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

function computeTotals(transactions: Transaction[], accountById: Map<string, Account>) {
  const incomeCategories = new Set(["INCOME", "OTHER_INCOME"]);
  const expenseCategories = new Set(["EXPENSE", "OTHER_EXPENSE"]);
  let income = 0;
  let expenses = 0;
  transactions.forEach((t) => {
    t.postings.forEach((posting) => {
      const account = accountById.get(posting.accountId);
      if (!account) return;
      const impact = signedImpact(account, posting.type, posting.amount);
      if (incomeCategories.has(account.category)) income += impact;
      if (expenseCategories.has(account.category)) expenses += impact;
    });
  });
  return { income, expenses };
}

type ChangeBadgeProps = { percent: number | null };

function ChangeBadge({ percent }: ChangeBadgeProps) {
  if (percent === null) {
    return <span className="text-xs font-medium text-[var(--color-icon-secondary)]">New this period</span>;
  }
  if (percent === 0) {
    return <span className="text-xs font-medium text-[var(--color-icon-secondary)]">No change</span>;
  }
  const isUp = percent > 0;
  const Icon = isUp ? ArrowUp : ArrowDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${isUp ? "text-emerald-600" : "text-orange-600"}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {isUp ? "Up" : "Down"} {Math.abs(percent)}%
    </span>
  );
}

export function DashboardMetrics() {
  const services = useMemo(() => getServiceContainer(), []);
  const { tenant } = useTenant();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<Preset>("ytd");

  useEffect(() => {
    Promise.all([
      services.accountService.listAccounts(),
      services.transactionService.listTransactions({ status: "POSTED" }),
      request<UsageSummary>(BASE_API_URL, "/ai/usage").catch(() => null)
    ])
      .then(([accountList, transactionList, usageResult]) => {
        setAccounts(accountList);
        setTransactions(transactionList);
        setUsage(usageResult);
      })
      .finally(() => setLoading(false));
  }, [services]);

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const range = useMemo(() => rangeForPreset(preset), [preset]);
  const priorRange = useMemo(() => previousRange(range), [range]);

  const periodTransactions = useMemo(
    () => transactions.filter((t) => t.transactionDate >= range.from && t.transactionDate <= range.to),
    [transactions, range]
  );
  const priorPeriodTransactions = useMemo(
    () => transactions.filter((t) => t.transactionDate >= priorRange.from && t.transactionDate <= priorRange.to),
    [transactions, priorRange]
  );

  const { income, expenses } = useMemo(
    () => computeTotals(periodTransactions, accountById),
    [periodTransactions, accountById]
  );
  const { income: priorIncome, expenses: priorExpenses } = useMemo(
    () => computeTotals(priorPeriodTransactions, accountById),
    [priorPeriodTransactions, accountById]
  );

  const netIncome = income - expenses;
  const priorNetIncome = priorIncome - priorExpenses;
  const netChangePercent = percentChange(netIncome, priorNetIncome);
  const expenseChangePercent = percentChange(expenses, priorExpenses);
  const maxFlow = Math.max(income, expenses, Math.abs(netIncome), 1);

  // Independent of the period selector above -- "what's overdue as of today"
  // doesn't have a "this quarter" reading the way cash flow does, same as
  // PlainGL's own dashboard "needs attention" panel.
  const overdueAR = useMemo(() => {
    const today = isoDate(new Date());
    return overdueTotal(computeAging(accounts, transactions, "ACCOUNTS_RECEIVABLE", today));
  }, [accounts, transactions]);
  const overdueAP = useMemo(() => {
    const today = isoDate(new Date());
    return overdueTotal(computeAging(accounts, transactions, "ACCOUNTS_PAYABLE", today));
  }, [accounts, transactions]);

  const bankAccounts = useMemo(
    () => accounts.filter((a) => a.category === "BANK" && a.status === "ACTIVE"),
    [accounts]
  );
  const creditCardAccounts = useMemo(
    () => accounts.filter((a) => a.category === "CREDIT_CARD" && a.status === "ACTIVE"),
    [accounts]
  );
  const totalBankBalance = useMemo(
    () => bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0),
    [bankAccounts]
  );

  const { expenseSlices, expenseSliceTotal } = useMemo(() => {
    const totals = new Map<string, number>();
    periodTransactions.forEach((t) => {
      t.postings.forEach((posting) => {
        const account = accountById.get(posting.accountId);
        if (!account) return;
        if (account.category !== "EXPENSE" && account.category !== "OTHER_EXPENSE") return;
        const impact = signedImpact(account, posting.type, posting.amount);
        if (impact <= 0) return;
        const topSegment = account.name.split(":")[0];
        totals.set(topSegment, (totals.get(topSegment) ?? 0) + impact);
      });
    });
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const restTotal = sorted.slice(5).reduce((sum, [, amount]) => sum + amount, 0);
    const slices = restTotal > 0 ? [...top, ["Other", restTotal] as [string, number]] : top;
    const total = slices.reduce((sum, [, amount]) => sum + amount, 0);
    return { expenseSlices: slices, expenseSliceTotal: total };
  }, [periodTransactions, accountById]);

  const donutGradient = useMemo(() => {
    if (expenseSliceTotal <= 0) return "var(--color-container-background-accent)";
    let cursor = 0;
    const stops = expenseSlices.map(([, amount], index) => {
      const pct = (amount / expenseSliceTotal) * 100;
      const start = cursor;
      cursor += pct;
      return `${DONUT_COLORS[index % DONUT_COLORS.length]} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${stops.join(", ")})`;
  }, [expenseSlices, expenseSliceTotal]);

  const actionsUsed = usage?.summary.totalActions ?? 0;
  const actionsLimit = usage?.limits?.monthlyAiActions ?? null;
  const usagePercent = actionsLimit ? Math.min(100, Math.round((actionsUsed / actionsLimit) * 100)) : 0;

  if (loading) {
    return (
      <section className="mt-2 w-full">
        <p className="text-sm text-[var(--color-text-primary)]">Loading dashboard…</p>
      </section>
    );
  }

  return (
    <section className="w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-[var(--color-text-global)]">Business at a glance</h2>
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

      {overdueAR > 0.005 || overdueAP > 0.005 ? (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-400">
            Needs attention
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            {overdueAR > 0.005 ? (
              <p className="text-sm text-[var(--color-text-primary)]">
                <span className="font-semibold text-[var(--color-text-global)]">{formatMoney(overdueAR)}</span> in
                overdue receivables
              </p>
            ) : null}
            {overdueAP > 0.005 ? (
              <p className="text-sm text-[var(--color-text-primary)]">
                <span className="font-semibold text-[var(--color-text-global)]">{formatMoney(overdueAP)}</span> in
                overdue payables
              </p>
            ) : null}
            <Link href="/reports/aging" className="ml-auto text-xs text-[var(--color-link-action)] hover:underline">
              View aging report
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        {/* Cash flow -- in place of QBO's payment-request funnel, since this
            app has no invoicing/get-paid feature: money in, money out, net,
            styled the same way (connected step cards). */}
        <Card className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
            Cash flow
          </p>
          <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-global)]">
            Money in, money out, and your net for {range.label.toLowerCase()}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)]">
              <div className="h-1.5 bg-emerald-500" style={{ width: `${Math.round((income / maxFlow) * 100)}%` }} />
              <div className="p-3">
                <p className="text-xs text-[var(--color-icon-secondary)]">Money in</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-text-global)]">{formatMoney(income)}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)]">
              <div className="h-1.5 bg-orange-500" style={{ width: `${Math.round((expenses / maxFlow) * 100)}%` }} />
              <div className="p-3">
                <p className="text-xs text-[var(--color-icon-secondary)]">Money out</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-text-global)]">{formatMoney(expenses)}</p>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)]">
              <div
                className={`h-1.5 ${netIncome >= 0 ? "bg-sky-500" : "bg-red-500"}`}
                style={{ width: `${Math.round((Math.abs(netIncome) / maxFlow) * 100)}%` }}
              />
              <div className="p-3">
                <p className="text-xs text-[var(--color-icon-secondary)]">Net</p>
                <p className="mt-1 text-xl font-semibold text-[var(--color-text-global)]">{formatMoney(netIncome)}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Bank accounts */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
              Bank accounts
            </p>
            <span className="text-[11px] text-[var(--color-icon-secondary)]">As of today</span>
          </div>
          <p className="mb-3 text-2xl font-semibold text-[var(--color-text-global)]">
            {formatMoney(totalBankBalance)}
          </p>
          <ul className="flex flex-col divide-y divide-[var(--color-container-background-secondary)]">
            {bankAccounts.slice(0, 4).map((account) => (
              <li key={account.id} className="flex items-center justify-between py-1.5 text-sm">
                <Link href={`/register?account=${account.id}`} className="truncate text-[var(--color-text-primary)] hover:underline">
                  {account.name}
                </Link>
                <span className="text-[var(--color-text-global)]">{formatMoney(account.currentBalance)}</span>
              </li>
            ))}
            {creditCardAccounts.slice(0, 2).map((account) => (
              <li key={account.id} className="flex items-center justify-between py-1.5 text-sm">
                <Link href={`/register?account=${account.id}`} className="truncate text-[var(--color-text-primary)] hover:underline">
                  {account.name}
                </Link>
                <span className="text-[var(--color-text-global)]">{formatMoney(account.currentBalance)}</span>
              </li>
            ))}
            {bankAccounts.length === 0 && creditCardAccounts.length === 0 ? (
              <li className="py-1.5 text-sm text-[var(--color-text-disabled)]">No bank accounts yet.</li>
            ) : null}
          </ul>
          <Link href="/register" className="mt-3 inline-block text-xs text-[var(--color-link-action)] hover:underline">
            Go to registers
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Profit & Loss */}
        <Card>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
            Profit &amp; loss
          </p>
          <p className="mb-1 text-sm text-[var(--color-text-primary)]">Net profit &middot; {range.label}</p>
          <p className="mb-1 text-2xl font-semibold text-[var(--color-text-global)]">{formatMoney(netIncome)}</p>
          <ChangeBadge percent={netChangePercent} />
          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--color-divider-tertiary)] pt-4">
            <div className="flex items-center gap-2">
              <span className="h-6 w-1 rounded-full bg-emerald-500" />
              <div className="text-sm">
                <p className="text-[var(--color-text-global)]">{formatMoney(income)}</p>
                <p className="text-xs text-[var(--color-icon-secondary)]">Income</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-6 w-1 rounded-full bg-orange-500" />
              <div className="text-sm">
                <p className="text-[var(--color-text-global)]">{formatMoney(expenses)}</p>
                <p className="text-xs text-[var(--color-icon-secondary)]">Expenses</p>
              </div>
            </div>
          </div>
          <Link
            href="/reports/profit-loss"
            className="mt-4 inline-block text-xs text-[var(--color-link-action)] hover:underline"
          >
            View full report
          </Link>
        </Card>

        {/* Expenses donut */}
        <Card>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
            Expenses
          </p>
          <p className="mb-1 text-sm text-[var(--color-text-primary)]">Spending &middot; {range.label}</p>
          <p className="mb-1 text-2xl font-semibold text-[var(--color-text-global)]">{formatMoney(expenses)}</p>
          <ChangeBadge percent={expenseChangePercent} />
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-24 w-24 shrink-0 rounded-full" style={{ background: donutGradient }}>
              <div className="absolute inset-[10px] rounded-full bg-[var(--color-container-background-primary)]" />
            </div>
            <ul className="flex min-w-0 flex-col gap-1.5">
              {expenseSlices.length === 0 ? (
                <li className="text-xs text-[var(--color-text-disabled)]">No expenses yet this period.</li>
              ) : (
                expenseSlices.map(([label, amount], index) => (
                  <li key={label} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                    />
                    <span className="truncate text-[var(--color-text-primary)]">{label}</span>
                    <span className="ml-auto shrink-0 text-[var(--color-text-global)]">{formatMoney(amount)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <Link
            href="/reports/pl-detail"
            className="mt-4 inline-block text-xs text-[var(--color-link-action)] hover:underline"
          >
            View expense report
          </Link>
        </Card>

        {/* AI usage -- real data, standing in for QBO's lending promo slot */}
        <Card>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">AI</p>
          <div className="mb-3 inline-flex rounded-lg bg-[var(--color-highlight-badge-background)] p-2 text-[var(--color-highlight-badge-text)]">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-[var(--color-text-global)]">
            {tenant?.aiEnabled ? "AI is helping categorize your books" : "Turn on AI categorization"}
          </h3>
          {actionsLimit !== null ? (
            <>
              <div className="mb-2 mt-3 flex items-baseline justify-between text-xs text-[var(--color-text-primary)]">
                <span>
                  {actionsUsed} of {actionsLimit} actions used
                </span>
                <span>{usagePercent}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-container-background-accent)]">
                <div
                  className="h-full rounded-full bg-[var(--color-link-action)]"
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            </>
          ) : (
            <p className="mt-3 text-xs text-[var(--color-text-primary)]">
              {actionsUsed} actions used this period.
            </p>
          )}
          <Link
            href="/settings/ai"
            className="mt-4 block rounded-lg border border-[var(--color-divider-tertiary)] px-3 py-2 text-center text-sm font-medium text-[var(--color-text-global)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            Manage AI settings
          </Link>
        </Card>
      </div>
    </section>
  );
}
