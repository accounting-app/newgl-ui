"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InputField } from "@/components/ui/input-field";
import { SelectField } from "@/components/bank-register/select-field";
import {
  REPORT_COMPARE_TO_OPTIONS,
  REPORT_DEFAULT_COMPARE_TO,
  REPORT_DEFAULT_DISPLAY_COLUMNS_BY,
  REPORT_DEFAULT_PERIOD,
  REPORT_DISPLAY_COLUMNS_OPTIONS,
  REPORT_PERIOD_OPTIONS,
  REPORT_USER_NAME
} from "@/constants/ui";
import { REPORT_NAV_ITEMS } from "@/constants/reports";
import type { ReportType } from "@/constants/reports";
import { buildHierarchyRows } from "@/lib/accounting/account-hierarchy";
import { ReportSection } from "@/components/reports/report-section";
import { ReportAccountRows } from "@/components/reports/report-account-rows";
import { getTransactionsForAccount } from "@/lib/accounting/drill-down";
import type { DrillTransaction } from "@/lib/accounting/drill-down";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, LedgerPosting } from "@/modules/accounting/domain/models";

type ReportsPageProps = {
  reportType: ReportType;
};
type AccountingMethod = "cash" | "accrual";
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

type DrillSection = {
  label: string;
  reportLabel: string;
  rows: Array<{ name: string; amount: number }>;
  total: number;
};

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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
const VALID_DISPLAY_COLUMNS = new Set(REPORT_DISPLAY_COLUMNS_OPTIONS.map((o) => o.value));
const VALID_COMPARE_TO = new Set(REPORT_COMPARE_TO_OPTIONS.map((o) => o.value));

type ReportUrlFilters = {
  reportPeriod: ReportPeriodPreset;
  fromDate: string;
  toDate: string;
  accountingMethod: AccountingMethod;
  displayColumnsBy: string;
  compareTo: string;
};

function parseReportPeriod(searchParams: URLSearchParams): ReportPeriodPreset {
  const value = searchParams.get("reportPeriod");
  return (value && VALID_REPORT_PERIODS.has(value) ? value : REPORT_DEFAULT_PERIOD) as ReportPeriodPreset;
}

function parseAccountingMethod(searchParams: URLSearchParams): AccountingMethod {
  const value = searchParams.get("accountingMethod");
  return value === "cash" || value === "accrual" ? value : "cash";
}

function parseDisplayColumnsBy(searchParams: URLSearchParams): string {
  const value = searchParams.get("displayColumnsBy");
  return value && VALID_DISPLAY_COLUMNS.has(value) ? value : REPORT_DEFAULT_DISPLAY_COLUMNS_BY;
}

function parseCompareTo(searchParams: URLSearchParams): string {
  const value = searchParams.get("compareTo");
  return value && VALID_COMPARE_TO.has(value) ? value : REPORT_DEFAULT_COMPARE_TO;
}

function buildReportQueryString(filters: ReportUrlFilters): string {
  const params = new URLSearchParams();
  if (filters.reportPeriod !== REPORT_DEFAULT_PERIOD) params.set("reportPeriod", filters.reportPeriod);
  if (filters.reportPeriod === "custom") {
    if (filters.fromDate) params.set("from", filters.fromDate);
    if (filters.toDate) params.set("to", filters.toDate);
  }
  if (filters.accountingMethod !== "cash") params.set("accountingMethod", filters.accountingMethod);
  if (filters.displayColumnsBy !== REPORT_DEFAULT_DISPLAY_COLUMNS_BY)
    params.set("displayColumnsBy", filters.displayColumnsBy);
  if (filters.compareTo !== REPORT_DEFAULT_COMPARE_TO) params.set("compareTo", filters.compareTo);
  return params.toString();
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

function filterByDate(postings: LedgerPosting[], from: string, to: string): LedgerPosting[] {
  return postings.filter((posting) => {
    if (posting.status !== "POSTED") return false;
    if (from && posting.postingDate < from) return false;
    if (to && posting.postingDate > to) return false;
    return true;
  });
}

function signedImpact(account: Account, posting: LedgerPosting): number {
  if (DEBIT_NORMAL_CATEGORIES.has(account.category)) {
    return posting.entryType === "DEBIT" ? posting.amount : -posting.amount;
  }
  return posting.entryType === "CREDIT" ? posting.amount : -posting.amount;
}

export function ReportsPage({ reportType }: ReportsPageProps) {
  return (
    <Suspense fallback={null}>
      <ReportsPageInner reportType={reportType} />
    </Suspense>
  );
}

function ReportsPageInner({ reportType }: ReportsPageProps) {
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
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>(() =>
    parseAccountingMethod(searchParams)
  );
  const [displayColumnsBy, setDisplayColumnsBy] = useState<string>(() => parseDisplayColumnsBy(searchParams));
  const [compareTo, setCompareTo] = useState<string>(() => parseCompareTo(searchParams));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postings, setPostings] = useState<LedgerPosting[]>([]);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    income: true,
    expenses: true,
    bs_assets: true,
    bs_liabilities_equity: true,
    bs_liabilities: true,
    bs_equity: true,
  });
  const [collapsedAccounts, setCollapsedAccounts] = useState<Set<string>>(new Set());
  const [drillSection, setDrillSection] = useState<DrillSection | null>(null);

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

  const reportQueryString = useMemo(
    () =>
      buildReportQueryString({ reportPeriod, fromDate, toDate, accountingMethod, displayColumnsBy, compareTo }),
    [reportPeriod, fromDate, toDate, accountingMethod, displayColumnsBy, compareTo]
  );

  useEffect(() => {
    const basePath = reportType === "profit_loss" ? "/reports/profit-loss" : "/reports/balance-sheet";
    const url = reportQueryString ? `${basePath}?${reportQueryString}` : basePath;
    router.replace(url, { scroll: false });
  }, [reportQueryString, reportType, router]);

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

  const postingsInRange = useMemo(() => filterByDate(postings, fromDate, toDate), [postings, fromDate, toDate]);

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const netIncome = useMemo(() => {
    const incomeCategories = new Set(["INCOME", "OTHER_INCOME"]);
    const expenseCategories = new Set(["EXPENSE", "OTHER_EXPENSE"]);
    let incomeTotal = 0;
    let expenseTotal = 0;
    postingsInRange.forEach((posting) => {
      const account = accountById.get(posting.accountId);
      if (!account) return;
      const impact = signedImpact(account, posting);
      if (incomeCategories.has(account.category)) incomeTotal += impact;
      if (expenseCategories.has(account.category)) expenseTotal += impact;
    });
    return incomeTotal - expenseTotal;
  }, [accountById, postingsInRange]);

  const profitAndLossData = useMemo(() => {
    const incomeCategories = new Set(["INCOME", "OTHER_INCOME"]);
    const expenseCategories = new Set(["EXPENSE", "OTHER_EXPENSE"]);
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    postingsInRange.forEach((posting) => {
      const account = accountById.get(posting.accountId);
      if (!account) return;
      const impact = signedImpact(account, posting);
      if (incomeCategories.has(account.category))
        incomeMap.set(account.name, (incomeMap.get(account.name) ?? 0) + impact);
      if (expenseCategories.has(account.category))
        expenseMap.set(account.name, (expenseMap.get(account.name) ?? 0) + impact);
    });

    const incomeRows = [...incomeMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .filter((r) => Math.abs(r.amount) > 0.0001)
      .sort((a, b) => a.name.localeCompare(b.name));

    const expenseRows = [...expenseMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .filter((r) => Math.abs(r.amount) > 0.0001)
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalIncome = incomeRows.reduce((s, r) => s + r.amount, 0);
    const totalExpense = expenseRows.reduce((s, r) => s + r.amount, 0);
    const operatingIncome = totalIncome - totalExpense;

    return { incomeRows, expenseRows, totalIncome, totalExpense, operatingIncome, netIncome: operatingIncome };
  }, [accountById, postingsInRange]);

  const balanceSheetData = useMemo(() => {
    const asOfDate = toDate || isoDate(new Date());
    const asOfPostings = postings.filter(
      (p) => p.status === "POSTED" && p.postingDate <= asOfDate
    );

    const balances = new Map<string, number>();
    accounts.forEach((a) => balances.set(a.id, a.openingBalance ?? 0));
    asOfPostings.forEach((posting) => {
      const account = accountById.get(posting.accountId);
      if (!account) return;
      balances.set(posting.accountId, (balances.get(posting.accountId) ?? 0) + signedImpact(account, posting));
    });

    const byCategory = (categories: Set<Account["category"]>) =>
      accounts
        .filter((a) => categories.has(a.category))
        .map((a) => ({ name: a.name, amount: balances.get(a.id) ?? 0 }))
        .filter((r) => Math.abs(r.amount) > 0.0001)
        .sort((a, b) => a.name.localeCompare(b.name));

    const bankAccounts = byCategory(new Set(["BANK"]));
    const currentAssets = byCategory(new Set(["BANK", "ACCOUNTS_RECEIVABLE", "OTHER_CURRENT_ASSET"]));
    const liabilities = byCategory(new Set(["CREDIT_CARD", "LONG_TERM_LIABILITY", "OTHER_CURRENT_LIABILITY"]));
    const equityRows = byCategory(new Set(["EQUITY"]));

    const totalBankAccounts = bankAccounts.reduce((s, r) => s + r.amount, 0);
    const totalCurrentAssets = currentAssets.reduce((s, r) => s + r.amount, 0);
    const totalAssets = totalCurrentAssets;
    const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
    const totalEquityWithoutNetIncome = equityRows.reduce((s, r) => s + r.amount, 0);
    const totalEquity = totalEquityWithoutNetIncome + netIncome;
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      bankAccounts,
      totalBankAccounts,
      totalCurrentAssets,
      totalAssets,
      liabilities,
      totalLiabilities,
      equityRows,
      totalEquity,
      totalLiabilitiesAndEquity,
      netIncome,
    };
  }, [accounts, accountById, postings, toDate, netIncome]);

  const reportLabel = reportType === "profit_loss" ? "Profit and Loss" : "Balance Sheet";

  // Pre-compute transactions for every account in the drill section (no extra API calls)
  const drillSectionTransactions = useMemo<Map<string, DrillTransaction[]>>(() => {
    if (!drillSection) return new Map();
    const map = new Map<string, DrillTransaction[]>();
    for (const row of drillSection.rows) {
      map.set(row.name, getTransactionsForAccount(row.name, postings, accounts, fromDate, toDate));
    }
    return map;
  }, [drillSection, postings, accounts, fromDate, toDate]);

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
              const isActive = item.type === reportType;
              const href = reportQueryString ? `${item.href}?${reportQueryString}` : item.href;
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
          <h1 className="page-title">{reportLabel}</h1>
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
            <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">Accounting method</p>
            <div className="inline-flex h-9 w-full rounded border border-[var(--color-input-border-primary)] bg-[var(--color-container-background-primary)] p-0.5">
              <button
                className={`flex-1 rounded text-xs ${accountingMethod === "cash" ? "bg-[var(--color-report-toggle-active)] text-white" : "text-[var(--color-text-primary)]"}`}
                onClick={() => setAccountingMethod("cash")}
                type="button"
              >
                Cash
              </button>
              <button
                className={`flex-1 rounded text-xs ${accountingMethod === "accrual" ? "bg-[var(--color-report-toggle-active)] text-white" : "text-[var(--color-text-primary)]"}`}
                onClick={() => setAccountingMethod("accrual")}
                type="button"
              >
                Accrual
              </button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">Display columns by</p>
            <SelectField
              value={displayColumnsBy}
              onChange={setDisplayColumnsBy}
              options={REPORT_DISPLAY_COLUMNS_OPTIONS}
              placeholder="Select"
              allowCustomValue={false}
              optionSize="sm"
            />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">Compare to</p>
            <SelectField
              value={compareTo}
              onChange={setCompareTo}
              options={REPORT_COMPARE_TO_OPTIONS}
              placeholder="Select Period"
              allowCustomValue={false}
              optionSize="sm"
            />
          </div>
        </div>
      </header>

      <section className="page-content">
      <section className="mx-auto mt-8 w-full max-w-[840px] rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5 shadow-sm">

        {/* ── Report toolbar ── */}
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2 border-b border-[var(--color-divider-tertiary)] pb-3">
          <span className="text-xs text-[var(--color-icon-secondary)]">
            {accountingMethod === "cash" ? "Cash basis" : "Accrual basis"}
          </span>
        </div>

        {/* ── Report title block ── */}
        <div className="mb-4 text-center">
          <h2 className="text-[28px] font-medium text-[var(--color-text-global)] mb-2">{REPORT_USER_NAME}</h2>
          <p className="text-[16px] text-[var(--color-text-primary)] mb-2">{reportLabel}</p>
          <p className="text-xs text-[var(--color-icon-secondary)]">
            {reportType === "profit_loss"
              ? formatAsRange(fromDate, toDate)
              : `As of ${formatAsRange("", toDate)}`}
          </p>
        </div>

        {/* ── Detail view (replaces the summary table when a section is drilled into) ── */}
        {drillSection !== null ? (
          <>
            {/* Back navigation */}
            <div className="mb-5 flex items-center gap-2 border-b border-[var(--color-divider-tertiary)] pb-3">
              <button
                type="button"
                onClick={() => setDrillSection(null)}
                className="flex items-center gap-1.5 text-sm text-[var(--color-link-text)] hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Summary
              </button>
              <span className="text-[var(--color-icon-secondary)]">›</span>
              <span className="text-sm text-[var(--color-icon-secondary)]">{drillSection.reportLabel}</span>
              <span className="text-[var(--color-icon-secondary)]">›</span>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{drillSection.label}</span>
            </div>

            {/* One block per account in the section */}
            {drillSection.rows.map((row) => {
              const txns = drillSectionTransactions.get(row.name) ?? [];
              const displayName = row.name.replace(/:/g, " › ");
              return (
                <div key={row.name} className="mb-7">
                  {/* Account header */}
                  <div className="flex items-baseline justify-between border-b-2 border-[var(--color-divider-tertiary)] pb-1 mb-1">
                    <span className="font-semibold text-[var(--color-text-primary)]">{displayName}</span>
                    <span className="font-semibold text-[var(--color-text-primary)]">{formatMoney(Math.abs(row.amount))}</span>
                  </div>

                  {txns.length === 0 ? (
                    <p className="py-2 text-xs text-[var(--color-text-disabled)]">No transactions in this period.</p>
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
                            <td className="px-3 py-1 text-right text-[var(--color-text-primary)]">{formatMoney(Math.abs(txn.amount))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[var(--color-divider-tertiary)]">
                          <td colSpan={3} className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">
                            Total
                          </td>
                          <td className="px-3 py-1 text-right font-semibold text-[var(--color-text-primary)]">
                            {formatMoney(Math.abs(row.amount))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              );
            })}

            {/* Section grand total */}
            <div className="mt-2 flex items-baseline justify-between border-t-2 border-[var(--color-divider-tertiary)] pt-2">
              <span className="font-bold text-[var(--color-text-primary)]">Total {drillSection.label}</span>
              <span className="font-bold text-[var(--color-text-primary)]">{formatMoney(Math.abs(drillSection.total))}</span>
            </div>
          </>

        ) : reportType === "profit_loss" ? (
          /* ── Profit & Loss summary table ── */
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
                <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]"> </th>
                <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Total</th>
              </tr>
            </thead>
            <tbody>
              <ReportSection
                label="Income"
                isOpen={openSections.income ?? true}
                onToggle={() => toggleSection("income")}
              >
                <ReportAccountRows
                  rows={buildHierarchyRows(profitAndLossData.incomeRows)}
                  collapsedNames={collapsedAccounts}
                  rowKeyPrefix="income"
                  onToggleCollapse={toggleAccountCollapse}
                  onDrillAmount={() => setDrillSection({
                    label: "Income",
                    reportLabel,
                    rows: profitAndLossData.incomeRows,
                    total: profitAndLossData.totalIncome,
                  })}
                />
                <tr className="border-b border-[var(--color-divider-tertiary)]">
                  <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Total for Income</td>
                  <td className="px-3 py-1 text-right font-semibold">{formatMoney(profitAndLossData.totalIncome)}</td>
                </tr>
              </ReportSection>

              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Gross Profit</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(profitAndLossData.totalIncome)}</td>
              </tr>

              <ReportSection
                label="Expenses"
                isOpen={openSections.expenses ?? true}
                onToggle={() => toggleSection("expenses")}
              >
                <ReportAccountRows
                  rows={buildHierarchyRows(profitAndLossData.expenseRows)}
                  collapsedNames={collapsedAccounts}
                  rowKeyPrefix="expense"
                  onToggleCollapse={toggleAccountCollapse}
                  onDrillAmount={() => setDrillSection({
                    label: "Expenses",
                    reportLabel,
                    rows: profitAndLossData.expenseRows,
                    total: profitAndLossData.totalExpense,
                  })}
                />
                <tr className="border-b border-[var(--color-divider-tertiary)]">
                  <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Total for Expenses</td>
                  <td className="px-3 py-1 text-right font-semibold">{formatMoney(profitAndLossData.totalExpense)}</td>
                </tr>
              </ReportSection>

              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Net Operating Income</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(profitAndLossData.operatingIncome)}</td>
              </tr>
              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Net Income</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(profitAndLossData.netIncome)}</td>
              </tr>
            </tbody>
          </table>

        ) : (
          /* ── Balance Sheet summary table ── */
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
                <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]"> </th>
                <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Assets — collapsible */}
              <ReportSection
                label="Assets"
                isOpen={openSections.bs_assets ?? true}
                onToggle={() => toggleSection("bs_assets")}
              >
                <tr className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-4 py-1 font-medium text-[var(--color-text-primary)]">Current Assets</td>
                  <td />
                </tr>
                <tr className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-6 py-1 font-medium text-[var(--color-text-primary)]">Bank Accounts</td>
                  <td />
                </tr>
                <ReportAccountRows
                  rows={buildHierarchyRows(balanceSheetData.bankAccounts)}
                  collapsedNames={collapsedAccounts}
                  rowKeyPrefix="bank"
                  baseIndentRem={2}
                  onToggleCollapse={toggleAccountCollapse}
                  onDrillAmount={() => setDrillSection({
                    label: "Bank Accounts",
                    reportLabel,
                    rows: balanceSheetData.bankAccounts,
                    total: balanceSheetData.totalBankAccounts,
                  })}
                />
                <tr className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-6 py-1 font-semibold text-[var(--color-text-primary)]">Total for Bank Accounts</td>
                  <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalBankAccounts)}</td>
                </tr>
                <tr className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-4 py-1 font-semibold text-[var(--color-text-primary)]">Total for Current Assets</td>
                  <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalCurrentAssets)}</td>
                </tr>
                <tr className="border-b border-[var(--color-divider-tertiary)]">
                  <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Total for Assets</td>
                  <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalAssets)}</td>
                </tr>
              </ReportSection>

              {/* Liabilities and Equity — collapsible, with two nested collapsible sub-sections */}
              <ReportSection
                label="Liabilities and Equity"
                isOpen={openSections.bs_liabilities_equity ?? true}
                onToggle={() => toggleSection("bs_liabilities_equity")}
              >
                <ReportSection
                  label="Liabilities"
                  isOpen={openSections.bs_liabilities ?? true}
                  onToggle={() => toggleSection("bs_liabilities")}
                  headerClassName="bg-[var(--color-container-background-secondary)]"
                >
                  <ReportAccountRows
                    rows={buildHierarchyRows(balanceSheetData.liabilities)}
                    collapsedNames={collapsedAccounts}
                    rowKeyPrefix="liability"
                    onToggleCollapse={toggleAccountCollapse}
                    onDrillAmount={() => setDrillSection({
                      label: "Liabilities",
                      reportLabel,
                      rows: balanceSheetData.liabilities,
                      total: balanceSheetData.totalLiabilities,
                    })}
                  />
                  <tr className="border-b border-[var(--color-container-background-secondary)]">
                    <td className="px-4 py-1 font-semibold text-[var(--color-text-primary)]">Total for Liabilities</td>
                    <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalLiabilities)}</td>
                  </tr>
                </ReportSection>

                <ReportSection
                  label="Equity"
                  isOpen={openSections.bs_equity ?? true}
                  onToggle={() => toggleSection("bs_equity")}
                  headerClassName="bg-[var(--color-container-background-secondary)]"
                >
                  <ReportAccountRows
                    rows={buildHierarchyRows(balanceSheetData.equityRows)}
                    collapsedNames={collapsedAccounts}
                    rowKeyPrefix="equity"
                    onToggleCollapse={toggleAccountCollapse}
                    onDrillAmount={() => setDrillSection({
                      label: "Equity",
                      reportLabel,
                      rows: balanceSheetData.equityRows,
                      total: balanceSheetData.totalEquity,
                    })}
                  />
                  <tr className="border-b border-[var(--color-container-background-secondary)]">
                    <td className="px-6 py-1 text-[var(--color-text-primary)]">Net Income</td>
                    <td className="px-3 py-1 text-right">{formatMoney(balanceSheetData.netIncome)}</td>
                  </tr>
                  <tr className="border-b border-[var(--color-container-background-secondary)]">
                    <td className="px-4 py-1 font-semibold text-[var(--color-text-primary)]">Total for Equity</td>
                    <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalEquity)}</td>
                  </tr>
                </ReportSection>

                <tr className="border-b border-[var(--color-divider-tertiary)]">
                  <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Total for Liabilities and Equity</td>
                  <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalLiabilitiesAndEquity)}</td>
                </tr>
              </ReportSection>
            </tbody>
          </table>
        )}

      </section>
      </section>
    </main>
  );
}
