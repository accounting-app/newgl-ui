import type { SelectFieldOption } from "@/components/bank-register/select-field";
import type { Account, RegisterEntry } from "@/modules/accounting/domain/models";

export const DEFAULT_TOP_HEADER_USER_NAME = "John Doe";

export const ACCOUNT_CATEGORY_LABELS: Record<Account["category"], string> = {
  ACCOUNTS_PAYABLE: "Accounts Payable",
  ACCOUNTS_RECEIVABLE: "Accounts Receivable",
  BANK: "Bank",
  CREDIT_CARD: "Credit Card",
  EQUITY: "Equity",
  EXPENSE: "Expense",
  FIXED_ASSET: "Fixed Asset",
  INCOME: "Income",
  LONG_TERM_LIABILITY: "Long Term Liability",
  OTHER_CURRENT_ASSET: "Other Current Asset",
  OTHER_CURRENT_LIABILITY: "Other Current Liability",
  OTHER_EXPENSE: "Other Expense",
  OTHER_INCOME: "Other Income"
};

export const REGISTER_INFLOW_ROW_TYPES = new Set<RegisterEntry["transactionType"]>([
  "DEPOSIT",
  "SALES_RECEIPT",
  "RECEIVE_PAYMENT"
]);

export const REGISTER_OUTFLOW_ROW_TYPES = new Set<RegisterEntry["transactionType"]>([
  "CHECK",
  "BILL_PAYMENT",
  "REFUND",
  "EXPENSE"
]);

export const REGISTER_ROWS_PER_PAGE_OPTIONS = [4, 40, 60, 80, 100, 125, 150] as const;

export const REGISTER_DATE_FILTER_OPTIONS: SelectFieldOption[] = [
  { value: "ALL_DATES", label: "All dates" },
  { value: "CUSTOM", label: "Custom" },
  { value: "TODAY", label: "Today" },
  { value: "YESTERDAY", label: "Yesterday" },
  { value: "THIS_WEEK", label: "This week" },
  { value: "THIS_MONTH", label: "This month" },
  { value: "THIS_QUARTER", label: "This quarter" },
  { value: "THIS_YEAR", label: "This year" },
  { value: "LAST_WEEK", label: "Last week" },
  { value: "LAST_MONTH", label: "Last month" },
  { value: "LAST_QUARTER", label: "Last quarter" },
  { value: "LAST_YEAR", label: "Last year" }
];

export const REGISTER_RECONCILE_FILTER_OPTIONS: SelectFieldOption[] = [
  { value: "ALL", label: "All" },
  { value: "RECONCILED", label: "Reconciled" },
  { value: "CLEAR", label: "Clear" },
  { value: "NO_STATUS", label: "No status" },
  { value: "NO_RECONCILED", label: "No reconciled" }
];

export const REGISTER_FILTER_INITIAL_STATE = {
  find: "",
  reconcileStatus: "ALL",
  transactionType: "ALL",
  payee: "ALL",
  datePreset: "ALL_DATES",
  from: "",
  to: ""
};

export const REPORT_USER_NAME = DEFAULT_TOP_HEADER_USER_NAME;
export const REPORT_DEFAULT_PERIOD = "this_year_to_date" as const;
export const REPORT_DEFAULT_DISPLAY_COLUMNS_BY = "customer" as const;
export const REPORT_DEFAULT_COMPARE_TO = "none" as const;

export const REPORT_PERIOD_OPTIONS: SelectFieldOption[] = [
  { value: "this_year_to_date", label: "This year to date" },
  { value: "all_dates", label: "All dates" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "this_quarter", label: "This quarter" },
  { value: "this_year", label: "This year" },
  { value: "last_week", label: "Last week" },
  { value: "last_month", label: "Last month" },
  { value: "last_quarter", label: "Last quarter" },
  { value: "last_year", label: "Last year" },
  { value: "custom", label: "Custom" }
];

export const REPORT_DISPLAY_COLUMNS_OPTIONS: SelectFieldOption[] = [
  { value: "customer", label: "Customer" },
  { value: "employee", label: "Employee" },
  { value: "product_service", label: "Product/Service" },
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
  { value: "quarter", label: "Quarter" },
  { value: "years", label: "Years" },
  { value: "vendor", label: "Vendor" }
];

export const REPORT_COMPARE_TO_OPTIONS: SelectFieldOption[] = [
  { value: "none", label: "Select Period" },
  { value: "previous_year", label: "Previous Year", rightLabel: "Time Periods" },
  { value: "previous_period", label: "Previous Period", rightLabel: "Time Periods" },
  { value: "year_to_date", label: "Year-to-date", rightLabel: "Time Periods" },
  { value: "previous_year_to_date", label: "Previous year-to-date", rightLabel: "Time Periods" },
  { value: "custom_period", label: "Custom period (From, To)", rightLabel: "Time Periods" },
  { value: "percent_row", label: "% of Row", rightLabel: "Calculations" },
  { value: "percent_column", label: "% of Column", rightLabel: "Calculations" },
  { value: "percent_expense", label: "% of Expense", rightLabel: "Calculations" },
  { value: "percent_income", label: "% of Income", rightLabel: "Calculations" }
];

export const PAYEE_MODAL_INITIAL_VENDOR_FORM = {
  companyName: "",
  vendorDisplayName: "",
  title: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  email: "",
  phoneNumber: "",
  cc: "",
  bcc: "",
  mobileNumber: "",
  fax: "",
  other: "",
  website: "",
  nameOnChecks: "",
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  notes: "",
  attachments: "",
  achBankAccount: "",
  achRouting: "",
  salesTaxId: "",
  terms: "Due on receipt",
  accountNo: "",
  defaultExpenseCategory: "Expense Option 1",
  openingBalance: "",
  openingBalanceAsOf: ""
};

export const PAYEE_MODAL_INITIAL_CUSTOMER_FORM = {
  title: "",
  firstName: "",
  middleName: "",
  lastName: "",
  suffix: "",
  companyName: "",
  displayName: "",
  email: "",
  phoneNumber: "",
  cc: "",
  bcc: "",
  mobileNumber: "",
  fax: "",
  other: "",
  website: "",
  nameOnChecks: "",
  isSubCustomer: false,
  street1: "",
  street2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  shippingSameAsBilling: true,
  notes: "",
  attachments: "",
  primaryPaymentMethod: "ACH",
  terms: "Due on receipt",
  salesFormDeliveryOptions: "",
  invoiceLanguage: "English",
  exemptionDetails: "",
  openingBalance: "",
  openingBalanceAsOf: ""
};

export const PAYEE_MODAL_INITIAL_EMPLOYEE_FORM = {
  firstName: "",
  middleInitial: "",
  lastName: "",
  email: "",
  hireDate: ""
};
