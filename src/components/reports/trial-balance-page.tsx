"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { REPORT_NAV_ITEMS } from "@/constants/reports";
import { REPORT_USER_NAME } from "@/constants/ui";
import { buildHierarchyRowsMulti } from "@/lib/accounting/account-hierarchy";
import type { ReportValueColumn } from "@/components/reports/report-account-rows";
import { ReportSection } from "@/components/reports/report-section";
import { ReportAccountRows } from "@/components/reports/report-account-rows";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { ACCOUNT_ROOT_GROUPS, DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, LedgerPosting } from "@/modules/accounting/domain/models";

const TB_COLUMNS: ReportValueColumn[] = [
  { key: "debit", format: "money" },
  { key: "credit", format: "money" }
];

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

function signedImpact(account: Account, posting: LedgerPosting): number {
  if (DEBIT_NORMAL_CATEGORIES.has(account.category)) {
    return posting.entryType === "DEBIT" ? posting.amount : -posting.amount;
  }
  return posting.entryType === "CREDIT" ? posting.amount : -posting.amount;
}

type TBRow = { name: string; amount: number };

function accountBalancesAsOf(accounts: Account[], postings: LedgerPosting[], asOfDate: string): Map<string, number> {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const balances = new Map<string, number>();
  accounts.forEach((a) => balances.set(a.id, a.openingBalance ?? 0));
  postings
    .filter((p) => p.status === "POSTED" && p.postingDate <= asOfDate)
    .forEach((posting) => {
      const account = accountById.get(posting.accountId);
      if (!account) return;
      balances.set(posting.accountId, (balances.get(posting.accountId) ?? 0) + signedImpact(account, posting));
    });
  return balances;
}

/**
 * Splits a category's accounts into debit rows and credit rows. Balance is
 * already in each account's "natural" direction (signedImpact convention),
 * so a positive balance sits in the natural column and a negative one (a
 * contra account) flips to the other column — same logic either way,
 * regardless of whether the section itself is debit- or credit-normal.
 */
function debitCreditRows(
  accountsInCategory: Account[],
  balances: Map<string, number>,
  categories: Set<Account["category"]>
): { debitRows: TBRow[]; creditRows: TBRow[] } {
  const debitRows: TBRow[] = [];
  const creditRows: TBRow[] = [];

  accountsInCategory
    .filter((a) => categories.has(a.category))
    .forEach((account) => {
      const balance = balances.get(account.id) ?? 0;
      if (Math.abs(balance) <= 0.0001) return;
      const isDebitNormal = DEBIT_NORMAL_CATEGORIES.has(account.category);
      const inNaturalDirection = balance >= 0;
      const isDebit = isDebitNormal === inNaturalDirection;
      if (isDebit) {
        debitRows.push({ name: account.name, amount: Math.abs(balance) });
      } else {
        creditRows.push({ name: account.name, amount: Math.abs(balance) });
      }
    });

  return { debitRows, creditRows };
}

export function TrialBalancePage() {
  return (
    <Suspense fallback={null}>
      <TrialBalancePageInner />
    </Suspense>
  );
}

function TrialBalancePageInner() {
  const services = useMemo(() => getServiceContainer(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [asOfDate, setAsOfDate] = useState(() => searchParams.get("asOf") || isoDate(new Date()));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postings, setPostings] = useState<LedgerPosting[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    assets: true,
    liabilities: true,
    equity: true,
    income: true,
    expenses: true
  });
  const [collapsedAccounts, setCollapsedAccounts] = useState<Set<string>>(new Set());

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleAccountCollapse(fullName: string) {
    setCollapsedAccounts((prev) => {
      const next = new Set(prev);
      next.has(fullName) ? next.delete(fullName) : next.add(fullName);
      return next;
    });
  }

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
    services.ledgerService.listPostings().then(setPostings).catch(() => setPostings([]));
  }, [services]);

  useEffect(() => {
    const query = asOfDate ? `?asOf=${asOfDate}` : "";
    router.replace(`/reports/trial-balance${query}`, { scroll: false });
  }, [asOfDate, router]);

  const sections = useMemo(() => {
    const balances = accountBalancesAsOf(accounts, postings, asOfDate || isoDate(new Date()));

    return ACCOUNT_ROOT_GROUPS.map(({ key, label, categories }) => {
      const { debitRows, creditRows } = debitCreditRows(accounts, balances, categories);
      const rows = buildHierarchyRowsMulti([debitRows, creditRows]);
      const totalDebit = debitRows.reduce((s, r) => s + r.amount, 0);
      const totalCredit = creditRows.reduce((s, r) => s + r.amount, 0);
      return { key, label, rows, totalDebit, totalCredit };
    });
  }, [accounts, postings, asOfDate]);

  const totalDebit = sections.reduce((s, section) => s + section.totalDebit, 0);
  const totalCredit = sections.reduce((s, section) => s + section.totalCredit, 0);
  const outOfBalance = Math.abs(totalDebit - totalCredit) > 0.005;

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
              const isActive = item.type === "trial_balance";
              const href = item.type === "trial_balance" && reportQueryString ? `${item.href}?${reportQueryString}` : item.href;
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
          <h1 className="page-title">Trial Balance</h1>
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
            <p className="text-[16px] text-[var(--color-text-primary)] mb-2">Trial Balance</p>
            <p className="text-xs text-[var(--color-icon-secondary)]">As of {asOfDate || isoDate(new Date())}</p>
          </div>

          {outOfBalance ? (
            <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-[var(--color-negative)]">
              Debits ({formatMoney(totalDebit)}) and credits ({formatMoney(totalCredit)}) don&apos;t match — check for
              unposted or unbalanced entries.
            </p>
          ) : null}

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
                <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]"> </th>
                <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Debit</th>
                <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Credit</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) =>
                section.rows.length === 0 ? null : (
                  <ReportSection
                    key={section.key}
                    label={section.label}
                    isOpen={openSections[section.key] ?? true}
                    onToggle={() => toggleSection(section.key)}
                    valueColumnCount={2}
                  >
                    <ReportAccountRows
                      rows={section.rows}
                      columns={TB_COLUMNS}
                      collapsedNames={collapsedAccounts}
                      rowKeyPrefix={section.key}
                      onToggleCollapse={toggleAccountCollapse}
                      onDrillAmount={() => {}}
                    />
                    <tr className="border-b border-[var(--color-divider-tertiary)]">
                      <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Total for {section.label}</td>
                      <td className="px-3 py-1 text-right font-semibold text-[var(--color-text-primary)]">
                        {formatMoney(section.totalDebit)}
                      </td>
                      <td className="px-3 py-1 text-right font-semibold text-[var(--color-text-primary)]">
                        {formatMoney(section.totalCredit)}
                      </td>
                    </tr>
                  </ReportSection>
                )
              )}
              <tr className="border-t-2 border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-bold text-[var(--color-text-primary)]">Total</td>
                <td className="px-3 py-1 text-right font-bold text-[var(--color-text-primary)]">{formatMoney(totalDebit)}</td>
                <td className="px-3 py-1 text-right font-bold text-[var(--color-text-primary)]">{formatMoney(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>
    </main>
  );
}
