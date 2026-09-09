import type { Account } from "@/modules/accounting/domain/models";

/**
 * QuickBooks Online's own "New account" Account type / Detail type
 * taxonomy, transcribed from their real form (screenshots supplied
 * 2026-09-10) so our own "New account" picker matches theirs exactly
 * instead of inventing our own wording. `subtype` already exists end-to-
 * end on our Account model/API (see newgl-api's account-service.ts) --
 * this file is what was actually missing to use it as a real "Detail
 * type" field.
 *
 * Grouped exactly like QBO's own dropdown (bold ASSET/LIABILITY/EQUITY/
 * INCOME/EXPENSE section headers). Reuses the label QBO uses next to each
 * Account type, and ACCOUNT_TYPE_BY_CATEGORY's own grouping (see
 * http-service-container.ts) for which of our categories fall under which
 * group.
 *
 * Known gaps -- QBO account types we don't have a matching category for
 * yet, so they're left out of ACCOUNT_TYPE_OPTIONS entirely rather than
 * mapped to something wrong:
 * - "Other Assets" (QBO has this as its own Account type, distinct from
 *   "Other Current Assets" -- we only have the latter)
 * - "Cost of Goods Sold" (QBO has this as its own Account type under
 *   EXPENSE, distinct from "Expenses" -- we only have EXPENSE/OTHER_EXPENSE)
 * Both would need a new category value added to accountCategorySchema
 * (newgl-api + quickslike) plus everywhere that enumerates categories
 * (reports, DEBIT_NORMAL_CATEGORIES, ACCOUNT_ROOT_GROUPS, ...) -- a real
 * schema change, not just a UI addition, so deferred until asked for.
 *
 * Also incomplete -- QBO's own Detail type lists for EXPENSE and
 * OTHER_EXPENSE weren't part of the supplied screenshots, so those two
 * categories fall back to a single generic option below. Fill these in
 * from QBO's real list the same way the other 11 were done.
 */

export type AccountTypeOption = {
  category: Account["category"];
  /** QBO's own label for this Account type, e.g. "Accounts receivable (A/R)". */
  label: string;
};

export type AccountTypeGroup = {
  /** QBO's own bold section header above this group's Account type options. */
  groupLabel: string;
  options: AccountTypeOption[];
};

export const ACCOUNT_TYPE_GROUPS: AccountTypeGroup[] = [
  {
    groupLabel: "Asset",
    options: [
      { category: "BANK", label: "Bank" },
      { category: "ACCOUNTS_RECEIVABLE", label: "Accounts receivable (A/R)" },
      { category: "OTHER_CURRENT_ASSET", label: "Other Current Assets" },
      { category: "FIXED_ASSET", label: "Fixed Assets" }
    ]
  },
  {
    groupLabel: "Liability",
    options: [
      { category: "CREDIT_CARD", label: "Credit Card" },
      { category: "ACCOUNTS_PAYABLE", label: "Accounts payable (A/P)" },
      { category: "OTHER_CURRENT_LIABILITY", label: "Other Current Liabilities" },
      { category: "LONG_TERM_LIABILITY", label: "Long Term Liabilities" }
    ]
  },
  {
    groupLabel: "Equity",
    options: [{ category: "EQUITY", label: "Equity" }]
  },
  {
    groupLabel: "Income",
    options: [
      { category: "INCOME", label: "Income" },
      { category: "OTHER_INCOME", label: "Other Income" }
    ]
  },
  {
    groupLabel: "Expense",
    options: [
      { category: "EXPENSE", label: "Expenses" },
      { category: "OTHER_EXPENSE", label: "Other Expense" }
    ]
  }
];

/** QBO's real "Detail type" options for each Account type, in their own on-screen order. */
export const DETAIL_TYPES_BY_CATEGORY: Record<Account["category"], string[]> = {
  BANK: ["Cash on hand", "Checking", "Money Market", "Rents Held in Trust", "Savings", "Trust account"],
  ACCOUNTS_RECEIVABLE: ["Accounts Receivable (A/R)"],
  OTHER_CURRENT_ASSET: [
    "Allowance for Bad Debts",
    "Development Costs",
    "Employee Cash Advances",
    "Inventory",
    "Investment - Mortgage/Real Estate Loans",
    "Investment - Tax-Exempt Securities",
    "Investment - U.S. Government Obligations",
    "Investments - Other",
    "Loans To Officers",
    "Loans to Others",
    "Loans to Stockholders",
    "Other Current Assets",
    "Prepaid Expenses",
    "Retainage",
    "Undeposited Funds"
  ],
  FIXED_ASSET: [
    "Accumulated Amortization",
    "Accumulated Depletion",
    "Accumulated Depreciation",
    "Buildings",
    "Depletable Assets",
    "Fixed Asset Computers",
    "Fixed Asset Copiers",
    "Fixed Asset Furniture",
    "Fixed Asset Software",
    "Furniture & Fixtures",
    "Intangible Assets",
    "Land",
    "Leasehold Improvements",
    "Machinery & Equipment",
    "Other fixed assets",
    "Vehicles"
  ],
  CREDIT_CARD: ["Credit Card"],
  ACCOUNTS_PAYABLE: ["Accounts Payable (A/P)"],
  OTHER_CURRENT_LIABILITY: [
    "Deferred Revenue",
    "Federal Income Tax Payable",
    "Insurance Payable",
    "Line of Credit",
    "Loan Payable",
    "Other Current Liabilities",
    "Payroll Clearing",
    "Payroll Tax Payable",
    "Prepaid Expenses Payable",
    "Rents in trust - Liability",
    "Sales Tax Payable",
    "State/Local Income Tax Payable",
    "Trust Accounts - Liabilities",
    "Undistributed Tips"
  ],
  LONG_TERM_LIABILITY: ["Notes Payable", "Other Long Term Liabilities", "Shareholder Notes Payable"],
  EQUITY: [
    "Accumulated Adjustment",
    "Common Stock",
    "Estimated Taxes",
    "Health Insurance Premium",
    "Health Savings Account Contribution",
    "Opening Balance Equity",
    "Owner's Equity",
    "Paid-In Capital or Surplus",
    "Partner Contributions",
    "Partner Distributions",
    "Partner's Equity",
    "Personal Expense",
    "Personal Income",
    "Preferred Stock",
    "Retained Earnings",
    "Treasury Stock"
  ],
  INCOME: [
    "Discounts/Refunds Given",
    "Non-Profit Income",
    "Other Primary Income",
    "Sales of Product Income",
    "Service/Fee Income",
    "Unapplied Cash Payment Income"
  ],
  OTHER_INCOME: ["Dividend Income", "Interest Earned", "Other Investment Income", "Other Miscellaneous Income", "Tax-Exempt Interest"],
  // TODO: not in the supplied screenshots -- fill in the rest from QBO's
  // real list the same way the other 11 categories were done. The two
  // below aren't guesses: they're the real subtypes this app's own seed
  // data already uses on its Expense accounts (Admin/Coding Contractor,
  // Cost of Goods Sold), confirmed via GET /api/accounts.
  EXPENSE: ["Cost of labor - COS", "Supplies & Materials - COGS", "Expenses"],
  OTHER_EXPENSE: ["Other Expense"]
};
