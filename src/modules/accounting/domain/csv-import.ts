export type CategorySource = "rule" | "ai" | "manual" | null;

export type ParsedCsvRow = {
  clientRowId: string;
  rawDate: string;
  rawPayee: string;
  rawDescription: string;
  rawAmount: string;
  transactionDate: string | null;
  payee: string;
  memo: string;
  amount: number | null;
  categoryAccountId: string | null;
  categoryConfidence: number | null;
  categorySource: CategorySource;
  parseErrors: string[];
};

export type ReviewRow = ParsedCsvRow;

export type WizardStep = "UPLOAD" | "ACCOUNT" | "MAPPING" | "VERIFY" | "RESULT";

export type AmountColumnsMode = "SINGLE" | "DEBIT_CREDIT";

export type DateFormatOption = "yyyy-MM-dd" | "MM/dd/yyyy" | "dd/MM/yyyy" | "MM-dd-yyyy" | "dd-MM-yyyy";

export const DATE_FORMAT_OPTIONS: DateFormatOption[] = [
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "dd/MM/yyyy",
  "MM-dd-yyyy",
  "dd-MM-yyyy"
];

export type FormatOptions = {
  hasHeaderRow: boolean;
  amountColumnsMode: AmountColumnsMode;
  dateFormat: DateFormatOption;
};

export const DEFAULT_FORMAT_OPTIONS: FormatOptions = {
  hasHeaderRow: true,
  amountColumnsMode: "SINGLE",
  dateFormat: "yyyy-MM-dd"
};

// Column index refers to position in a raw tokenized row (0-based). null = unmapped.
export type ColumnMapping = {
  dateColumn: number | null;
  descriptionColumn: number | null;
  amountColumn: number | null;
  debitColumn: number | null;
  creditColumn: number | null;
  payeeColumn: number | null;
  referenceColumn: number | null;
};

export const EMPTY_COLUMN_MAPPING: ColumnMapping = {
  dateColumn: null,
  descriptionColumn: null,
  amountColumn: null,
  debitColumn: null,
  creditColumn: null,
  payeeColumn: null,
  referenceColumn: null
};

export type SignConvention = "ORIGINAL" | "REVERSED";
