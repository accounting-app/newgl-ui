import type { Account, TransactionType } from "@/modules/accounting/domain/models";

type ExtraBankRegisterTransactionTypeId =
  | "CC_EXPENSE"
  | "INVOICE"
  | "BILL"
  | "CC_CREDIT"
  | "VENDOR_CREDIT"
  | "CC_BILL_PAYMENT"
  | "CASH_EXPENSE"
  | "CREDIT_MEMO"
  | "PAYROLL_CHECK"
  | "TAX_PAYMENT"
  | "PAYROLL_ADJUSTMENT"
  | "PAYROLL_REFUND"
  | "SALES_TAX_PAYMENT"
  | "SALES_TAX_ADJUSTMENT"
  | "CREDIT_CARD_PAYMENT"
  | "EMPLOYEE_NON_REIMBURSABLE_EXPENSE"
  | "EMPLOYEE_REIMBURSEMENT"
  | "EMPLOYEE_REIMBURSABLE_EXPENSE";

export type BankRegisterTransactionTypeId =
  | TransactionType
  | ExtraBankRegisterTransactionTypeId;

export type BankRegisterTransactionTypeOption = {
  id: BankRegisterTransactionTypeId;
  label: string;
};

const BANK_REGISTER_TRANSACTION_TYPE_CATALOG: BankRegisterTransactionTypeOption[] = [
  { id: "CC_EXPENSE", label: "CC Expense" },
  { id: "CHECK", label: "Check" },
  { id: "INVOICE", label: "Invoice" },
  { id: "RECEIVE_PAYMENT", label: "Receive Payment" },
  { id: "JOURNAL_ENTRY", label: "Journal Entry" },
  { id: "BILL", label: "Bill" },
  { id: "CC_CREDIT", label: "CC Credit" },
  { id: "VENDOR_CREDIT", label: "Vendor Credit" },
  { id: "BILL_PAYMENT", label: "Bill Payment" },
  { id: "CC_BILL_PAYMENT", label: "CC Bill Payment" },
  { id: "TRANSFER", label: "Transfer" },
  { id: "DEPOSIT", label: "Deposit" },
  { id: "CASH_EXPENSE", label: "Cash Expense" },
  { id: "SALES_RECEIPT", label: "Sales Receipt" },
  { id: "CREDIT_MEMO", label: "Credit Memo" },
  { id: "REFUND", label: "Refund" },
  { id: "PAYROLL_CHECK", label: "Payroll Check" },
  { id: "TAX_PAYMENT", label: "Tax Payment" },
  { id: "PAYROLL_ADJUSTMENT", label: "Payroll Adjustment" },
  { id: "PAYROLL_REFUND", label: "Payroll Refund" },
  { id: "SALES_TAX_PAYMENT", label: "Sales Tax Payment" },
  { id: "SALES_TAX_ADJUSTMENT", label: "Sales Tax Adjustment" },
  { id: "EXPENSE", label: "Expense" },
  { id: "CREDIT_CARD_PAYMENT", label: "Credit Card Payment" },
  { id: "EMPLOYEE_NON_REIMBURSABLE_EXPENSE", label: "Employee Non-Reimbursable Expense" },
  { id: "EMPLOYEE_REIMBURSEMENT", label: "Employee Reimbursement" },
  { id: "EMPLOYEE_REIMBURSABLE_EXPENSE", label: "Employee Reimbursable Expense" }
];

const TRANSACTION_TYPE_OPTION_BY_ID = new Map<BankRegisterTransactionTypeId, BankRegisterTransactionTypeOption>(
  BANK_REGISTER_TRANSACTION_TYPE_CATALOG.map((option) => [option.id, option])
);

function pickTransactionTypes(ids: readonly BankRegisterTransactionTypeId[]): BankRegisterTransactionTypeOption[] {
  return ids.map((id) => {
    const option = TRANSACTION_TYPE_OPTION_BY_ID.get(id);
    if (!option) {
      throw new Error(`Unsupported bank register transaction type: ${id}`);
    }
    return option;
  });
}

const CASH_ON_HAND_TRANSACTION_TYPE_IDS = [
  "CHECK",
  "DEPOSIT",
  "SALES_RECEIPT",
  "RECEIVE_PAYMENT",
  "BILL_PAYMENT",
  "REFUND",
  "EXPENSE",
  "TRANSFER",
  "JOURNAL_ENTRY"
] satisfies readonly BankRegisterTransactionTypeId[];

const CREDIT_CARD_PAYABLE_TRANSACTION_TYPE_IDS = [
  "CC_EXPENSE",
  "EXPENSE",
  "CC_CREDIT",
  "BILL_PAYMENT",
  "TRANSFER",
  "JOURNAL_ENTRY"
] satisfies readonly BankRegisterTransactionTypeId[];

const CHARITABLE_DONATIONS_TRANSACTION_TYPE_IDS = [
  "TRANSFER",
  "JOURNAL_ENTRY"
] satisfies readonly BankRegisterTransactionTypeId[];

const TODO_ACCOUNT_TRANSACTION_TYPE_IDS = [
  "TRANSFER",
  "JOURNAL_ENTRY"
] satisfies readonly BankRegisterTransactionTypeId[];

const OTHER_CURRENT_ASSET_TRANSACTION_TYPE_IDS = [
  "DEPOSIT",
  "SALES_RECEIPT",
  "RECEIVE_PAYMENT",
  "REFUND",
  "TRANSFER",
  "JOURNAL_ENTRY"
] satisfies readonly BankRegisterTransactionTypeId[];

const CASH_ON_HAND_TRANSACTION_TYPES = pickTransactionTypes(CASH_ON_HAND_TRANSACTION_TYPE_IDS);
const CREDIT_CARD_PAYABLE_TRANSACTION_TYPES = pickTransactionTypes(CREDIT_CARD_PAYABLE_TRANSACTION_TYPE_IDS);
const CHARITABLE_DONATIONS_TRANSACTION_TYPES = pickTransactionTypes(CHARITABLE_DONATIONS_TRANSACTION_TYPE_IDS);
const TODO_ACCOUNT_TRANSACTION_TYPES = pickTransactionTypes(TODO_ACCOUNT_TRANSACTION_TYPE_IDS);
const OTHER_CURRENT_ASSET_TRANSACTION_TYPES = pickTransactionTypes(OTHER_CURRENT_ASSET_TRANSACTION_TYPE_IDS);

const EQUITY_CLEARING_CREDIT_CARD_PAYMENT_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const EQUITY_CLEARING_TRANSFER_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const FEDERAL_ESTIMATED_TAX_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const FEDERAL_TAX_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const HEALTH_SAVINGS_ACCOUNT_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const HEALTH_INSURANCE_PREMIUM_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const MORTGAGE_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const OWNERS_INVESTMENT_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const OWNERS_PAY_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const PERSONAL_EXPENSE_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const PERSONAL_INCOME_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const PROPERTY_TAX_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const RETAINED_EARNINGS_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const RETIREMENT_CONTRIBUTIONS_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const STATE_ESTIMATED_TAX_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const STATE_TAX_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const VISITS_COPAYS_AND_PRESCRIPTIONS_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const APPS_AND_SOFTWARE_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const BUILDING_PURCHASE_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const COMPUTER_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const COPIER_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const FURNITURE_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const LAND_PURCHASE_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const MACHINERY_AND_EQUIPMENT_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const PHONE_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const PHOTO_AND_VIDEO_EQUIPMENT_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const TOOLS_AND_EQUIPMENT_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const VEHICLE_PURCHASE_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const BUSINESS_LOAN_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const MORTGAGE_PRINCIPAL_BUSINESS_PROPERTY_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const MORTGAGE_PRINCIPAL_HOME_OFFICE_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const VEHICLE_LOAN_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;
const LOANS_TO_OTHERS_TRANSACTION_TYPES = OTHER_CURRENT_ASSET_TRANSACTION_TYPES;
const UNCATEGORIZED_ASSET_TRANSACTION_TYPES = OTHER_CURRENT_ASSET_TRANSACTION_TYPES;
const UNDEPOSITED_FUNDS_TRANSACTION_TYPES = OTHER_CURRENT_ASSET_TRANSACTION_TYPES;
const SALES_TAX_TO_PAY_TRANSACTION_TYPES = TODO_ACCOUNT_TRANSACTION_TYPES;

const DEFAULT_CATEGORY_TRANSACTION_TYPES: Partial<
  Record<Account["category"], BankRegisterTransactionTypeOption[]>
> = {
  BANK: CASH_ON_HAND_TRANSACTION_TYPES,
  CREDIT_CARD: CREDIT_CARD_PAYABLE_TRANSACTION_TYPES,
  EQUITY: TODO_ACCOUNT_TRANSACTION_TYPES,
  FIXED_ASSET: TODO_ACCOUNT_TRANSACTION_TYPES,
  LONG_TERM_LIABILITY: TODO_ACCOUNT_TRANSACTION_TYPES,
  OTHER_CURRENT_ASSET: TODO_ACCOUNT_TRANSACTION_TYPES,
  OTHER_CURRENT_LIABILITY: TODO_ACCOUNT_TRANSACTION_TYPES
};

const ACCOUNT_NAME_TRANSACTION_TYPES: Record<string, BankRegisterTransactionTypeOption[]> = {
  "Cash on hand": CASH_ON_HAND_TRANSACTION_TYPES,
  "Credit Card Payable": CREDIT_CARD_PAYABLE_TRANSACTION_TYPES,
  "Charitable donations": CHARITABLE_DONATIONS_TRANSACTION_TYPES,
  "Equity clearing (Credit Card Payment)": EQUITY_CLEARING_CREDIT_CARD_PAYMENT_TRANSACTION_TYPES,
  "Equity clearing (Transfer)": EQUITY_CLEARING_TRANSFER_TRANSACTION_TYPES,
  "Federal estimated tax": FEDERAL_ESTIMATED_TAX_TRANSACTION_TYPES,
  "Federal tax": FEDERAL_TAX_TRANSACTION_TYPES,
  "Health Savings Account": HEALTH_SAVINGS_ACCOUNT_TRANSACTION_TYPES,
  "Health insurance premium": HEALTH_INSURANCE_PREMIUM_TRANSACTION_TYPES,
  Mortgage: MORTGAGE_TRANSACTION_TYPES,
  "Owners investment": OWNERS_INVESTMENT_TRANSACTION_TYPES,
  "Owners pay": OWNERS_PAY_TRANSACTION_TYPES,
  "Personal expense": PERSONAL_EXPENSE_TRANSACTION_TYPES,
  "Personal income": PERSONAL_INCOME_TRANSACTION_TYPES,
  "Property tax": PROPERTY_TAX_TRANSACTION_TYPES,
  "Retained Earnings": RETAINED_EARNINGS_TRANSACTION_TYPES,
  "Retirement contributions": RETIREMENT_CONTRIBUTIONS_TRANSACTION_TYPES,
  "State estimated tax": STATE_ESTIMATED_TAX_TRANSACTION_TYPES,
  "State tax": STATE_TAX_TRANSACTION_TYPES,
  "Visits, copays, and prescriptions": VISITS_COPAYS_AND_PRESCRIPTIONS_TRANSACTION_TYPES,
  "Apps and software (> $200)": APPS_AND_SOFTWARE_TRANSACTION_TYPES,
  "Building purchase": BUILDING_PURCHASE_TRANSACTION_TYPES,
  "Computer (> $200)": COMPUTER_TRANSACTION_TYPES,
  "Copier (> $200)": COPIER_TRANSACTION_TYPES,
  "Furniture (> $200)": FURNITURE_TRANSACTION_TYPES,
  "Land purchase": LAND_PURCHASE_TRANSACTION_TYPES,
  "Machinery and equipment": MACHINERY_AND_EQUIPMENT_TRANSACTION_TYPES,
  "Phone (> $200)": PHONE_TRANSACTION_TYPES,
  "Photo and video equipment (> $200)": PHOTO_AND_VIDEO_EQUIPMENT_TRANSACTION_TYPES,
  "Tools and equipment (> $200)": TOOLS_AND_EQUIPMENT_TRANSACTION_TYPES,
  "Vehicle purchase": VEHICLE_PURCHASE_TRANSACTION_TYPES,
  "Business loan": BUSINESS_LOAN_TRANSACTION_TYPES,
  "Mortgage principal (business property)": MORTGAGE_PRINCIPAL_BUSINESS_PROPERTY_TRANSACTION_TYPES,
  "Mortgage principal (home office)": MORTGAGE_PRINCIPAL_HOME_OFFICE_TRANSACTION_TYPES,
  "Vehicle loan": VEHICLE_LOAN_TRANSACTION_TYPES,
  "Loans to others": LOANS_TO_OTHERS_TRANSACTION_TYPES,
  "Uncategorized Asset": UNCATEGORIZED_ASSET_TRANSACTION_TYPES,
  "Undeposited Funds": UNDEPOSITED_FUNDS_TRANSACTION_TYPES,
  "Sales tax to pay": SALES_TAX_TO_PAY_TRANSACTION_TYPES
};

export function getSupportedTransactionTypesForAccount(
  account: Account | undefined
): BankRegisterTransactionTypeOption[] {
  if (!account) {
    return CASH_ON_HAND_TRANSACTION_TYPES;
  }

  const byName = ACCOUNT_NAME_TRANSACTION_TYPES[account.name];
  if (byName) {
    return byName;
  }

  return DEFAULT_CATEGORY_TRANSACTION_TYPES[account.category] ?? CASH_ON_HAND_TRANSACTION_TYPES;
}

export function isInflowTransactionType(transactionTypeId: BankRegisterTransactionTypeId): boolean {
  return (
    transactionTypeId === "INVOICE" ||
    transactionTypeId === "DEPOSIT" ||
    transactionTypeId === "SALES_RECEIPT" ||
    transactionTypeId === "RECEIVE_PAYMENT" ||
    transactionTypeId === "CC_CREDIT" ||
    transactionTypeId === "CREDIT_MEMO" ||
    transactionTypeId === "PAYROLL_REFUND"
  );
}

export function isOutflowTransactionType(transactionTypeId: BankRegisterTransactionTypeId): boolean {
  return (
    transactionTypeId === "CHECK" ||
    transactionTypeId === "BILL" ||
    transactionTypeId === "VENDOR_CREDIT" ||
    transactionTypeId === "BILL_PAYMENT" ||
    transactionTypeId === "CC_BILL_PAYMENT" ||
    transactionTypeId === "REFUND" ||
    transactionTypeId === "EXPENSE" ||
    transactionTypeId === "CC_EXPENSE" ||
    transactionTypeId === "CASH_EXPENSE" ||
    transactionTypeId === "PAYROLL_CHECK" ||
    transactionTypeId === "TAX_PAYMENT" ||
    transactionTypeId === "PAYROLL_ADJUSTMENT" ||
    transactionTypeId === "SALES_TAX_PAYMENT" ||
    transactionTypeId === "SALES_TAX_ADJUSTMENT" ||
    transactionTypeId === "CREDIT_CARD_PAYMENT" ||
    transactionTypeId === "EMPLOYEE_NON_REIMBURSABLE_EXPENSE" ||
    transactionTypeId === "EMPLOYEE_REIMBURSEMENT" ||
    transactionTypeId === "EMPLOYEE_REIMBURSABLE_EXPENSE"
  );
}

/**
 * Categories that have their own register (balance-sheet accounts the user works
 * in). Income/expense accounts (and A/R) are P&L/subledger accounts that only
 * appear as the offset/category in a transaction, never as the working register.
 */
const REGISTER_ACCOUNT_CATEGORIES = new Set<Account["category"]>([
  "BANK",
  "CREDIT_CARD",
  "EQUITY",
  "FIXED_ASSET",
  "LONG_TERM_LIABILITY",
  "OTHER_CURRENT_ASSET",
  "OTHER_CURRENT_LIABILITY"
]);

export function isRegisterAccountCategory(category: Account["category"]): boolean {
  return REGISTER_ACCOUNT_CATEGORIES.has(category);
}

export function isAccountFieldDisabledForTransactionType(
  transactionTypeId: BankRegisterTransactionTypeId
): boolean {
  return (
    transactionTypeId === "SALES_RECEIPT" ||
    transactionTypeId === "RECEIVE_PAYMENT" ||
    transactionTypeId === "BILL_PAYMENT" ||
    transactionTypeId === "REFUND"
  );
}

export function toDomainTransactionType(
  transactionTypeId: BankRegisterTransactionTypeId
): TransactionType {
  switch (transactionTypeId) {
    case "CC_EXPENSE":
    case "CASH_EXPENSE":
    case "EMPLOYEE_NON_REIMBURSABLE_EXPENSE":
    case "EMPLOYEE_REIMBURSEMENT":
    case "EMPLOYEE_REIMBURSABLE_EXPENSE":
      return "EXPENSE";
    case "CC_CREDIT":
    case "BILL":
    case "VENDOR_CREDIT":
    case "CC_BILL_PAYMENT":
    case "TAX_PAYMENT":
    case "SALES_TAX_PAYMENT":
    case "CREDIT_CARD_PAYMENT":
      return "BILL_PAYMENT";
    case "INVOICE":
      return "SALES_RECEIPT";
    case "CREDIT_MEMO":
      return "REFUND";
    case "PAYROLL_CHECK":
      return "CHECK";
    case "PAYROLL_ADJUSTMENT":
    case "SALES_TAX_ADJUSTMENT":
      return "JOURNAL_ENTRY";
    case "PAYROLL_REFUND":
      return "DEPOSIT";
    default:
      return transactionTypeId;
  }
}

export function getAllBankRegisterTransactionTypes(): BankRegisterTransactionTypeOption[] {
  return BANK_REGISTER_TRANSACTION_TYPE_CATALOG;
}
