import type { RegisterEntry } from "@/modules/accounting/domain/models";

/**
 * Accounting periods (plan §4). Records are organized by period and closed/locked
 * periods are immutable. We derive a monthly period from a transaction date so any
 * date is covered, and a small set of explicitly closed/locked periods can block
 * edits. By default no period is closed, so existing flows keep working.
 */
export type PeriodStatus = "open" | "closed" | "locked";

export type AccountingPeriod = {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: PeriodStatus;
};

/**
 * Periods that are NOT open. Keyed by `YYYY-MM`. Empty by default so nothing is
 * blocked today; closing a month here will make its transactions immutable.
 */
const PERIOD_STATUS_OVERRIDES: Record<string, PeriodStatus> = {
  // Example (disabled): "2026-04": "closed",
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Returns the monthly period that contains the given `YYYY-MM-DD` date. */
export function findPeriodForDate(transactionDate: string): AccountingPeriod {
  const [yearText, monthText] = transactionDate.split("-");
  const year = Number.parseInt(yearText, 10);
  const monthNumber = Number.parseInt(monthText, 10);
  if (!Number.isFinite(year) || !Number.isFinite(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error(`Invalid transaction date: ${transactionDate}`);
  }
  const monthIndex = monthNumber - 1;
  const key = `${yearText}-${monthText.padStart(2, "0")}`;
  const lastDay = lastDayOfMonth(year, monthIndex);
  return {
    id: `period-${key}`,
    name: `${MONTH_NAMES[monthIndex]} ${year}`,
    startDate: `${key}-01`,
    endDate: `${key}-${String(lastDay).padStart(2, "0")}`,
    status: PERIOD_STATUS_OVERRIDES[key] ?? "open"
  };
}

export function getPeriodIdForDate(transactionDate: string): string {
  return findPeriodForDate(transactionDate).id;
}

/** Plan §4: block writing to a date whose period is closed or locked. */
export function validateTransactionPeriod(transactionDate: string): AccountingPeriod {
  const period = findPeriodForDate(transactionDate);
  if (period.status === "closed") {
    throw new Error(`Period ${period.name} is closed. Create a transaction in an open period instead.`);
  }
  if (period.status === "locked") {
    throw new Error(`Period ${period.name} is locked by an administrator.`);
  }
  return period;
}

/** Opening/closing balance for a period, derived from the account's running balances. */
export function summarizePeriod(
  period: AccountingPeriod,
  entries: RegisterEntry[]
): { openingBalance: number; closingBalance: number } {
  const within = entries
    .filter((entry) => entry.date >= period.startDate && entry.date <= period.endDate)
    .sort((a, b) => `${a.date}-${a.createdAt}`.localeCompare(`${b.date}-${b.createdAt}`));

  if (within.length === 0) {
    return { openingBalance: 0, closingBalance: 0 };
  }
  const first = within[0];
  const last = within[within.length - 1];
  const firstMovement = (first.deposit ?? 0) - (first.payment ?? 0);
  return {
    openingBalance: round2(first.runningBalance - firstMovement),
    closingBalance: round2(last.runningBalance)
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
