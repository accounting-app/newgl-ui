"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { buildHierarchyRowsMulti } from "@/lib/accounting/account-hierarchy";
import type { ReportValueColumn } from "@/components/reports/report-account-rows";
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

function formatPercent(value: number): string {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatReportCell(value: number, format: "money" | "percent"): string {
  return format === "percent" ? formatPercent(value) : formatMoney(value);
}

/** Renders one <td> per column for a totals/summary row (both single- and multi-column reports use this). */
function ReportValueCells({ values, columns }: { values: number[]; columns: ReportValueColumn[] }) {
  return (
    <>
      {columns.map((column, index) => (
        <td key={column.key} className="px-3 py-1 text-right font-semibold text-[var(--color-text-primary)]">
          {formatReportCell(values[index] ?? 0, column.format)}
        </td>
      ))}
    </>
  );
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

// ── Report compare + columnar statements (PLAINGL_FEATURES_TO_IMPLEMENT.md #3) ──
// Both modes reuse the same single-period computation, just fed a different
// date range: "compare" runs it once more against a shifted range, "columnar"
// runs it once per sub-period. Mirrors PlainGL's balances()-as-shared-primitive
// approach (plaingl/lib/beancount/report.ts).

type PLTotals = {
  incomeRows: { name: string; amount: number }[];
  expenseRows: { name: string; amount: number }[];
  totalIncome: number;
  totalExpense: number;
  operatingIncome: number;
  netIncome: number;
};

function computeNetIncome(
  postings: LedgerPosting[],
  accountById: Map<string, Account>,
  from: string,
  to: string
): number {
  const incomeCategories = new Set(["INCOME", "OTHER_INCOME"]);
  const expenseCategories = new Set(["EXPENSE", "OTHER_EXPENSE"]);
  let incomeTotal = 0;
  let expenseTotal = 0;
  filterByDate(postings, from, to).forEach((posting) => {
    const account = accountById.get(posting.accountId);
    if (!account) return;
    const impact = signedImpact(account, posting);
    if (incomeCategories.has(account.category)) incomeTotal += impact;
    if (expenseCategories.has(account.category)) expenseTotal += impact;
  });
  return incomeTotal - expenseTotal;
}

function computeProfitAndLoss(
  postings: LedgerPosting[],
  accountById: Map<string, Account>,
  from: string,
  to: string
): PLTotals {
  const incomeCategories = new Set(["INCOME", "OTHER_INCOME"]);
  const expenseCategories = new Set(["EXPENSE", "OTHER_EXPENSE"]);
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, number>();

  filterByDate(postings, from, to).forEach((posting) => {
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
}

type BSTotals = {
  bankAccounts: { name: string; amount: number }[];
  totalBankAccounts: number;
  otherCurrentAssets: { name: string; amount: number }[];
  totalOtherCurrentAssets: number;
  totalCurrentAssets: number;
  fixedAssets: { name: string; amount: number }[];
  totalFixedAssets: number;
  totalAssets: number;
  liabilities: { name: string; amount: number }[];
  totalLiabilities: number;
  equityRows: { name: string; amount: number }[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  netIncome: number;
};

function computeBalanceSheet(
  accounts: Account[],
  accountById: Map<string, Account>,
  postings: LedgerPosting[],
  netIncomeFrom: string,
  asOfDate: string
): BSTotals {
  const resolvedAsOf = asOfDate || isoDate(new Date());
  const asOfPostings = postings.filter((p) => p.status === "POSTED" && p.postingDate <= resolvedAsOf);

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
  // Accounts Receivable and Other Current Assets shown as their own rows --
  // otherwise their balance is silently folded into "Total for Current
  // Assets" with no line item to explain it (e.g. once Invoices/Bills post
  // real AR/AP, as of Phase 1.5 Steps 3 & 7).
  const otherCurrentAssets = byCategory(new Set(["ACCOUNTS_RECEIVABLE", "OTHER_CURRENT_ASSET"]));
  const currentAssets = byCategory(new Set(["BANK", "ACCOUNTS_RECEIVABLE", "OTHER_CURRENT_ASSET"]));
  // FIXED_ASSET is a distinct top-level section (Equipment, Vehicles, ...),
  // not part of Current Assets -- also previously missing entirely, same
  // "silently drop a whole category" bug as Accounts Payable below.
  const fixedAssets = byCategory(new Set(["FIXED_ASSET"]));
  // ACCOUNTS_PAYABLE must be included here -- without it, a company with any
  // unpaid bill has a Balance Sheet where Assets != Liabilities + Equity,
  // which should never happen in double-entry accounting.
  const liabilities = byCategory(new Set(["ACCOUNTS_PAYABLE", "CREDIT_CARD", "LONG_TERM_LIABILITY", "OTHER_CURRENT_LIABILITY"]));
  const equityRows = byCategory(new Set(["EQUITY"]));

  const totalBankAccounts = bankAccounts.reduce((s, r) => s + r.amount, 0);
  const totalOtherCurrentAssets = otherCurrentAssets.reduce((s, r) => s + r.amount, 0);
  const totalCurrentAssets = currentAssets.reduce((s, r) => s + r.amount, 0);
  const totalFixedAssets = fixedAssets.reduce((s, r) => s + r.amount, 0);
  const totalAssets = totalCurrentAssets + totalFixedAssets;
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const totalEquityWithoutNetIncome = equityRows.reduce((s, r) => s + r.amount, 0);
  const netIncome = computeNetIncome(postings, accountById, netIncomeFrom, resolvedAsOf);
  const totalEquity = totalEquityWithoutNetIncome + netIncome;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    bankAccounts,
    totalBankAccounts,
    otherCurrentAssets,
    totalOtherCurrentAssets,
    totalCurrentAssets,
    fixedAssets,
    totalFixedAssets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equityRows,
    totalEquity,
    totalLiabilitiesAndEquity,
    netIncome
  };
}

// Only the true period granularities support columnar mode — the rest of
// REPORT_DISPLAY_COLUMNS_OPTIONS (customer/employee/product_service/vendor)
// is a different, not-yet-built feature (columnar-by-dimension); selecting
// one of those falls back to the normal single-column view, same as "none".
type Granularity = "weeks" | "months" | "quarter" | "years";
const COLUMNAR_GRANULARITIES = new Set<string>(["weeks", "months", "quarter", "years"]);

// Same reasoning for compareTo: only the prior-period-style options describe
// the "$ and % change vs. another period" feature from the spec. The
// percent_row/percent_column/percent_expense/percent_income options are a
// different QBO feature (% of a total elsewhere in the same statement) and
// are left inert, same as "none".
const COMPARE_PERIOD_MODES = new Set<string>([
  "previous_year",
  "previous_period",
  "year_to_date",
  "previous_year_to_date"
]);

function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

function shiftYears(iso: string, years: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setFullYear(date.getFullYear() + years);
  return isoDate(date);
}

function periodLengthDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function compareRangeFor(
  compareTo: string,
  from: string,
  to: string
): { from: string; to: string; label: string } | null {
  if (!from || !to || !COMPARE_PERIOD_MODES.has(compareTo)) return null;

  switch (compareTo) {
    case "previous_year":
      return { from: shiftYears(from, -1), to: shiftYears(to, -1), label: "Previous Year" };
    case "previous_period": {
      const length = periodLengthDays(from, to);
      return { from: shiftDate(from, -length), to: shiftDate(to, -length), label: "Previous Period" };
    }
    case "year_to_date": {
      const year = to.slice(0, 4);
      return { from: `${year}-01-01`, to, label: "Year-to-Date" };
    }
    case "previous_year_to_date": {
      const priorTo = shiftYears(to, -1);
      const year = priorTo.slice(0, 4);
      return { from: `${year}-01-01`, to: priorTo, label: "Prior Year-to-Date" };
    }
    default:
      return null;
  }
}

// Calendar-aligned sub-periods across [from, to], clipped to the requested
// range at the edges (e.g. "months" from Jan 15 starts its first column at
// Jan 15, not Jan 1). Capped so a huge date range can't blow up the table.
const MAX_COLUMNAR_PERIODS = 60;

function buildPeriods(from: string, to: string, granularity: Granularity): { from: string; to: string; label: string }[] {
  if (!from || !to) return [];
  const rangeStart = new Date(`${from}T00:00:00`);
  const rangeEnd = new Date(`${to}T00:00:00`);
  if (rangeStart > rangeEnd) return [];

  let unitStart: Date =
    granularity === "weeks"
      ? new Date(rangeStart)
      : granularity === "months"
        ? new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
        : granularity === "quarter"
          ? new Date(rangeStart.getFullYear(), Math.floor(rangeStart.getMonth() / 3) * 3, 1)
          : new Date(rangeStart.getFullYear(), 0, 1);

  const periods: { from: string; to: string; label: string }[] = [];

  while (unitStart <= rangeEnd && periods.length < MAX_COLUMNAR_PERIODS) {
    let unitEnd: Date;
    let label: string;

    if (granularity === "weeks") {
      unitEnd = new Date(unitStart);
      unitEnd.setDate(unitEnd.getDate() + 6);
      label = unitStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (granularity === "months") {
      unitEnd = new Date(unitStart.getFullYear(), unitStart.getMonth() + 1, 0);
      label = unitStart.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } else if (granularity === "quarter") {
      unitEnd = new Date(unitStart.getFullYear(), unitStart.getMonth() + 3, 0);
      label = `Q${Math.floor(unitStart.getMonth() / 3) + 1} ${unitStart.getFullYear()}`;
    } else {
      unitEnd = new Date(unitStart.getFullYear(), 11, 31);
      label = `${unitStart.getFullYear()}`;
    }

    const clippedFrom = unitStart < rangeStart ? rangeStart : unitStart;
    const clippedTo = unitEnd > rangeEnd ? rangeEnd : unitEnd;
    periods.push({ from: isoDate(clippedFrom), to: isoDate(clippedTo), label });

    unitStart = new Date(unitEnd);
    unitStart.setDate(unitStart.getDate() + 1);
  }

  return periods;
}

function percentChange(current: number, compare: number): number {
  if (compare === 0) return current === 0 ? 0 : 100;
  return ((current - compare) / Math.abs(compare)) * 100;
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

  const accountById = useMemo(() => {
    const map = new Map<string, Account>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const netIncome = useMemo(
    () => computeNetIncome(postings, accountById, fromDate, toDate),
    [postings, accountById, fromDate, toDate]
  );

  const profitAndLossData = useMemo(
    () => computeProfitAndLoss(postings, accountById, fromDate, toDate),
    [postings, accountById, fromDate, toDate]
  );

  const balanceSheetData = useMemo(
    () => computeBalanceSheet(accounts, accountById, postings, fromDate, toDate),
    [accounts, accountById, postings, fromDate, toDate]
  );

  // Columnar mode wins over compare mode when both are selected, matching
  // PlainGL's StatementView (they're alternate views, not composable there).
  const isColumnar = COLUMNAR_GRANULARITIES.has(displayColumnsBy);
  const compareRange = isColumnar ? null : compareRangeFor(compareTo, fromDate, toDate);
  const isComparing = compareRange !== null;

  const columnarPeriods = useMemo(
    () => (isColumnar ? buildPeriods(fromDate, toDate, displayColumnsBy as Granularity) : []),
    [isColumnar, displayColumnsBy, fromDate, toDate]
  );

  const plColumnarPeriods = useMemo(
    () =>
      columnarPeriods.map((period) => ({
        ...period,
        data: computeProfitAndLoss(postings, accountById, period.from, period.to)
      })),
    [columnarPeriods, postings, accountById]
  );

  const bsColumnarPeriods = useMemo(
    () =>
      columnarPeriods.map((period) => ({
        ...period,
        data: computeBalanceSheet(accounts, accountById, postings, fromDate, period.to)
      })),
    [columnarPeriods, accounts, accountById, postings, fromDate]
  );

  const plCompareData = useMemo(
    () => (compareRange ? computeProfitAndLoss(postings, accountById, compareRange.from, compareRange.to) : null),
    [compareRange, postings, accountById]
  );

  const bsCompareData = useMemo(
    () =>
      compareRange
        ? computeBalanceSheet(accounts, accountById, postings, compareRange.from, compareRange.to)
        : null,
    [compareRange, accounts, accountById, postings]
  );

  // Multi-column view models, shared shape for compare and columnar so the
  // JSX below only branches once. Null when the report is single-column.
  const plReport = useMemo(() => {
    if (isColumnar && plColumnarPeriods.length > 0) {
      const columns: ReportValueColumn[] = [
        ...plColumnarPeriods.map((_, i) => ({ key: `period-${i}`, format: "money" as const })),
        { key: "total", format: "money" as const }
      ];
      const columnLabels = [...plColumnarPeriods.map((p) => p.label), "Total"];
      const withTotal = (values: number[]) => [...values, values.reduce((s, v) => s + v, 0)];
      return {
        columns,
        columnLabels,
        incomeRows: buildHierarchyRowsMulti(plColumnarPeriods.map((p) => p.data.incomeRows)).map((r) => ({
          ...r,
          values: withTotal(r.values)
        })),
        expenseRows: buildHierarchyRowsMulti(plColumnarPeriods.map((p) => p.data.expenseRows)).map((r) => ({
          ...r,
          values: withTotal(r.values)
        })),
        totalIncome: withTotal(plColumnarPeriods.map((p) => p.data.totalIncome)),
        totalExpense: withTotal(plColumnarPeriods.map((p) => p.data.totalExpense)),
        operatingIncome: withTotal(plColumnarPeriods.map((p) => p.data.operatingIncome)),
        netIncome: withTotal(plColumnarPeriods.map((p) => p.data.netIncome))
      };
    }
    if (isComparing && plCompareData && compareRange) {
      const columns: ReportValueColumn[] = [
        { key: "current", format: "money" },
        { key: "compare", format: "money" },
        { key: "change-amount", format: "money" },
        { key: "change-percent", format: "percent" }
      ];
      const columnLabels = [formatAsRange(fromDate, toDate), compareRange.label, "Change ($)", "Change (%)"];
      const withChange = (cur: number, cmp: number) => [cur, cmp, cur - cmp, percentChange(cur, cmp)];
      const rowsWithChange = (rows: ReturnType<typeof buildHierarchyRowsMulti>) =>
        rows.map((r) => ({ ...r, values: withChange(r.values[0], r.values[1]) }));
      return {
        columns,
        columnLabels,
        incomeRows: rowsWithChange(buildHierarchyRowsMulti([profitAndLossData.incomeRows, plCompareData.incomeRows])),
        expenseRows: rowsWithChange(
          buildHierarchyRowsMulti([profitAndLossData.expenseRows, plCompareData.expenseRows])
        ),
        totalIncome: withChange(profitAndLossData.totalIncome, plCompareData.totalIncome),
        totalExpense: withChange(profitAndLossData.totalExpense, plCompareData.totalExpense),
        operatingIncome: withChange(profitAndLossData.operatingIncome, plCompareData.operatingIncome),
        netIncome: withChange(profitAndLossData.netIncome, plCompareData.netIncome)
      };
    }
    // Default: single "Total" column, same numbers the original single-column
    // report showed.
    const columns: ReportValueColumn[] = [{ key: "total", format: "money" }];
    return {
      columns,
      columnLabels: ["Total"],
      incomeRows: buildHierarchyRowsMulti([profitAndLossData.incomeRows]),
      expenseRows: buildHierarchyRowsMulti([profitAndLossData.expenseRows]),
      totalIncome: [profitAndLossData.totalIncome],
      totalExpense: [profitAndLossData.totalExpense],
      operatingIncome: [profitAndLossData.operatingIncome],
      netIncome: [profitAndLossData.netIncome]
    };
  }, [isColumnar, plColumnarPeriods, isComparing, plCompareData, compareRange, profitAndLossData, fromDate, toDate]);

  const bsReport = useMemo(() => {
    if (isColumnar && bsColumnarPeriods.length > 0) {
      const columns: ReportValueColumn[] = bsColumnarPeriods.map((_, i) => ({
        key: `period-${i}`,
        format: "money" as const
      }));
      const columnLabels = bsColumnarPeriods.map((p) => p.label);
      return {
        columns,
        columnLabels,
        bankAccounts: buildHierarchyRowsMulti(bsColumnarPeriods.map((p) => p.data.bankAccounts)),
        otherCurrentAssets: buildHierarchyRowsMulti(bsColumnarPeriods.map((p) => p.data.otherCurrentAssets)),
        fixedAssets: buildHierarchyRowsMulti(bsColumnarPeriods.map((p) => p.data.fixedAssets)),
        liabilities: buildHierarchyRowsMulti(bsColumnarPeriods.map((p) => p.data.liabilities)),
        equityRows: buildHierarchyRowsMulti(bsColumnarPeriods.map((p) => p.data.equityRows)),
        totalBankAccounts: bsColumnarPeriods.map((p) => p.data.totalBankAccounts),
        totalOtherCurrentAssets: bsColumnarPeriods.map((p) => p.data.totalOtherCurrentAssets),
        totalCurrentAssets: bsColumnarPeriods.map((p) => p.data.totalCurrentAssets),
        totalFixedAssets: bsColumnarPeriods.map((p) => p.data.totalFixedAssets),
        totalAssets: bsColumnarPeriods.map((p) => p.data.totalAssets),
        totalLiabilities: bsColumnarPeriods.map((p) => p.data.totalLiabilities),
        totalEquity: bsColumnarPeriods.map((p) => p.data.totalEquity),
        totalLiabilitiesAndEquity: bsColumnarPeriods.map((p) => p.data.totalLiabilitiesAndEquity),
        netIncome: bsColumnarPeriods.map((p) => p.data.netIncome)
      };
    }
    if (isComparing && bsCompareData && compareRange) {
      const columns: ReportValueColumn[] = [
        { key: "current", format: "money" },
        { key: "compare", format: "money" },
        { key: "change-amount", format: "money" },
        { key: "change-percent", format: "percent" }
      ];
      const columnLabels = [`As of ${toDate}`, `As of ${compareRange.to}`, "Change ($)", "Change (%)"];
      const withChange = (cur: number, cmp: number) => [cur, cmp, cur - cmp, percentChange(cur, cmp)];
      const rowsWithChange = (rows: ReturnType<typeof buildHierarchyRowsMulti>) =>
        rows.map((r) => ({ ...r, values: withChange(r.values[0], r.values[1]) }));
      return {
        columns,
        columnLabels,
        bankAccounts: rowsWithChange(buildHierarchyRowsMulti([balanceSheetData.bankAccounts, bsCompareData.bankAccounts])),
        otherCurrentAssets: rowsWithChange(
          buildHierarchyRowsMulti([balanceSheetData.otherCurrentAssets, bsCompareData.otherCurrentAssets])
        ),
        fixedAssets: rowsWithChange(buildHierarchyRowsMulti([balanceSheetData.fixedAssets, bsCompareData.fixedAssets])),
        liabilities: rowsWithChange(buildHierarchyRowsMulti([balanceSheetData.liabilities, bsCompareData.liabilities])),
        equityRows: rowsWithChange(buildHierarchyRowsMulti([balanceSheetData.equityRows, bsCompareData.equityRows])),
        totalBankAccounts: withChange(balanceSheetData.totalBankAccounts, bsCompareData.totalBankAccounts),
        totalOtherCurrentAssets: withChange(balanceSheetData.totalOtherCurrentAssets, bsCompareData.totalOtherCurrentAssets),
        totalCurrentAssets: withChange(balanceSheetData.totalCurrentAssets, bsCompareData.totalCurrentAssets),
        totalFixedAssets: withChange(balanceSheetData.totalFixedAssets, bsCompareData.totalFixedAssets),
        totalAssets: withChange(balanceSheetData.totalAssets, bsCompareData.totalAssets),
        totalLiabilities: withChange(balanceSheetData.totalLiabilities, bsCompareData.totalLiabilities),
        totalEquity: withChange(balanceSheetData.totalEquity, bsCompareData.totalEquity),
        totalLiabilitiesAndEquity: withChange(
          balanceSheetData.totalLiabilitiesAndEquity,
          bsCompareData.totalLiabilitiesAndEquity
        ),
        netIncome: withChange(balanceSheetData.netIncome, bsCompareData.netIncome)
      };
    }
    const columns: ReportValueColumn[] = [{ key: "total", format: "money" }];
    return {
      columns,
      columnLabels: ["Total"],
      bankAccounts: buildHierarchyRowsMulti([balanceSheetData.bankAccounts]),
      otherCurrentAssets: buildHierarchyRowsMulti([balanceSheetData.otherCurrentAssets]),
      fixedAssets: buildHierarchyRowsMulti([balanceSheetData.fixedAssets]),
      liabilities: buildHierarchyRowsMulti([balanceSheetData.liabilities]),
      equityRows: buildHierarchyRowsMulti([balanceSheetData.equityRows]),
      totalBankAccounts: [balanceSheetData.totalBankAccounts],
      totalOtherCurrentAssets: [balanceSheetData.totalOtherCurrentAssets],
      totalCurrentAssets: [balanceSheetData.totalCurrentAssets],
      totalFixedAssets: [balanceSheetData.totalFixedAssets],
      totalAssets: [balanceSheetData.totalAssets],
      totalLiabilities: [balanceSheetData.totalLiabilities],
      totalEquity: [balanceSheetData.totalEquity],
      totalLiabilitiesAndEquity: [balanceSheetData.totalLiabilitiesAndEquity],
      netIncome: [balanceSheetData.netIncome]
    };
  }, [isColumnar, bsColumnarPeriods, isComparing, bsCompareData, compareRange, balanceSheetData, toDate]);

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
      <section className="report-print-card mx-auto mt-8 w-full max-w-[840px] rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5 shadow-sm">

        {/* ── Report toolbar ── */}
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2 border-b border-[var(--color-divider-tertiary)] pb-3">
          <span className="text-xs text-[var(--color-icon-secondary)]">
            {accountingMethod === "cash" ? "Cash basis" : "Accrual basis"}
          </span>
          <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
            Print
          </Button>
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
                {plReport.columnLabels.map((label, i) => (
                  <th key={plReport.columns[i].key} className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <ReportSection
                label="Income"
                isOpen={openSections.income ?? true}
                onToggle={() => toggleSection("income")}
                valueColumnCount={plReport.columns.length}
              >
                <ReportAccountRows
                  rows={plReport.incomeRows}
                  columns={plReport.columns}
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
                  <ReportValueCells values={plReport.totalIncome} columns={plReport.columns} />
                </tr>
              </ReportSection>

              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Gross Profit</td>
                <ReportValueCells values={plReport.totalIncome} columns={plReport.columns} />
              </tr>

              <ReportSection
                label="Expenses"
                isOpen={openSections.expenses ?? true}
                onToggle={() => toggleSection("expenses")}
                valueColumnCount={plReport.columns.length}
              >
                <ReportAccountRows
                  rows={plReport.expenseRows}
                  columns={plReport.columns}
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
                  <ReportValueCells values={plReport.totalExpense} columns={plReport.columns} />
                </tr>
              </ReportSection>

              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Net Operating Income</td>
                <ReportValueCells values={plReport.operatingIncome} columns={plReport.columns} />
              </tr>
              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Net Income</td>
                <ReportValueCells values={plReport.netIncome} columns={plReport.columns} />
              </tr>
            </tbody>
          </table>

        ) : (
          /* ── Balance Sheet summary table ── */
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
                <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]"> </th>
                {bsReport.columnLabels.map((label, i) => (
                  <th key={bsReport.columns[i].key} className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Assets — collapsible */}
              <ReportSection
                label="Assets"
                isOpen={openSections.bs_assets ?? true}
                onToggle={() => toggleSection("bs_assets")}
                valueColumnCount={bsReport.columns.length}
              >
                <tr className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-4 py-1 font-medium text-[var(--color-text-primary)]">Current Assets</td>
                  <td colSpan={bsReport.columns.length} />
                </tr>
                <tr className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-6 py-1 font-medium text-[var(--color-text-primary)]">Bank Accounts</td>
                  <td colSpan={bsReport.columns.length} />
                </tr>
                <ReportAccountRows
                  rows={bsReport.bankAccounts}
                  columns={bsReport.columns}
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
                  <ReportValueCells values={bsReport.totalBankAccounts} columns={bsReport.columns} />
                </tr>
                <ReportAccountRows
                  rows={bsReport.otherCurrentAssets}
                  columns={bsReport.columns}
                  collapsedNames={collapsedAccounts}
                  rowKeyPrefix="other-current-asset"
                  baseIndentRem={2}
                  onToggleCollapse={toggleAccountCollapse}
                  onDrillAmount={() => setDrillSection({
                    label: "Other Current Assets",
                    reportLabel,
                    rows: balanceSheetData.otherCurrentAssets,
                    total: balanceSheetData.totalOtherCurrentAssets,
                  })}
                />
                <tr className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-4 py-1 font-semibold text-[var(--color-text-primary)]">Total for Current Assets</td>
                  <ReportValueCells values={bsReport.totalCurrentAssets} columns={bsReport.columns} />
                </tr>
                {bsReport.fixedAssets.length > 0 ? (
                  <>
                    <tr className="border-b border-[var(--color-container-background-secondary)]">
                      <td className="px-4 py-1 font-medium text-[var(--color-text-primary)]">Fixed Assets</td>
                      <td colSpan={bsReport.columns.length} />
                    </tr>
                    <ReportAccountRows
                      rows={bsReport.fixedAssets}
                      columns={bsReport.columns}
                      collapsedNames={collapsedAccounts}
                      rowKeyPrefix="fixed-asset"
                      baseIndentRem={2}
                      onToggleCollapse={toggleAccountCollapse}
                      onDrillAmount={() => setDrillSection({
                        label: "Fixed Assets",
                        reportLabel,
                        rows: balanceSheetData.fixedAssets,
                        total: balanceSheetData.totalFixedAssets,
                      })}
                    />
                    <tr className="border-b border-[var(--color-container-background-secondary)]">
                      <td className="px-4 py-1 font-semibold text-[var(--color-text-primary)]">Total for Fixed Assets</td>
                      <ReportValueCells values={bsReport.totalFixedAssets} columns={bsReport.columns} />
                    </tr>
                  </>
                ) : null}
                <tr className="border-b border-[var(--color-divider-tertiary)]">
                  <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Total for Assets</td>
                  <ReportValueCells values={bsReport.totalAssets} columns={bsReport.columns} />
                </tr>
              </ReportSection>

              {/* Liabilities and Equity — collapsible, with two nested collapsible sub-sections */}
              <ReportSection
                label="Liabilities and Equity"
                isOpen={openSections.bs_liabilities_equity ?? true}
                onToggle={() => toggleSection("bs_liabilities_equity")}
                valueColumnCount={bsReport.columns.length}
              >
                <ReportSection
                  label="Liabilities"
                  isOpen={openSections.bs_liabilities ?? true}
                  onToggle={() => toggleSection("bs_liabilities")}
                  headerClassName="bg-[var(--color-container-background-secondary)]"
                  valueColumnCount={bsReport.columns.length}
                >
                  <ReportAccountRows
                    rows={bsReport.liabilities}
                    columns={bsReport.columns}
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
                    <ReportValueCells values={bsReport.totalLiabilities} columns={bsReport.columns} />
                  </tr>
                </ReportSection>

                <ReportSection
                  label="Equity"
                  isOpen={openSections.bs_equity ?? true}
                  onToggle={() => toggleSection("bs_equity")}
                  headerClassName="bg-[var(--color-container-background-secondary)]"
                  valueColumnCount={bsReport.columns.length}
                >
                  <ReportAccountRows
                    rows={bsReport.equityRows}
                    columns={bsReport.columns}
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
                    <ReportValueCells values={bsReport.netIncome} columns={bsReport.columns} />
                  </tr>
                  <tr className="border-b border-[var(--color-container-background-secondary)]">
                    <td className="px-4 py-1 font-semibold text-[var(--color-text-primary)]">Total for Equity</td>
                    <ReportValueCells values={bsReport.totalEquity} columns={bsReport.columns} />
                  </tr>
                </ReportSection>

                <tr className="border-b border-[var(--color-divider-tertiary)]">
                  <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Total for Liabilities and Equity</td>
                  <ReportValueCells values={bsReport.totalLiabilitiesAndEquity} columns={bsReport.columns} />
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
