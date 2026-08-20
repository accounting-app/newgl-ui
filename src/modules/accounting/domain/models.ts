import { z } from "zod";

export const accountCategorySchema = z.enum([
  "ACCOUNTS_PAYABLE",
  "ACCOUNTS_RECEIVABLE",
  "BANK",
  "CREDIT_CARD",
  "EQUITY",
  "EXPENSE",
  "FIXED_ASSET",
  "INCOME",
  "LONG_TERM_LIABILITY",
  "OTHER_CURRENT_ASSET",
  "OTHER_CURRENT_LIABILITY",
  "OTHER_EXPENSE",
  "OTHER_INCOME"
]);

export const accountStatusSchema = z.enum(["ACTIVE", "ARCHIVED", "CLOSED"]);

export const accountSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  category: accountCategorySchema,
  subtype: z.string().optional(),
  currency: z.string().default("USD"),
  openingBalance: z.number().min(0).optional(),
  currentBalance: z.number().default(0),
  allowManualEntries: z.boolean().default(true),
  status: accountStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  archivedAt: z.string().datetime().optional()
});

export const chartAccountTypeSchema = z.enum([
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE"
]);

export const normalBalanceSchema = z.enum(["DEBIT", "CREDIT"]);

export const chartOfAccountSchema = z.object({
  id: z.string().uuid(),
  accountNumber: z.string(),
  name: z.string(),
  description: z.string().optional(),
  accountType: chartAccountTypeSchema,
  accountSubtype: z.string().optional(),
  normalBalance: normalBalanceSchema,
  reportingGroup: z.string().optional(),
  parentAccountId: z.string().uuid().nullable().optional(),
  hierarchyLevel: z.number().int().min(0).optional(),
  isParent: z.boolean().default(false),
  isSystemAccount: z.boolean().default(false),
  allowsManualPostings: z.boolean().default(true),
  currency: z.string().default("USD"),
  openingBalance: z.number().default(0),
  currentBalance: z.number().default(0),
  availableBalance: z.number().default(0),
  status: accountStatusSchema,
  tags: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional()
});

export const postingEntryTypeSchema = z.enum(["DEBIT", "CREDIT"]);

export const transactionTypeSchema = z.enum([
  "CHECK",
  "DEPOSIT",
  "SALES_RECEIPT",
  "RECEIVE_PAYMENT",
  "BILL_PAYMENT",
  "REFUND",
  "EXPENSE",
  "TRANSFER",
  "JOURNAL_ENTRY"
]);

export const transactionStatusSchema = z.enum([
  "DRAFT",
  "POSTED",
  "VOIDED",
  "DELETED"
]);

export const reconcileStatusSchema = z.enum(["", "C", "R"]);

export const auditLogEntrySchema = z.object({
  action: z.string(),
  userId: z.string(),
  timestamp: z.string(),
  changes: z.record(z.string(), z.unknown()).nullable().optional()
});

export const transactionPostingInputSchema = z.object({
  accountId: z.string().uuid(),
  type: postingEntryTypeSchema,
  amount: z.number().min(0.01)
});

export const transactionSchema = z.object({
  id: z.string().uuid(),
  type: transactionTypeSchema,
  status: transactionStatusSchema,
  transactionDate: z.string(),
  /** Optional due date for A/R (invoice) or A/P (bill) postings -- feeds the aging report. Falls back to transactionDate when unset, matching PlainGL. */
  dueDate: z.string().optional(),
  referenceNumber: z.string().optional(),
  memo: z.string().optional(),
  payee: z.string().optional(),
  accountLabel: z.string().optional(),
  sourceAccountId: z.string().uuid().optional(),
  reconcileStatus: reconcileStatusSchema.optional(),
  periodId: z.string().optional(),
  postings: z.array(transactionPostingInputSchema).min(2),
  auditLog: z.array(auditLogEntrySchema).optional(),
  createdBy: z.string().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  postedAt: z.string().datetime().optional(),
  voidedAt: z.string().datetime().optional(),
  reversedAt: z.string().datetime().optional(),
  referenceOriginalTransactionId: z.string().uuid().optional()
});

export const ledgerPostingStatusSchema = z.enum([
  "PENDING",
  "POSTED",
  "VOIDED",
  "REVERSED"
]);

export const ledgerPostingSchema = z.object({
  id: z.string().uuid(),
  transactionId: z.string().uuid(),
  registerEntryId: z.string().uuid().optional(),
  accountId: z.string().uuid(),
  accountCode: z.string().optional(),
  accountName: z.string().optional(),
  entryType: postingEntryTypeSchema,
  amount: z.number().min(0.01),
  currency: z.string().default("USD"),
  exchangeRate: z.number().default(1),
  postingDate: z.string(),
  fiscalPeriod: z.string(),
  memo: z.string().optional(),
  referenceNumber: z.string().optional(),
  sourceDocumentType: transactionTypeSchema.optional(),
  sourceDocumentId: z.string().uuid().optional(),
  reconciliationStatus: z.enum(["UNRECONCILED", "RECONCILED"]).default("UNRECONCILED"),
  status: ledgerPostingStatusSchema,
  createdBy: z.string().optional(),
  createdAt: z.string().datetime(),
  postedAt: z.string().datetime().optional(),
  voidedAt: z.string().datetime().optional(),
  reversedAt: z.string().datetime().optional()
});

export const registerEntrySchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  transactionId: z.string().uuid(),
  transactionType: transactionTypeSchema,
  refNumber: z.string().optional(),
  payee: z.string().optional(),
  accountLabel: z.string().optional(),
  memo: z.string().optional(),
  payment: z.number().min(0).optional(),
  deposit: z.number().min(0).optional(),
  reconcileStatus: reconcileStatusSchema.default(""),
  runningBalance: z.number(),
  postedAt: z.string().datetime().optional(),
  date: z.string(),
  status: transactionStatusSchema,
  createdBy: z.string().optional(),
  createdAt: z.string().datetime()
});

export type Account = z.infer<typeof accountSchema>;
export type ChartOfAccount = z.infer<typeof chartOfAccountSchema>;
export type PostingEntryType = z.infer<typeof postingEntryTypeSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type ReconcileStatus = z.infer<typeof reconcileStatusSchema>;
export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;
export type TransactionPostingInput = z.infer<typeof transactionPostingInputSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type LedgerPosting = z.infer<typeof ledgerPostingSchema>;
export type RegisterEntry = z.infer<typeof registerEntrySchema>;

export type AccountHierarchy = Array<
  ChartOfAccount & {
    children: ChartOfAccount[];
  }
>;

export type CreateAccountInput = Pick<
  Account,
  "code" | "name" | "category" | "currency" | "openingBalance"
> & { subtype?: string };

export type UpdateAccountInput = Partial<
  Pick<Account, "name" | "status" | "subtype" | "allowManualEntries">
>;

export type CreateTransactionInput = Pick<
  Transaction,
  | "type"
  | "transactionDate"
  | "dueDate"
  | "referenceNumber"
  | "memo"
  | "payee"
  | "accountLabel"
  | "sourceAccountId"
  | "reconcileStatus"
  | "postings"
>;

export type ImportTransactionRowInput = {
  clientRowId: string;
  transactionDate: string;
  payee?: string;
  memo?: string;
  amount: number;
  categoryAccountId: string;
  referenceNumber?: string;
};

export type ImportTransactionsInput = {
  mainAccountId: string;
  rows: ImportTransactionRowInput[];
};

export type ImportTransactionRowResult = {
  clientRowId: string;
  status: "CREATED" | "FAILED";
  transactionId?: string;
  error?: string;
};

export type ImportTransactionsResult = {
  succeeded: number;
  failed: number;
  results: ImportTransactionRowResult[];
};

export type ListTransactionsFilter = {
  status?: TransactionStatus;
  sourceAccountId?: string;
};

// Deterministic bank rules (PLAINGL_FEATURES_TO_IMPLEMENT.md #7) -- mirrors
// newgl-api's src/domain/models.ts bank-rule schemas.
export const bankRuleFieldSchema = z.enum(["payee", "memo", "amount"]);
export const bankRuleTextOperatorSchema = z.enum(["contains", "not_contains", "equals", "starts_with", "regex"]);
export const bankRuleAmountOperatorSchema = z.enum(["greater_than", "less_than", "between"]);
export const bankRuleOperatorSchema = z.union([bankRuleTextOperatorSchema, bankRuleAmountOperatorSchema]);

export const bankRuleConditionSchema = z.object({
  field: bankRuleFieldSchema,
  operator: bankRuleOperatorSchema,
  value: z.string().min(1),
  valueTo: z.string().min(1).optional()
});

export const bankRuleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  targetAccountId: z.string().min(1),
  conditions: z.array(bankRuleConditionSchema).min(1),
  enabled: z.boolean(),
  priority: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type BankRuleField = z.infer<typeof bankRuleFieldSchema>;
export type BankRuleOperator = z.infer<typeof bankRuleOperatorSchema>;
export type BankRuleCondition = z.infer<typeof bankRuleConditionSchema>;
export type BankRule = z.infer<typeof bankRuleSchema>;

export type CreateBankRuleInput = Pick<BankRule, "name" | "targetAccountId" | "conditions"> &
  Partial<Pick<BankRule, "enabled" | "priority">>;

export type UpdateBankRuleInput = Partial<
  Pick<BankRule, "name" | "targetAccountId" | "conditions" | "enabled" | "priority">
>;

// Bank feed exclude memory (PLAINGL_FEATURES_TO_IMPLEMENT.md #11) -- mirrors
// newgl-api's src/domain/models.ts excluded-feed-row schemas.
export const excludedFeedRowSchema = z.object({
  id: z.string().uuid(),
  mainAccountId: z.string().min(1),
  payee: z.string().min(1),
  amount: z.number(),
  createdAt: z.string()
});

export type ExcludedFeedRow = z.infer<typeof excludedFeedRowSchema>;
export type CreateExcludedFeedRowInput = Pick<ExcludedFeedRow, "mainAccountId" | "payee" | "amount">;
