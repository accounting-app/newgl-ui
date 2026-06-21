"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, LedgerPosting } from "@/modules/accounting/domain/models";

type ReportType = "profit_loss" | "balance_sheet" | "cash_flow" | "trial_balance";
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

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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

export function ReportsPage() {
  const services = useMemo(() => getServiceContainer(), []);
  const [reportType, setReportType] = useState<ReportType>("profit_loss");
  const [reportPeriod, setReportPeriod] = useState<ReportPeriodPreset>(REPORT_DEFAULT_PERIOD);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [accountingMethod, setAccountingMethod] = useState<AccountingMethod>("cash");
  const [displayColumnsBy, setDisplayColumnsBy] = useState<string>(REPORT_DEFAULT_DISPLAY_COLUMNS_BY);
  const [compareTo, setCompareTo] = useState<string>(REPORT_DEFAULT_COMPARE_TO);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [postings, setPostings] = useState<LedgerPosting[]>([]);

  useEffect(() => {
    const range = dateRangeForPreset(REPORT_DEFAULT_PERIOD);
    setFromDate(range.from);
    setToDate(range.to);
  }, []);

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
    services.ledgerService.listPostings().then(setPostings).catch(() => setPostings([]));
  }, [services]);

  function handlePeriodChange(value: string) {
    const preset = value as ReportPeriodPreset;
    setReportPeriod(preset);
    if (preset === "custom") {
      return;
    }
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
    accounts.forEach((account) => map.set(account.id, account));
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

      if (incomeCategories.has(account.category)) {
        incomeTotal += impact;
      }
      if (expenseCategories.has(account.category)) {
        expenseTotal += impact;
      }
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

      if (incomeCategories.has(account.category)) {
        incomeMap.set(account.name, (incomeMap.get(account.name) ?? 0) + impact);
      }
      if (expenseCategories.has(account.category)) {
        expenseMap.set(account.name, (expenseMap.get(account.name) ?? 0) + impact);
      }
    });

    const incomeRows = [...incomeMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .filter((row) => Math.abs(row.amount) > 0.0001)
      .sort((a, b) => a.name.localeCompare(b.name));

    const expenseRows = [...expenseMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .filter((row) => Math.abs(row.amount) > 0.0001)
      .sort((a, b) => a.name.localeCompare(b.name));

    const totalIncome = incomeRows.reduce((sum, row) => sum + row.amount, 0);
    const totalExpense = expenseRows.reduce((sum, row) => sum + row.amount, 0);
    const operatingIncome = totalIncome - totalExpense;

    return {
      incomeRows,
      expenseRows,
      totalIncome,
      totalExpense,
      operatingIncome,
      netIncome: operatingIncome
    };
  }, [accountById, postingsInRange]);

  const balanceSheetData = useMemo(() => {
    const asOfDate = toDate || isoDate(new Date());
    const asOfPostings = postings.filter(
      (posting) => posting.status === "POSTED" && posting.postingDate <= asOfDate
    );

    const balances = new Map<string, number>();
    accounts.forEach((account) => {
      balances.set(account.id, account.openingBalance ?? 0);
    });

    asOfPostings.forEach((posting) => {
      const account = accountById.get(posting.accountId);
      if (!account) return;
      balances.set(posting.accountId, (balances.get(posting.accountId) ?? 0) + signedImpact(account, posting));
    });

    const byCategory = (categories: Set<Account["category"]>) =>
      accounts
        .filter((account) => categories.has(account.category))
        .map((account) => ({ name: account.name, amount: balances.get(account.id) ?? 0 }))
        .filter((row) => Math.abs(row.amount) > 0.0001)
        .sort((a, b) => a.name.localeCompare(b.name));

    const bankAccounts = byCategory(new Set(["BANK"]));
    const currentAssets = byCategory(new Set(["BANK", "ACCOUNTS_RECEIVABLE", "OTHER_CURRENT_ASSET"]));
    const fixedAssets = byCategory(new Set(["FIXED_ASSET"]));
    const liabilities = byCategory(new Set(["CREDIT_CARD", "LONG_TERM_LIABILITY", "OTHER_CURRENT_LIABILITY"]));
    const equityRows = byCategory(new Set(["EQUITY"]));

    const totalBankAccounts = bankAccounts.reduce((sum, row) => sum + row.amount, 0);
    const totalCurrentAssets = currentAssets.reduce((sum, row) => sum + row.amount, 0);
    const totalFixedAssets = fixedAssets.reduce((sum, row) => sum + row.amount, 0);
    const totalAssets = totalCurrentAssets + totalFixedAssets;

    const totalLiabilities = liabilities.reduce((sum, row) => sum + row.amount, 0);
    const totalEquityWithoutNetIncome = equityRows.reduce((sum, row) => sum + row.amount, 0);
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
      netIncome
    };
  }, [accounts, accountById, postings, toDate, netIncome]);

  return (
    <main className="tw-override main bg-[var(--color-container-background-primary)] text-sm text-[var(--color-text-primary)]">
      <header className="header header-reports mb-4 ">
        <div className="w-full">
          <h1 className="page-title">Reports</h1>
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
            <InputField type="date" value={fromDate} onChange={(event) => handleFromChange(event.target.value)} />
          </div>
          <div>
            <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">To</p>
            <InputField type="date" value={toDate} onChange={(event) => handleToChange(event.target.value)} />
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-divider-tertiary)] pb-3">
          <div className="flex items-center gap-2">
            <Button
              variant={reportType === "profit_loss" ? "primary" : "secondary"}
              onClick={() => setReportType("profit_loss")}
            >
              Profit and Loss
            </Button>
            <Button
              variant={reportType === "balance_sheet" ? "primary" : "secondary"}
              onClick={() => setReportType("balance_sheet")}
            >
              Balance Sheet
            </Button>
          </div>
          <span className="text-xs text-[var(--color-icon-secondary)]">{accountingMethod === "cash" ? "Cash basis" : "Accrual basis"}</span>
        </div>

        <div className="mb-4 text-center">
          <h2 className="text-[28px] font-medium text-[var(--color-text-global)]">{REPORT_USER_NAME}</h2>
          <p className="text-[16px] text-[var(--color-text-primary)]">{reportType === "profit_loss" ? "Profit and Loss" : "Balance Sheet"}</p>
          <p className="text-xs text-[var(--color-icon-secondary)]">
            {reportType === "profit_loss" ? formatAsRange(fromDate, toDate) : `As of ${formatAsRange("", toDate)}`}
          </p>
          <p className="mt-1 text-[11px] text-[var(--color-icon-secondary)]">
            {reportType === "profit_loss" ? "Profit and Loss report is ready" : "Balance Sheet report is ready"}
          </p>
        </div>

        {reportType === "profit_loss" ? (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
                <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]"> </th>
                <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--color-container-background-secondary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-medium text-[var(--color-text-primary)]">Income</td>
                <td />
              </tr>
              {profitAndLossData.incomeRows.map((row) => (
                <tr key={`income-${row.name}`} className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-6 py-1 text-[var(--color-text-primary)]">{row.name}</td>
                  <td className="px-3 py-1 text-right">{formatMoney(row.amount)}</td>
                </tr>
              ))}
              <tr className="border-b border-[var(--color-divider-tertiary)]">
                <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Total for Income</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(profitAndLossData.totalIncome)}</td>
              </tr>
              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Gross Profit</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(profitAndLossData.totalIncome)}</td>
              </tr>

              <tr className="border-b border-[var(--color-container-background-secondary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-medium text-[var(--color-text-primary)]">Expenses</td>
                <td />
              </tr>
              {profitAndLossData.expenseRows.map((row) => (
                <tr key={`expense-${row.name}`} className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-6 py-1 text-[var(--color-text-primary)]">{row.name}</td>
                  <td className="px-3 py-1 text-right">{formatMoney(row.amount)}</td>
                </tr>
              ))}
              <tr className="border-b border-[var(--color-divider-tertiary)]">
                <td className="px-3 py-1 font-semibold text-[var(--color-text-primary)]">Total for Expenses</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(profitAndLossData.totalExpense)}</td>
              </tr>
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
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-y border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
                <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]"> </th>
                <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[var(--color-container-background-secondary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-medium">Assets</td>
                <td />
              </tr>
              <tr className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-4 py-1 font-medium">Current Assets</td>
                <td />
              </tr>
              <tr className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-6 py-1 font-medium">Bank Accounts</td>
                <td />
              </tr>
              {balanceSheetData.bankAccounts.map((row) => (
                <tr key={`bank-${row.name}`} className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-8 py-1">{row.name}</td>
                  <td className="px-3 py-1 text-right">{formatMoney(row.amount)}</td>
                </tr>
              ))}
              <tr className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-6 py-1 font-semibold">Total for Bank Accounts</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalBankAccounts)}</td>
              </tr>
              <tr className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-4 py-1 font-semibold">Total for Current Assets</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalCurrentAssets)}</td>
              </tr>
              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-semibold">Total for Assets</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalAssets)}</td>
              </tr>

              <tr className="border-b border-[var(--color-container-background-secondary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-medium">Liabilities and Equity</td>
                <td />
              </tr>
              <tr className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-4 py-1 font-medium">Liabilities</td>
                <td />
              </tr>
              {balanceSheetData.liabilities.map((row) => (
                <tr key={`liability-${row.name}`} className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-6 py-1">{row.name}</td>
                  <td className="px-3 py-1 text-right">{formatMoney(row.amount)}</td>
                </tr>
              ))}
              <tr className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-4 py-1 font-semibold">Total for Liabilities</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalLiabilities)}</td>
              </tr>

              <tr className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-4 py-1 font-medium">Equity</td>
                <td />
              </tr>
              {balanceSheetData.equityRows.map((row) => (
                <tr key={`equity-${row.name}`} className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="px-6 py-1">{row.name}</td>
                  <td className="px-3 py-1 text-right">{formatMoney(row.amount)}</td>
                </tr>
              ))}
              <tr className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-6 py-1">Net Income</td>
                <td className="px-3 py-1 text-right">{formatMoney(balanceSheetData.netIncome)}</td>
              </tr>
              <tr className="border-b border-[var(--color-container-background-secondary)]">
                <td className="px-4 py-1 font-semibold">Total for Equity</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalEquity)}</td>
              </tr>
              <tr className="border-b border-[var(--color-divider-tertiary)] bg-[var(--color-report-row-alt)]">
                <td className="px-3 py-1 font-semibold">Total for Liabilities and Equity</td>
                <td className="px-3 py-1 text-right font-semibold">{formatMoney(balanceSheetData.totalLiabilitiesAndEquity)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </section>
      </section>
    </main>
  );
}
