"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { InputField } from "@/components/ui/input-field";
import { SelectField } from "@/components/bank-register/select-field";
import {
  REPORT_DEFAULT_PERIOD,
  REPORT_PERIOD_OPTIONS,
  REPORT_USER_NAME
} from "@/constants/ui";
import { REPORT_NAV_ITEMS } from "@/constants/reports";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { getTransactionsForAccount } from "@/lib/accounting/drill-down";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, LedgerPosting } from "@/modules/accounting/domain/models";

type ReportPeriodPreset =
  | "all_dates"
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "this_year"
  | "last_week"
  | "last_month"
  | "last_quarter"
  | "last_year"
  | "this_year_to_date"
  | "custom";

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Same preset math as reports-page.tsx -- duplicated rather than shared,
// matching this codebase's existing pattern of small per-report-page helpers
// (see trial-balance-page.tsx's own isoDate).
function dateRangeForPreset(preset: ReportPeriodPreset, today = new Date()): { from: string; to: string } {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = date.getDay();
  const weekStartsMonday = day === 0 ? -6 : 1 - day;

  switch (preset) {
    case "all_dates":
      return { from: "", to: "" };
    case "today":
      return { from: isoDate(date), to: isoDate(date) };
    case "yesterday": {
      const yesterday = new Date(date);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: isoDate(yesterday), to: isoDate(yesterday) };
    }
    case "this_week": {
      const start = new Date(date);
      start.setDate(start.getDate() + weekStartsMonday);
      return { from: isoDate(start), to: isoDate(date) };
    }
    case "this_month": {
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return { from: isoDate(start), to: isoDate(end) };
    }
    case "this_quarter": {
      const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
      const start = new Date(date.getFullYear(), quarterStartMonth, 1);
      const end = new Date(date.getFullYear(), quarterStartMonth + 3, 0);
      return { from: isoDate(start), to: isoDate(end) };
    }
    case "this_year": {
      const start = new Date(date.getFullYear(), 0, 1);
      const end = new Date(date.getFullYear(), 11, 31);
      return { from: isoDate(start), to: isoDate(end) };
    }
    case "last_week": {
      const thisWeekStart = new Date(date);
      thisWeekStart.setDate(thisWeekStart.getDate() + weekStartsMonday);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const lastWeekEnd = new Date(thisWeekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
      return { from: isoDate(lastWeekStart), to: isoDate(lastWeekEnd) };
    }
    case "last_month": {
      const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
      const end = new Date(date.getFullYear(), date.getMonth(), 0);
      return { from: isoDate(start), to: isoDate(end) };
    }
    case "last_quarter": {
      const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
      const start = new Date(date.getFullYear(), quarterStartMonth - 3, 1);
      const end = new Date(date.getFullYear(), quarterStartMonth, 0);
      return { from: isoDate(start), to: isoDate(end) };
    }
    case "last_year": {
      const start = new Date(date.getFullYear() - 1, 0, 1);
      const end = new Date(date.getFullYear() - 1, 11, 31);
      return { from: isoDate(start), to: isoDate(end) };
    }
    case "this_year_to_date": {
      const start = new Date(date.getFullYear(), 0, 1);
      return { from: isoDate(start), to: isoDate(date) };
    }
    case "custom":
    default:
      return { from: "", to: "" };
  }
}

const VALID_REPORT_PERIODS = new Set(REPORT_PERIOD_OPTIONS.map((o) => o.value));

function parseReportPeriod(searchParams: URLSearchParams): ReportPeriodPreset {
  const value = searchParams.get("reportPeriod");
  return (value && VALID_REPORT_PERIODS.has(value) ? value : REPORT_DEFAULT_PERIOD) as ReportPeriodPreset;
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

function formatAsRange(from: string, to: string): string {
  if (!from && !to) return "All dates";
  if (from && to) {
    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T00:00:00`);
    return `${fromDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}-${toDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    })}`;
  }
  return from || to;
}

function signedImpact(account: Account, posting: LedgerPosting): number {
  if (DEBIT_NORMAL_CATEGORIES.has(account.category)) {
    return posting.entryType === "DEBIT" ? posting.amount : -posting.amount;
  }
  return posting.entryType === "CREDIT" ? posting.amount : -posting.amount;
}

type AccountRow = { name: string; amount: number };

const SECTIONS: { key: string; label: string; categories: Set<Account["category"]> }[] = [
  { key: "income", label: "Income", categories: new Set(["INCOME"]) },
  { key: "otherIncome", label: "Other Income", categories: new Set(["OTHER_INCOME"]) },
  { key: "expenses", label: "Expenses", categories: new Set(["EXPENSE"]) },
  { key: "otherExpenses", label: "Other Expenses", categories: new Set(["OTHER_EXPENSE"]) }
];

export function PLDetailPage() {
  return (
    <Suspense fallback={null}>
      <PLDetailPageInner />
    </Suspense>
  );
}

function PLDetailPageInner() {
  const services = useMemo(() => getServiceContainer(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reportPeriod, setReportPeriod] = useState<ReportPeriodPreset>(() => parseReportPeriod(searchParams));
  const [fromDate, setFromDate] = useState(() =>
    parseReportPeriod(searchParams) === "custom" ? searchParams.get("from") ?? "" : ""
  );
  const [toDate, setToDate] = useState(() =>
    parseReportPeriod(searchParams) === "custom" ? searchParams.get("to") ?? "" : ""
  );
  const [accountFilter, setAccountFilter] = useState(() => searchParams.get("account") ?? "");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postings, setPostings] = useState<LedgerPosting[]>([]);

  useEffect(() => {
    if (reportPeriod === "custom") return;
    const range = dateRangeForPreset(reportPeriod);
    setFromDate(range.from);
    setToDate(range.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
    services.ledgerService.listPostings().then(setPostings).catch(() => setPostings([]));
  }, [services]);

  const reportQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (reportPeriod !== REPORT_DEFAULT_PERIOD) params.set("reportPeriod", reportPeriod);
    if (reportPeriod === "custom") {
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);
    }
    if (accountFilter) params.set("account", accountFilter);
    return params.toString();
  }, [reportPeriod, fromDate, toDate, accountFilter]);

  useEffect(() => {
    const url = reportQueryString ? `/reports/pl-detail?${reportQueryString}` : "/reports/pl-detail";
    router.replace(url, { scroll: false });
  }, [reportQueryString, router]);

  function handlePeriodChange(value: string) {
    const preset = value as ReportPeriodPreset;
    setReportPeriod(preset);
    if (preset === "custom") return;
    const range = dateRangeForPreset(preset);
    setFromDate(range.from);
    setToDate(range.to);
  }

  function handleFromChange(value: string) {
    setReportPeriod("custom");
    setFromDate(value);
  }

  function handleToChange(value: string) {
    setReportPeriod("custom");
    setToDate(value);
  }

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const postingsInRange = useMemo(
    () =>
      postings.filter(
        (p) =>
          p.status === "POSTED" &&
          (!fromDate || p.postingDate >= fromDate) &&
          (!toDate || p.postingDate <= toDate)
      ),
    [postings, fromDate, toDate]
  );

  const filterOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.category === "INCOME" || a.category === "OTHER_INCOME" || a.category === "EXPENSE" || a.category === "OTHER_EXPENSE")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ value: a.name, label: a.name })),
    [accounts]
  );

  const sections = useMemo(() => {
    return SECTIONS.map((section) => {
      const rowMap = new Map<string, number>();
      postingsInRange.forEach((posting) => {
        const account = accountById.get(posting.accountId);
        if (!account || !section.categories.has(account.category)) return;
        if (accountFilter && account.name !== accountFilter && !account.name.startsWith(`${accountFilter}:`)) return;
        rowMap.set(account.name, (rowMap.get(account.name) ?? 0) + signedImpact(account, posting));
      });
      const rows: AccountRow[] = [...rowMap.entries()]
        .map(([name, amount]) => ({ name, amount }))
        .filter((r) => Math.abs(r.amount) > 0.0001)
        .sort((a, b) => a.name.localeCompare(b.name));
      const total = rows.reduce((s, r) => s + r.amount, 0);
      return { ...section, rows, total };
    }).filter((section) => section.rows.length > 0);
  }, [postingsInRange, accountById, accountFilter]);

  const totalIncome = (sections.find((s) => s.key === "income")?.total ?? 0);
  const totalOtherIncome = (sections.find((s) => s.key === "otherIncome")?.total ?? 0);
  const totalExpenses = (sections.find((s) => s.key === "expenses")?.total ?? 0);
  const totalOtherExpenses = (sections.find((s) => s.key === "otherExpenses")?.total ?? 0);
  const netOperatingIncome = totalIncome - totalExpenses;
  const netIncome = netOperatingIncome + totalOtherIncome - totalOtherExpenses;

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
              const isActive = item.type === "pl_detail";
              return (
                <Link
                  key={item.type}
                  href={item.href}
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
          <h1 className="page-title">P&amp;L Detail</h1>
        </div>
        <div className="header-filters">
          <div>
            <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">Report period</p>
            <SelectField
              value={reportPeriod}
              onChange={handlePeriodChange}
              options={REPORT_PERIOD_OPTIONS}
              placeholder="Select"
              allowCustomValue={false}
              optionSize="sm"
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">From</p>
            <InputField type="date" value={fromDate} onChange={(e) => handleFromChange(e.target.value)} />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">To</p>
            <InputField type="date" value={toDate} onChange={(e) => handleToChange(e.target.value)} />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">Account</p>
            <SelectField
              value={accountFilter}
              onChange={setAccountFilter}
              options={[{ value: "", label: "All accounts" }, ...filterOptions]}
              placeholder="All accounts"
              allowCustomValue={false}
              optionSize="sm"
            />
          </div>
        </div>
      </header>

      <section className="page-content">
        <section className="report-print-card mx-auto mt-8 w-full max-w-[840px] rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5 shadow-sm">
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={() => window.print()}
              className="no-print rounded border border-[var(--color-divider-tertiary)] px-2 py-1 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-container-background-accent)]"
            >
              Print
            </button>
          </div>
          <div className="mb-4 text-center">
            <h2 className="text-[28px] font-medium text-[var(--color-text-global)] mb-2">{REPORT_USER_NAME}</h2>
            <p className="text-[16px] text-[var(--color-text-primary)] mb-2">
              P&amp;L Detail{accountFilter ? ` — ${accountFilter}` : ""}
            </p>
            <p className="text-xs text-[var(--color-icon-secondary)]">{formatAsRange(fromDate, toDate)}</p>
          </div>

          {sections.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-disabled)]">
              No income or expense activity in this period.
            </p>
          ) : (
            <>
              {sections.map((section) => (
                <div key={section.key} className="mb-7">
                  <p className="mb-2 border-b-2 border-[var(--color-divider-tertiary)] pb-1 text-sm font-semibold text-[var(--color-text-primary)]">
                    {section.label}
                  </p>
                  {section.rows.map((row) => {
                    const txns = getTransactionsForAccount(row.name, postings, accounts, fromDate, toDate);
                    return (
                      <div key={row.name} className="mb-5">
                        <div className="mb-1 flex items-baseline justify-between border-b border-[var(--color-container-background-secondary)] pb-1">
                          <span className="font-medium text-[var(--color-text-primary)]">
                            {row.name.replace(/:/g, " › ")}
                          </span>
                          <span className="font-medium text-[var(--color-text-primary)]">{formatMoney(row.amount)}</span>
                        </div>
                        {txns.length === 0 ? (
                          <p className="py-1 text-xs text-[var(--color-text-disabled)]">No transactions in this period.</p>
                        ) : (
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
                                <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Date</th>
                                <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Description</th>
                                <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Ref #</th>
                                <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {txns.map((txn) => (
                                <tr key={txn.transactionId} className="border-b border-[var(--color-container-background-secondary)]">
                                  <td className="px-3 py-1 text-[var(--color-text-primary)]">{formatDate(txn.date)}</td>
                                  <td className="px-3 py-1 text-[var(--color-text-primary)]">{txn.memo || "—"}</td>
                                  <td className="px-3 py-1 text-[var(--color-text-disabled)]">{txn.referenceNumber || "—"}</td>
                                  <td className="px-3 py-1 text-right text-[var(--color-text-primary)]">
                                    {formatMoney(Math.abs(txn.amount))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-baseline justify-between border-t border-[var(--color-divider-tertiary)] pt-1">
                    <span className="font-semibold text-[var(--color-text-primary)]">Total for {section.label}</span>
                    <span className="font-semibold text-[var(--color-text-primary)]">{formatMoney(section.total)}</span>
                  </div>
                </div>
              ))}

              {!accountFilter ? (
                <div className="border-t-2 border-[var(--color-divider-tertiary)] pt-2">
                  <div className="flex items-baseline justify-between bg-[var(--color-report-row-alt)] px-3 py-1.5">
                    <span className="font-bold text-[var(--color-text-primary)]">Net Operating Income</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{formatMoney(netOperatingIncome)}</span>
                  </div>
                  <div className="flex items-baseline justify-between bg-[var(--color-report-row-alt)] px-3 py-1.5">
                    <span className="font-bold text-[var(--color-text-primary)]">Net Income</span>
                    <span className="font-bold text-[var(--color-text-primary)]">{formatMoney(netIncome)}</span>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
