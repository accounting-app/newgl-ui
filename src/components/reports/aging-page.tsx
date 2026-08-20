"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { REPORT_NAV_ITEMS } from "@/constants/reports";
import { REPORT_USER_NAME } from "@/constants/ui";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

type Bucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus";

const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "d1_30", label: "1-30" },
  { key: "d31_60", label: "31-60" },
  { key: "d61_90", label: "61-90" },
  { key: "d90plus", label: "90+" }
];

function bucketForAge(days: number): Bucket {
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90plus";
}

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

type AgingRow = { payee: string; buckets: Record<Bucket, number>; total: number };

/**
 * Buckets each posting to an A/R or A/P account by the age of its due date
 * (falling back to the transaction date when unset), grouped by payee --
 * same anchor PlainGL's aging report uses. This ages individual postings,
 * not matched/netted invoice-vs-payment pairs (no invoice-matching exists
 * in this app): a payment posted today lands in "Current" as a negative
 * amount for that payee, offsetting an older invoice elsewhere in their
 * row. The per-payee Total column is always the correct net balance;
 * individual bucket columns are a reasonable approximation, not a precise
 * "which invoice is overdue" breakdown.
 */
function computeAging(
  accounts: Account[],
  transactions: Transaction[],
  category: "ACCOUNTS_RECEIVABLE" | "ACCOUNTS_PAYABLE",
  asOfDate: string
): AgingRow[] {
  const targetAccounts = new Map(accounts.filter((a) => a.category === category).map((a) => [a.id, a]));
  const isDebitNormal = category === "ACCOUNTS_RECEIVABLE";
  const rows = new Map<string, Record<Bucket, number>>();

  transactions.forEach((transaction) => {
    const ageAnchor = transaction.dueDate || transaction.transactionDate;
    if (ageAnchor > asOfDate) return;
    transaction.postings.forEach((posting) => {
      const account = targetAccounts.get(posting.accountId);
      if (!account) return;
      const impact = (posting.type === "DEBIT") === isDebitNormal ? posting.amount : -posting.amount;
      const payee = transaction.payee?.trim() || account.name;
      const bucket = bucketForAge(daysBetween(ageAnchor, asOfDate));
      const existing = rows.get(payee) ?? { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
      existing[bucket] += impact;
      rows.set(payee, existing);
    });
  });

  return [...rows.entries()]
    .map(([payee, buckets]) => ({
      payee,
      buckets,
      total: BUCKETS.reduce((sum, b) => sum + buckets[b.key], 0)
    }))
    .filter((row) => Math.abs(row.total) > 0.0001)
    .sort((a, b) => b.total - a.total);
}

function AgingTable({ title, rows }: { title: string; rows: AgingRow[] }) {
  const totals = BUCKETS.reduce(
    (acc, b) => ({ ...acc, [b.key]: rows.reduce((sum, r) => sum + r.buckets[b.key], 0) }),
    {} as Record<Bucket, number>
  );
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);

  return (
    <div className="mb-8">
      <p className="mb-2 border-b-2 border-[var(--color-divider-tertiary)] pb-1 text-sm font-semibold text-[var(--color-text-primary)]">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--color-text-disabled)]">Nothing outstanding.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
              <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Payee</th>
              {BUCKETS.map((b) => (
                <th key={b.key} className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">
                  {b.label}
                </th>
              ))}
              <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.payee} className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-3 py-1 text-[var(--color-text-primary)]">{row.payee}</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} className="px-3 py-1 text-right text-[var(--color-text-primary)]">
                    {row.buckets[b.key] !== 0 ? formatMoney(row.buckets[b.key]) : "—"}
                  </td>
                ))}
                <td className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">
                  {formatMoney(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)] font-bold text-[var(--color-text-primary)]">
              <td className="px-3 py-1">Total</td>
              {BUCKETS.map((b) => (
                <td key={b.key} className="px-3 py-1 text-right">
                  {formatMoney(totals[b.key])}
                </td>
              ))}
              <td className="px-3 py-1 text-right">{formatMoney(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

export function AgingPage() {
  return (
    <Suspense fallback={null}>
      <AgingPageInner />
    </Suspense>
  );
}

function AgingPageInner() {
  const services = useMemo(() => getServiceContainer(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [asOfDate, setAsOfDate] = useState(() => searchParams.get("asOf") || isoDate(new Date()));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
    services.transactionService
      .listTransactions({ status: "POSTED" })
      .then(setTransactions)
      .catch(() => setTransactions([]));
  }, [services]);

  useEffect(() => {
    const query = asOfDate ? `?asOf=${asOfDate}` : "";
    router.replace(`/reports/aging${query}`, { scroll: false });
  }, [asOfDate, router]);

  const arRows = useMemo(
    () => computeAging(accounts, transactions, "ACCOUNTS_RECEIVABLE", asOfDate || isoDate(new Date())),
    [accounts, transactions, asOfDate]
  );
  const apRows = useMemo(
    () => computeAging(accounts, transactions, "ACCOUNTS_PAYABLE", asOfDate || isoDate(new Date())),
    [accounts, transactions, asOfDate]
  );

  const reportQueryString = asOfDate ? `asOf=${asOfDate}` : "";

  return (
    <main className="tw-override main bg-[var(--color-container-background-primary)] text-sm text-[var(--color-text-primary)]">
      <header className="header header-reports mb-4">
        <div className="w-full">
          <nav className="mb-2 flex items-center gap-1.5 text-xs text-[var(--color-icon-secondary)]">
            <span className="text-[var(--color-icon-secondary)]">‹</span>
            <Link href="/reports" className="hover:underline text-[var(--color-link-text)]">
              Standard Reports
            </Link>
          </nav>
          <div
            role="tablist"
            aria-label="Report type"
            className="mb-6 flex items-center gap-1 border-b border-[var(--color-divider-tertiary)]"
          >
            {REPORT_NAV_ITEMS.map((item) => {
              const isActive = item.type === "aging";
              const href = item.type === "aging" && reportQueryString ? `${item.href}?${reportQueryString}` : item.href;
              return (
                <Link
                  key={item.type}
                  href={href}
                  role="tab"
                  aria-selected={isActive}
                  aria-current={isActive ? "page" : undefined}
                  className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "border-[var(--color-ui-primary)] text-[var(--color-text-primary)]"
                      : "border-transparent text-[var(--color-icon-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <h1 className="page-title">A/R &amp; A/P Aging</h1>
        </div>
        <div className="header-filters">
          <div>
            <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">As of</p>
            <InputField type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>
        </div>
      </header>

      <section className="page-content">
        <section className="report-print-card mx-auto mt-8 w-full max-w-[840px] rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5 shadow-sm">
          <div className="mb-4 flex justify-end">
            <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
              Print
            </Button>
          </div>
          <div className="mb-4 text-center">
            <h2 className="text-[28px] font-medium text-[var(--color-text-global)] mb-2">{REPORT_USER_NAME}</h2>
            <p className="text-[16px] text-[var(--color-text-primary)] mb-2">A/R &amp; A/P Aging</p>
            <p className="text-xs text-[var(--color-icon-secondary)]">As of {asOfDate || isoDate(new Date())}</p>
          </div>

          <AgingTable title="Accounts Receivable" rows={arRows} />
          <AgingTable title="Accounts Payable" rows={apRows} />
        </section>
      </section>
    </main>
  );
}
