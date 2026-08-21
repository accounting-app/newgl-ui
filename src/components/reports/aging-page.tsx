"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { REPORT_NAV_ITEMS } from "@/constants/reports";
import { REPORT_USER_NAME } from "@/constants/ui";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { AGING_BUCKETS, computeAging, type AgingBucket, type AgingRow } from "@/modules/accounting/domain/aging";
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

function AgingTable({ title, rows }: { title: string; rows: AgingRow[] }) {
  const totals = AGING_BUCKETS.reduce(
    (acc, b) => ({ ...acc, [b.key]: rows.reduce((sum, r) => sum + r.buckets[b.key], 0) }),
    {} as Record<AgingBucket, number>
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
              {AGING_BUCKETS.map((b) => (
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
                {AGING_BUCKETS.map((b) => (
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
              {AGING_BUCKETS.map((b) => (
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
