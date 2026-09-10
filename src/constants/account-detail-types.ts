import type { Account } from "@/modules/accounting/domain/models";

/**
 * QuickBooks Online's own "New account" Account type / Detail type
 * taxonomy, transcribed from their real form (screenshots supplied
 * 2026-09-09 / 2026-09-10) so our own "New account" picker matches theirs
 * exactly instead of inventing our own wording.
 *
 * `subtype` already exists end-to-end on our Account model/API (see
 * newgl-api's account-service.ts) and stores the chosen Detail type
 * verbatim -- so nothing here is lost even where the Account type doesn't
 * map cleanly to one of our own `category` values.
 *
 * Two of QBO's 15 Account types have no dedicated `category` in our model
 * yet, so for now they map to the closest existing one (noted per-entry
 * below). This is a known interim -- "later we'll fix the functionality"
 * per the user -- and means:
 * - a "Cost of Goods Sold" account is stored as category EXPENSE (which is
 *   what this app's own seed data already does: see the seeded "Cost of
 *   Goods Sold" account, category EXPENSE, subtype "Supplies & Materials -
 *   COGS")
 * - an "Other Assets" account is stored as category OTHER_CURRENT_ASSET,
 *   which is wrong for a genuinely long-term asset (Goodwill etc. would
 *   show under Current Assets on the Balance Sheet) -- fixing that
 *   properly needs a new category value threaded through
 *   accountCategorySchema + every place that enumerates categories
 *   (reports, DEBIT_NORMAL_CATEGORIES, ACCOUNT_ROOT_GROUPS, ...).
 */

/** QBO's own Account type identity -- NOT the same as our `category`, since two of these collapse onto one category (see `category` on each option). */
export type AccountTypeKey =
  | "BANK"
  | "ACCOUNTS_RECEIVABLE"
  | "OTHER_CURRENT_ASSET"
  | "FIXED_ASSET"
  | "OTHER_ASSET"
  | "CREDIT_CARD"
  | "ACCOUNTS_PAYABLE"
  | "OTHER_CURRENT_LIABILITY"
  | "LONG_TERM_LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "OTHER_INCOME"
  | "COST_OF_GOODS_SOLD"
  | "EXPENSES"
  | "OTHER_EXPENSE";

export type AccountTypeOption = {
  key: AccountTypeKey;
  /** QBO's own label for this Account type, e.g. "Accounts receivable (A/R)". */
  label: string;
  /** Which of our `category` values an account of this type is stored as. */
  category: Account["category"];
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
      { key: "BANK", label: "Bank", category: "BANK" },
      { key: "ACCOUNTS_RECEIVABLE", label: "Accounts receivable (A/R)", category: "ACCOUNTS_RECEIVABLE" },
      { key: "OTHER_CURRENT_ASSET", label: "Other Current Assets", category: "OTHER_CURRENT_ASSET" },
      { key: "FIXED_ASSET", label: "Fixed Assets", category: "FIXED_ASSET" },
      // Interim: no dedicated non-current-asset category yet.
      { key: "OTHER_ASSET", label: "Other Assets", category: "OTHER_CURRENT_ASSET" }
    ]
  },
  {
    groupLabel: "Liability",
    options: [
      { key: "CREDIT_CARD", label: "Credit Card", category: "CREDIT_CARD" },
      { key: "ACCOUNTS_PAYABLE", label: "Accounts payable (A/P)", category: "ACCOUNTS_PAYABLE" },
      { key: "OTHER_CURRENT_LIABILITY", label: "Other Current Liabilities", category: "OTHER_CURRENT_LIABILITY" },
      { key: "LONG_TERM_LIABILITY", label: "Long Term Liabilities", category: "LONG_TERM_LIABILITY" }
    ]
  },
  {
    groupLabel: "Equity",
    options: [{ key: "EQUITY", label: "Equity", category: "EQUITY" }]
  },
  {
    groupLabel: "Income",
    options: [
      { key: "INCOME", label: "Income", category: "INCOME" },
      { key: "OTHER_INCOME", label: "Other Income", category: "OTHER_INCOME" }
    ]
  },
  {
    groupLabel: "Expense",
    options: [
      // Interim: stored as EXPENSE (matches this app's own seed data).
      { key: "COST_OF_GOODS_SOLD", label: "Cost of Goods Sold", category: "EXPENSE" },
      { key: "EXPENSES", label: "Expenses", category: "EXPENSE" },
      { key: "OTHER_EXPENSE", label: "Other Expense", category: "OTHER_EXPENSE" }
    ]
  }
];

const ACCOUNT_TYPE_OPTION_BY_KEY: Record<AccountTypeKey, AccountTypeOption> = Object.fromEntries(
  ACCOUNT_TYPE_GROUPS.flatMap((group) => group.options).map((option) => [option.key, option])
) as Record<AccountTypeKey, AccountTypeOption>;

export function categoryForAccountType(key: AccountTypeKey): Account["category"] {
  return ACCOUNT_TYPE_OPTION_BY_KEY[key].category;
}

/**
 * Best-effort reverse map (our `category` -> a QBO Account type key), for
 * pre-filling the picker when the starting point is an existing account
 * (e.g. adding a subaccount). Picks the "primary" type for categories that
 * more than one QBO type collapses onto.
 */
export function accountTypeKeyForCategory(category: Account["category"]): AccountTypeKey {
  const primary: Partial<Record<Account["category"], AccountTypeKey>> = {
    EXPENSE: "EXPENSES"
  };
  return primary[category] ?? (category as AccountTypeKey);
}

/** QBO's real "Detail type" options for each Account type, in their own on-screen order. */
export const DETAIL_TYPES_BY_ACCOUNT_TYPE: Record<AccountTypeKey, string[]> = {
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
  OTHER_ASSET: [
    "Accumulated Amortization of Other Assets",
    "Goodwill",
    "Lease Buyout",
    "Licenses",
    "Organizational Costs",
    "Other Long-term Assets",
    "Security Deposits"
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
  COST_OF_GOODS_SOLD: [
    "Cost of labor - COS",
    "Equipment Rental - COS",
    "Other Costs of Services - COS",
    "Shipping, Freight & Delivery - COS",
    "Supplies & Materials - COGS"
  ],
  EXPENSES: [
    "Advertising/Promotional",
    "Auto",
    "Bad Debts",
    "Bank Charges",
    "Charitable Contributions",
    "Communication",
    "Cost of Labor",
    "Dues & subscriptions",
    "Entertainment",
    "Entertainment Meals",
    "Equipment Rental",
    "Finance costs",
    "Insurance",
    "Interest Paid",
    "Legal & Professional Fees",
    "Office/General Administrative Expenses",
    "Other Business Expenses",
    "Other Miscellaneous Service Cost",
    "Payroll Expenses",
    "Payroll Tax Expenses",
    "Payroll Wage Expenses",
    "Promotional Meals",
    "Rent or Lease of Buildings",
    "Repair & Maintenance",
    "Shipping, Freight & Delivery",
    "Supplies & Materials",
    "Taxes Paid",
    "Travel",
    "Travel Meals",
    "Unapplied Cash Bill Payment Expense",
    "Utilities"
  ],
  OTHER_EXPENSE: [
    "Amortization",
    "Depreciation",
    "Exchange Gain or Loss",
    "Gas And Fuel",
    "Home Office",
    "Homeowner Rental Insurance",
    "Mortgage Interest Home Office",
    "Other Home Office Expenses",
    "Other Miscellaneous Expense",
    "Other Vehicle Expenses",
    "Parking and Tolls",
    "Penalties & Settlements",
    "Property Tax Home Office",
    "Rent and Lease Home Office",
    "Repairs and Maintenance Home Office",
    "Utilities Home Office",
    "Vehicle",
    "Vehicle Insurance",
    "Vehicle Lease",
    "Vehicle Loan",
    "Vehicle Loan Interest",
    "Vehicle Registration",
    "Vehicle Repairs",
    "Wash and Road Services"
  ]
};
