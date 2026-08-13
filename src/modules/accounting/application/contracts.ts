import type {
  Account,
  AccountHierarchy,
  BankRule,
  CreateAccountInput,
  CreateBankRuleInput,
  CreateExcludedFeedRowInput,
  CreateTransactionInput,
  ExcludedFeedRow,
  ImportTransactionsInput,
  ImportTransactionsResult,
  LedgerPosting,
  ListTransactionsFilter,
  ReconcileStatus,
  RegisterEntry,
  Transaction,
  UpdateAccountInput,
  UpdateBankRuleInput
} from "@/modules/accounting/domain/models";

export interface AccountService {
  createAccount(input: CreateAccountInput): Promise<Account>;
  updateAccount(id: string, input: UpdateAccountInput): Promise<Account>;
  closeAccount(id: string): Promise<void>;
  getAccountById(id: string): Promise<Account>;
  listAccounts(): Promise<Account[]>;
  getAccountHierarchy(): Promise<AccountHierarchy>;
}

export interface TransactionService {
  createTransaction(input: CreateTransactionInput): Promise<Transaction>;
  getTransactionById(id: string): Promise<Transaction>;
  listTransactions(filter?: ListTransactionsFilter): Promise<Transaction[]>;
  postTransaction(id: string): Promise<Transaction>;
  voidTransaction(id: string): Promise<Transaction>;
  reverseTransaction(id: string): Promise<Transaction>;
  createDeposit(input: Omit<CreateTransactionInput, "type">): Promise<Transaction>;
  createTransfer(input: Omit<CreateTransactionInput, "type">): Promise<Transaction>;
  importTransactions(input: ImportTransactionsInput): Promise<ImportTransactionsResult>;
}

export interface LedgerService {
  getPostingsByTransactionId(transactionId: string): Promise<LedgerPosting[]>;
  listPostings(): Promise<LedgerPosting[]>;
}

export interface RegisterService {
  listRegisterEntries(accountId: string): Promise<RegisterEntry[]>;
  getTransactionDetail(transactionId: string): Promise<{
    transaction: Transaction;
    postings: LedgerPosting[];
    registerEntries: RegisterEntry[];
  }>;
  updateRegisterEntry(
    entryId: string,
    input: Pick<RegisterEntry, "date" | "refNumber" | "payee" | "memo"> & {
      payment?: number;
      deposit?: number;
      reconcileStatus?: ReconcileStatus;
      counterpartyAccountId?: string;
    }
  ): Promise<RegisterEntry>;
  setReconcileStatus(entryId: string, status: ReconcileStatus): Promise<RegisterEntry>;
  deleteRegisterEntry(entryId: string): Promise<RegisterEntry>;
}

export interface BankRuleService {
  listRules(): Promise<BankRule[]>;
  createRule(input: CreateBankRuleInput): Promise<BankRule>;
  updateRule(id: string, input: UpdateBankRuleInput): Promise<BankRule>;
  deleteRule(id: string): Promise<void>;
}

export interface ExcludedFeedRowService {
  listExcludedRows(mainAccountId?: string): Promise<ExcludedFeedRow[]>;
  createExcludedRow(input: CreateExcludedFeedRowInput): Promise<ExcludedFeedRow>;
  deleteExcludedRow(id: string): Promise<void>;
}

export type ServiceContainer = {
  accountService: AccountService;
  transactionService: TransactionService;
  ledgerService: LedgerService;
  registerService: RegisterService;
  bankRuleService: BankRuleService;
  excludedFeedRowService: ExcludedFeedRowService;
};
