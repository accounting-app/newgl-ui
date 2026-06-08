/**
 * Global accounting configuration.
 *
 * The plan (§3) requires the system to clearly declare which accounting basis it
 * uses. This app operates on a **cash basis** bank register, so income/expense is
 * recognized when money actually moves (not when invoiced/billed). Because of this,
 * Accounts Receivable / Accounts Payable subledgers are intentionally NOT used.
 */
export type AccountingBasis = "cash" | "accrual";

export const ACCOUNTING_CONFIG = {
  basis: "cash" as AccountingBasis,
  fiscalYearStart: "01-01", // MM-DD
  currency: "USD",
  currencySymbol: "$",
  /** Tolerance (in currency units) used for all debit/credit equality checks. */
  roundingTolerance: 0.005
} as const;

export function isCashBasis(): boolean {
  return ACCOUNTING_CONFIG.basis === "cash";
}
