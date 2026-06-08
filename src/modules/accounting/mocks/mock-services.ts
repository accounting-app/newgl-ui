import type {
  Account,
  AccountHierarchy,
  ChartOfAccount,
  CreateAccountInput,
  CreateTransactionInput,
  LedgerPosting,
  PostingEntryType,
  ReconcileStatus,
  RegisterEntry,
  Transaction,
  UpdateAccountInput
} from "@/modules/accounting/domain/models";
import type {
  AccountService,
  LedgerService,
  RegisterService,
  TransactionService
} from "@/modules/accounting/application/contracts";
import type { LedgerDomainEvent } from "@/modules/accounting/domain/events";
import {
  DEBIT_NORMAL_CATEGORIES,
  assertEntryDeletable,
  assertEntryEditable,
  calculateTrialBalance,
  generateBalanceSheet,
  validateDoubleEntry,
  validateTransactionAmounts
} from "@/modules/accounting/domain/accounting-reports";
import { getPeriodIdForDate, validateTransactionPeriod } from "@/modules/accounting/domain/periods";
import { ledgerEventBus } from "@/shared/event-bus";
import { createId } from "@/shared/utils/id";
import { nowIso, todayIsoDate } from "@/shared/utils/date";

type Store = {
  accounts: Account[];
  chartAccounts: ChartOfAccount[];
  transactions: Transaction[];
  ledgerPostings: LedgerPosting[];
  registerEntries: RegisterEntry[];
};

function auditEntry(action: string, changes: Record<string, unknown> | null = null) {
  return { action, userId: "user", timestamp: nowIso(), changes };
}

function emit(event: LedgerDomainEvent): void {
  ledgerEventBus.emit(event);
}

const ACCOUNT_TYPE_BY_CATEGORY: Record<Account["category"], ChartOfAccount["accountType"]> = {
  ACCOUNTS_RECEIVABLE: "ASSET",
  BANK: "ASSET",
  CREDIT_CARD: "LIABILITY",
  EQUITY: "EQUITY",
  EXPENSE: "EXPENSE",
  FIXED_ASSET: "ASSET",
  INCOME: "REVENUE",
  LONG_TERM_LIABILITY: "LIABILITY",
  OTHER_CURRENT_ASSET: "ASSET",
  OTHER_CURRENT_LIABILITY: "LIABILITY",
  OTHER_EXPENSE: "EXPENSE",
  OTHER_INCOME: "REVENUE"
};

const NORMAL_BALANCE_BY_TYPE: Record<ChartOfAccount["accountType"], ChartOfAccount["normalBalance"]> = {
  ASSET: "DEBIT",
  LIABILITY: "CREDIT",
  EQUITY: "CREDIT",
  REVENUE: "CREDIT",
  EXPENSE: "DEBIT"
};

const SEED_ACCOUNTS: Array<{ name: string; category: Account["category"] }> = [
  { name: "Accounts Receivable (A/R)", category: "ACCOUNTS_RECEIVABLE" },
  { name: "Cash on hand", category: "BANK" },
  { name: "Credit Card Payable", category: "CREDIT_CARD" },
  { name: "Charitable donations", category: "EQUITY" },
  { name: "Equity clearing (Credit Card Payment)", category: "EQUITY" },
  { name: "Equity clearing (Transfer)", category: "EQUITY" },
  { name: "Federal estimated tax", category: "EQUITY" },
  { name: "Federal tax", category: "EQUITY" },
  { name: "Health Savings Account", category: "EQUITY" },
  { name: "Health insurance premium", category: "EQUITY" },
  { name: "Mortgage", category: "EQUITY" },
  { name: "Owners investment", category: "EQUITY" },
  { name: "Owners pay", category: "EQUITY" },
  { name: "Personal expense", category: "EQUITY" },
  { name: "Personal income", category: "EQUITY" },
  { name: "Property tax", category: "EQUITY" },
  { name: "Retained Earnings", category: "EQUITY" },
  { name: "Retirement contributions", category: "EQUITY" },
  { name: "State estimated tax", category: "EQUITY" },
  { name: "State tax", category: "EQUITY" },
  { name: "Visits, copays, and prescriptions", category: "EQUITY" },
  { name: "Advertising and Marketing", category: "EXPENSE" },
  { name: "Airfare", category: "EXPENSE" },
  { name: "Apps and software", category: "EXPENSE" },
  { name: "Business licenses", category: "EXPENSE" },
  { name: "Business loan (interest)", category: "EXPENSE" },
  { name: "Commissions and fees", category: "EXPENSE" },
  { name: "Communications", category: "EXPENSE" },
  { name: "Continued education", category: "EXPENSE" },
  { name: "Contract labor", category: "EXPENSE" },
  { name: "Credit card interest", category: "EXPENSE" },
  { name: "Entertainment", category: "EXPENSE" },
  { name: "Equipment rent and lease", category: "EXPENSE" },
  { name: "Legal and professional services", category: "EXPENSE" },
  { name: "Liability insurance", category: "EXPENSE" },
  { name: "Local taxes", category: "EXPENSE" },
  { name: "Lodging", category: "EXPENSE" },
  { name: "Materials and supplies", category: "EXPENSE" },
  { name: "Meals with clients", category: "EXPENSE" },
  { name: "Miscellaneous expenses", category: "EXPENSE" },
  { name: "Mortgage interest (business property)", category: "EXPENSE" },
  { name: "Office Expenses", category: "EXPENSE" },
  { name: "Other business expenses", category: "EXPENSE" },
  { name: "Other interest", category: "EXPENSE" },
  { name: "Other travel expenses", category: "EXPENSE" },
  { name: "Property rents and leases", category: "EXPENSE" },
  { name: "Property tax (business property)", category: "EXPENSE" },
  { name: "Repairs and maintenance", category: "EXPENSE" },
  { name: "Shipping fees", category: "EXPENSE" },
  { name: "Subscriptions and memberships", category: "EXPENSE" },
  { name: "Transaction fees", category: "EXPENSE" },
  { name: "Travel meals", category: "EXPENSE" },
  { name: "Uncategorized Expense", category: "EXPENSE" },
  { name: "Uniforms", category: "EXPENSE" },
  { name: "Utilities (business property)", category: "EXPENSE" },
  { name: "Vehicle rental/public transportation", category: "EXPENSE" },
  { name: "Apps and software (> $200)", category: "FIXED_ASSET" },
  { name: "Building purchase", category: "FIXED_ASSET" },
  { name: "Computer (> $200)", category: "FIXED_ASSET" },
  { name: "Copier (> $200)", category: "FIXED_ASSET" },
  { name: "Furniture (> $200)", category: "FIXED_ASSET" },
  { name: "Land purchase", category: "FIXED_ASSET" },
  { name: "Machinery and equipment", category: "FIXED_ASSET" },
  { name: "Phone (> $200)", category: "FIXED_ASSET" },
  { name: "Photo and video equipment (> $200)", category: "FIXED_ASSET" },
  { name: "Tools and equipment (> $200)", category: "FIXED_ASSET" },
  { name: "Vehicle purchase", category: "FIXED_ASSET" },
  { name: "Billable Expense Income", category: "INCOME" },
  { name: "Sales", category: "INCOME" },
  { name: "Services", category: "INCOME" },
  { name: "Services ( 6 )", category: "INCOME" },
  { name: "Unapplied Cash Payment Income", category: "INCOME" },
  { name: "Uncategorized Income", category: "INCOME" },
  { name: "Business loan", category: "LONG_TERM_LIABILITY" },
  { name: "Mortgage principal (business property)", category: "LONG_TERM_LIABILITY" },
  { name: "Mortgage principal (home office)", category: "LONG_TERM_LIABILITY" },
  { name: "Vehicle loan", category: "LONG_TERM_LIABILITY" },
  { name: "Loans to others", category: "OTHER_CURRENT_ASSET" },
  { name: "Uncategorized Asset", category: "OTHER_CURRENT_ASSET" },
  { name: "Undeposited Funds", category: "OTHER_CURRENT_ASSET" },
  { name: "Sales tax to pay", category: "OTHER_CURRENT_LIABILITY" },
  { name: "Gas and fuel", category: "OTHER_EXPENSE" },
  { name: "Homeowner/rental insurance (home office)", category: "OTHER_EXPENSE" },
  { name: "Mortgage interest (home office)", category: "OTHER_EXPENSE" },
  { name: "Other home office expenses", category: "OTHER_EXPENSE" },
  { name: "Other vehicle expenses", category: "OTHER_EXPENSE" },
  { name: "Parking and tolls", category: "OTHER_EXPENSE" },
  { name: "Property tax (home office)", category: "OTHER_EXPENSE" },
  { name: "Reconciliation Discrepancies", category: "OTHER_EXPENSE" },
  { name: "Rent and lease (home office)", category: "OTHER_EXPENSE" },
  { name: "Repairs and maintenance (home office)", category: "OTHER_EXPENSE" },
  { name: "Utilities (home office)", category: "OTHER_EXPENSE" },
  { name: "Vehicle insurance", category: "OTHER_EXPENSE" },
  { name: "Vehicle lease", category: "OTHER_EXPENSE" },
  { name: "Vehicle loan interest", category: "OTHER_EXPENSE" },
  { name: "Vehicle registration", category: "OTHER_EXPENSE" },
  { name: "Vehicle repairs and maintenance", category: "OTHER_EXPENSE" },
  { name: "Other income", category: "OTHER_INCOME" }
];

type SeedFlow = "INFLOW" | "OUTFLOW";

type SeedRegisterTransactionSpec = {
  type: Transaction["type"];
  date: string;
  ref: string;
  memo: string;
  payee: string;
  sourceAccountName: string;
  counterpartyAccountName: string;
  amount: number;
  flow: SeedFlow;
  reconcileStatus?: ReconcileStatus;
};

const SEED_REGISTER_TRANSACTIONS: SeedRegisterTransactionSpec[] = [
  {
    type: "DEPOSIT",
    date: "2026-05-01",
    ref: "TX-1001",
    memo: "Initial owner contribution",
    payee: "Owner",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Owners investment",
    amount: 1200,
    flow: "INFLOW",
    reconcileStatus: "C"
  },
  {
    type: "CHECK",
    date: "2026-05-03",
    ref: "TX-1002",
    memo: "Office supplies",
    payee: "Office Depot",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Personal expense",
    amount: 145.5,
    flow: "OUTFLOW"
  },
  {
    type: "EXPENSE",
    date: "2026-05-05",
    ref: "TX-1003",
    memo: "Software subscription",
    payee: "SaaS Vendor",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Apps and software (> $200)",
    amount: 89,
    flow: "OUTFLOW"
  },
  {
    type: "RECEIVE_PAYMENT",
    date: "2026-05-06",
    ref: "TX-1004",
    memo: "Client payment invoice #44",
    payee: "Client A",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Personal income",
    amount: 680,
    flow: "INFLOW",
    reconcileStatus: "R"
  },
  {
    type: "TRANSFER",
    date: "2026-05-08",
    ref: "TX-1005",
    memo: "Move funds to card account",
    payee: "Internal transfer",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Credit Card Payable",
    amount: 250,
    flow: "OUTFLOW"
  },
  {
    type: "BILL_PAYMENT",
    date: "2026-05-10",
    ref: "TX-1006",
    memo: "Utility bill payment",
    payee: "City Utilities",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Personal expense",
    amount: 110.75,
    flow: "OUTFLOW"
  },
  {
    type: "DEPOSIT",
    date: "2026-05-11",
    ref: "TX-1007",
    memo: "Misc sales deposit",
    payee: "POS batch",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Personal income",
    amount: 420.35,
    flow: "INFLOW"
  },
  {
    type: "CHECK",
    date: "2026-05-13",
    ref: "TX-1008",
    memo: "Rent payment",
    payee: "Landlord",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Mortgage",
    amount: 320,
    flow: "OUTFLOW",
    reconcileStatus: "C"
  },
  {
    type: "EXPENSE",
    date: "2026-05-16",
    ref: "TX-1009",
    memo: "Phone reimbursement",
    payee: "Carrier",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Phone (> $200)",
    amount: 60,
    flow: "OUTFLOW"
  },
  {
    type: "TRANSFER",
    date: "2026-05-18",
    ref: "TX-1010",
    memo: "Transfer back from card",
    payee: "Internal transfer",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Credit Card Payable",
    amount: 180,
    flow: "INFLOW"
  },
  {
    type: "DEPOSIT",
    date: "2026-05-21",
    ref: "TX-1011",
    memo: "Owner top-up",
    payee: "Owner",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Owners investment",
    amount: 500,
    flow: "INFLOW"
  },
  {
    type: "CHECK",
    date: "2026-05-24",
    ref: "TX-1012",
    memo: "Tax prepayment",
    payee: "IRS",
    sourceAccountName: "Cash on hand",
    counterpartyAccountName: "Federal estimated tax",
    amount: 210,
    flow: "OUTFLOW"
  }
];

function buildMockData(): Store {
  const createdAt = nowIso();
  const accounts: Account[] = SEED_ACCOUNTS.map((seed, index) => ({
    id: createId(),
    code: (1000 + index * 10).toString(),
    name: seed.name,
    category: seed.category,
    currency: "USD",
    openingBalance: 0,
    currentBalance: 0,
    allowManualEntries: true,
    status: "ACTIVE",
    createdAt
  }));

  const chartAccounts: ChartOfAccount[] = accounts.map((account) => {
    const accountType = ACCOUNT_TYPE_BY_CATEGORY[account.category];
    return {
      id: account.id,
      accountNumber: account.code,
      name: account.name,
      accountType,
      normalBalance: NORMAL_BALANCE_BY_TYPE[accountType],
      isParent: false,
      isSystemAccount: false,
      allowsManualPostings: true,
      currency: account.currency,
      openingBalance: 0,
      currentBalance: 0,
      availableBalance: 0,
      status: "ACTIVE",
      createdAt
    };
  });

  return {
    accounts,
    chartAccounts,
    transactions: [],
    ledgerPostings: [],
    registerEntries: []
  };
}

function requireAccount(store: Store, accountId: string): Account {
  const account = store.accounts.find((item) => item.id === accountId);
  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }
  return account;
}

function ensureAccountsActive(store: Store, transaction: Transaction): void {
  transaction.postings.forEach((posting) => {
    const account = requireAccount(store, posting.accountId);
    if (account.status !== "ACTIVE") {
      throw new Error("Closed or archived accounts cannot receive transactions.");
    }
  });
}

function computeBalanceImpact(category: Account["category"], side: PostingEntryType, amount: number): number {
  if (DEBIT_NORMAL_CATEGORIES.has(category)) {
    return side === "DEBIT" ? amount : -amount;
  }
  return side === "CREDIT" ? amount : -amount;
}

function updateAccountBalances(store: Store, accountIds: string[]): void {
  const uniqueIds = [...new Set(accountIds)];
  uniqueIds.forEach((accountId) => {
    const account = requireAccount(store, accountId);
    const posted = store.ledgerPostings.filter(
      (posting) => posting.accountId === accountId && posting.status === "POSTED"
    );
    const base = account.openingBalance ?? 0;
    const impact = posted.reduce(
      (sum, posting) => sum + computeBalanceImpact(account.category, posting.entryType, posting.amount),
      0
    );
    account.currentBalance = base + impact;
    account.updatedAt = nowIso();

    const chart = store.chartAccounts.find((item) => item.id === account.id);
    if (chart) {
      chart.currentBalance = account.currentBalance;
      chart.availableBalance = account.currentBalance;
      chart.updatedAt = account.updatedAt;
    }

    emit({
      eventType: "AccountBalanceUpdated",
      accountId,
      currentBalance: account.currentBalance,
      updatedAt: account.updatedAt
    });
  });
}

function recalculateRunningBalances(store: Store, accountId: string): void {
  const account = requireAccount(store, accountId);
  const entries = store.registerEntries
    .filter((entry) => entry.accountId === accountId)
    .sort((a, b) =>
      `${a.date}-${a.createdAt}`.localeCompare(`${b.date}-${b.createdAt}`)
    );

  let running = account.openingBalance ?? 0;
  entries.forEach((entry) => {
    running = running + (entry.deposit ?? 0) - (entry.payment ?? 0);
    entry.runningBalance = running;
  });
}

function createRegisterEntries(store: Store, transaction: Transaction): void {
  const perAccount = new Map<string, { payment: number; deposit: number }>();
  transaction.postings.forEach((posting) => {
    const current = perAccount.get(posting.accountId) ?? { payment: 0, deposit: 0 };
    if (posting.type === "DEBIT") {
      current.deposit += posting.amount;
    } else {
      current.payment += posting.amount;
    }
    perAccount.set(posting.accountId, current);
  });

  perAccount.forEach((value, accountId) => {
    const counterpartyAccountNames = [
      ...new Set(
        transaction.postings
          .filter((posting) => posting.accountId !== accountId)
          .map((posting) => requireAccount(store, posting.accountId).name)
      )
    ];
    const isSourceAccountEntry = transaction.sourceAccountId === accountId;
    const displayAccountLabel = isSourceAccountEntry
      ? transaction.accountLabel ?? counterpartyAccountNames[0]
      : counterpartyAccountNames[0];
    const entryReconcileStatus =
      isSourceAccountEntry && transaction.reconcileStatus ? transaction.reconcileStatus : "";

    const entry: RegisterEntry = {
      id: createId(),
      accountId,
      transactionId: transaction.id,
      transactionType: transaction.type,
      refNumber: transaction.referenceNumber,
      payee: transaction.payee,
      accountLabel: displayAccountLabel,
      memo: transaction.memo,
      payment: value.payment > 0 ? value.payment : undefined,
      deposit: value.deposit > 0 ? value.deposit : undefined,
      reconcileStatus: entryReconcileStatus,
      runningBalance: 0,
      postedAt: nowIso(),
      date: transaction.transactionDate,
      status: transaction.status,
      createdBy: transaction.createdBy ?? "system",
      createdAt: nowIso()
    };
    store.registerEntries.push(entry);
    recalculateRunningBalances(store, accountId);
  });
}

function postingFiscalPeriod(date: string): string {
  return date.slice(0, 7);
}

export class MockAccountService implements AccountService {
  constructor(private readonly store: Store) {}

  async createAccount(input: CreateAccountInput): Promise<Account> {
    const exists = this.store.accounts.find((account) => account.code === input.code);
    if (exists) {
      throw new Error("Account code must be unique.");
    }
    const createdAt = nowIso();
    const account: Account = {
      id: createId(),
      code: input.code,
      name: input.name,
      category: input.category,
      subtype: input.subtype,
      currency: input.currency ?? "USD",
      openingBalance: input.openingBalance ?? 0,
      currentBalance: input.openingBalance ?? 0,
      allowManualEntries: true,
      status: "ACTIVE",
      createdAt
    };
    this.store.accounts.push(account);
    return account;
  }

  async updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
    const account = requireAccount(this.store, id);
    Object.assign(account, input, { updatedAt: nowIso() });
    return account;
  }

  async closeAccount(id: string): Promise<void> {
    const account = requireAccount(this.store, id);
    account.status = "CLOSED";
    account.updatedAt = nowIso();
  }

  async getAccountById(id: string): Promise<Account> {
    return requireAccount(this.store, id);
  }

  async listAccounts(): Promise<Account[]> {
    return [...this.store.accounts];
  }

  async getAccountHierarchy(): Promise<AccountHierarchy> {
    return this.store.chartAccounts.map((account) => ({
      ...account,
      children: this.store.chartAccounts.filter((candidate) => candidate.parentAccountId === account.id)
    }));
  }
}

export class MockLedgerService implements LedgerService {
  constructor(private readonly store: Store) {}

  async getPostingsByTransactionId(transactionId: string): Promise<LedgerPosting[]> {
    return this.store.ledgerPostings.filter((posting) => posting.transactionId === transactionId);
  }

  async listPostings(): Promise<LedgerPosting[]> {
    return [...this.store.ledgerPostings];
  }
}

export class MockTransactionService implements TransactionService {
  constructor(private readonly store: Store) {}

  async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    // Plan §1 & §4: a transaction must be balanced, affect at least two different
    // accounts, and fall in an open period.
    validateDoubleEntry(input.postings);
    if (new Set(input.postings.map((posting) => posting.accountId)).size < 2) {
      throw new Error("A transaction must affect at least two different accounts.");
    }
    validateTransactionPeriod(input.transactionDate);

    const createdAt = nowIso();
    const transaction: Transaction = {
      id: createId(),
      type: input.type,
      status: "DRAFT",
      transactionDate: input.transactionDate,
      referenceNumber: input.referenceNumber,
      memo: input.memo,
      payee: input.payee,
      accountLabel: input.accountLabel,
      sourceAccountId: input.sourceAccountId,
      reconcileStatus: input.reconcileStatus,
      periodId: getPeriodIdForDate(input.transactionDate),
      postings: input.postings,
      auditLog: [auditEntry("created")],
      createdAt,
      updatedAt: createdAt,
      createdBy: "user"
    };
    this.store.transactions.push(transaction);

    emit({
      eventType: "TransactionCreated",
      transactionId: transaction.id,
      transactionType: transaction.type,
      status: "DRAFT",
      createdAt: transaction.createdAt ?? nowIso()
    });

    return transaction;
  }

  async getTransactionById(id: string): Promise<Transaction> {
    const transaction = this.store.transactions.find((item) => item.id === id);
    if (!transaction) {
      throw new Error(`Transaction ${id} not found`);
    }
    return transaction;
  }

  async listTransactions(): Promise<Transaction[]> {
    return [...this.store.transactions];
  }

  async postTransaction(id: string): Promise<Transaction> {
    const transaction = await this.getTransactionById(id);
    if (transaction.status !== "DRAFT") {
      throw new Error("Only DRAFT transactions can be posted.");
    }
    ensureAccountsActive(this.store, transaction);
    validateDoubleEntry(transaction.postings);

    const createdAt = nowIso();
    const postings: LedgerPosting[] = transaction.postings.map((posting) => {
      const account = requireAccount(this.store, posting.accountId);
      return {
        id: createId(),
        transactionId: transaction.id,
        accountId: posting.accountId,
        accountCode: account.code,
        accountName: account.name,
        entryType: posting.type,
        amount: posting.amount,
        currency: account.currency,
        exchangeRate: 1,
        postingDate: transaction.transactionDate,
        fiscalPeriod: postingFiscalPeriod(transaction.transactionDate),
        memo: transaction.memo,
        referenceNumber: transaction.referenceNumber,
        sourceDocumentType: transaction.type,
        sourceDocumentId: transaction.id,
        reconciliationStatus: "UNRECONCILED",
        status: "POSTED",
        createdBy: transaction.createdBy,
        createdAt,
        postedAt: createdAt
      };
    });

    transaction.status = "POSTED";
    transaction.postedAt = createdAt;
    transaction.updatedAt = createdAt;
    transaction.auditLog = [...(transaction.auditLog ?? []), auditEntry("posted")];
    this.store.ledgerPostings.push(...postings);

    createRegisterEntries(this.store, transaction);
    updateAccountBalances(
      this.store,
      postings.map((posting) => posting.accountId)
    );

    emit({
      eventType: "LedgerPostingsCreated",
      transactionId: transaction.id,
      postings,
      createdAt
    });
    emit({ eventType: "TransactionPosted", transactionId: transaction.id, postedAt: createdAt });

    return transaction;
  }

  async voidTransaction(id: string): Promise<Transaction> {
    const original = await this.getTransactionById(id);
    if (original.status === "VOIDED") {
      throw new Error("Transaction is already voided.");
    }

    if (original.status === "DRAFT") {
      original.status = "VOIDED";
      original.voidedAt = nowIso();
      original.updatedAt = original.voidedAt;
      original.auditLog = [...(original.auditLog ?? []), auditEntry("voided")];
      emit({ eventType: "TransactionVoided", transactionId: id, voidedAt: original.voidedAt });
      return original;
    }

    if (original.status !== "POSTED") {
      throw new Error("Only DRAFT or POSTED transactions can be voided.");
    }

    const voidTx = await this.createTransaction({
      type: original.type,
      transactionDate: todayIsoDate(),
      memo: `VOID of ${original.id}`,
      payee: original.payee,
      referenceNumber: original.referenceNumber,
      postings: original.postings.map((posting) => ({
        accountId: posting.accountId,
        type: posting.type === "DEBIT" ? "CREDIT" : "DEBIT",
        amount: posting.amount
      }))
    });
    await this.postTransaction(voidTx.id);
    voidTx.status = "VOIDED";
    voidTx.voidedAt = nowIso();
    voidTx.referenceOriginalTransactionId = original.id;
    original.status = "VOIDED";
    original.voidedAt = voidTx.voidedAt;
    original.updatedAt = voidTx.voidedAt;
    original.auditLog = [...(original.auditLog ?? []), auditEntry("voided")];

    emit({ eventType: "LedgerVoidCreated", transactionId: voidTx.id, createdAt: voidTx.voidedAt });
    emit({ eventType: "TransactionVoided", transactionId: original.id, voidedAt: original.voidedAt });
    return original;
  }

  async reverseTransaction(id: string): Promise<Transaction> {
    const original = await this.getTransactionById(id);
    if (original.status !== "POSTED") {
      throw new Error("Only POSTED transactions can be reversed.");
    }
    if (original.reversedAt) {
      throw new Error("Transaction has already been reversed.");
    }

    const reversal = await this.createTransaction({
      type: original.type,
      transactionDate: todayIsoDate(),
      memo: `REVERSAL of ${original.id}`,
      payee: original.payee,
      referenceNumber: original.referenceNumber,
      postings: original.postings.map((posting) => ({
        accountId: posting.accountId,
        type: posting.type === "DEBIT" ? "CREDIT" : "DEBIT",
        amount: posting.amount
      }))
    });
    await this.postTransaction(reversal.id);
    const reversedAt = nowIso();
    original.reversedAt = reversedAt;
    original.updatedAt = reversedAt;
    original.auditLog = [...(original.auditLog ?? []), auditEntry("reversed")];
    reversal.referenceOriginalTransactionId = original.id;

    emit({
      eventType: "TransactionReversed",
      transactionId: reversal.id,
      reversedAt,
      referenceOriginalTransactionId: original.id
    });
    emit({ eventType: "LedgerReversalCreated", transactionId: reversal.id, createdAt: reversedAt });
    return reversal;
  }

  async createDeposit(input: Omit<CreateTransactionInput, "type">): Promise<Transaction> {
    const transaction = await this.createTransaction({ ...input, type: "DEPOSIT" });
    return this.postTransaction(transaction.id);
  }

  async createTransfer(input: Omit<CreateTransactionInput, "type">): Promise<Transaction> {
    const accounts = new Set(input.postings.map((posting) => posting.accountId));
    if (accounts.size < 2) {
      throw new Error("Transfers require source and destination accounts.");
    }
    const transaction = await this.createTransaction({ ...input, type: "TRANSFER" });
    return this.postTransaction(transaction.id);
  }
}

export class MockRegisterService implements RegisterService {
  constructor(private readonly store: Store) {}

  async listRegisterEntries(accountId: string): Promise<RegisterEntry[]> {
    return this.store.registerEntries
      .filter((entry) => entry.accountId === accountId)
      .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`));
  }

  async getTransactionDetail(transactionId: string): Promise<{
    transaction: Transaction;
    postings: LedgerPosting[];
    registerEntries: RegisterEntry[];
  }> {
    const transaction = this.store.transactions.find((item) => item.id === transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    return {
      transaction,
      postings: this.store.ledgerPostings.filter((posting) => posting.transactionId === transactionId),
      registerEntries: this.store.registerEntries.filter((entry) => entry.transactionId === transactionId)
    };
  }

  async updateRegisterEntry(
    entryId: string,
    input: Pick<RegisterEntry, "date" | "refNumber" | "payee" | "memo"> & {
      payment?: number;
      deposit?: number;
      reconcileStatus?: ReconcileStatus;
      counterpartyAccountId?: string;
    }
  ): Promise<RegisterEntry> {
    const entry = this.store.registerEntries.find((item) => item.id === entryId);
    if (!entry) {
      throw new Error(`Register entry ${entryId} not found`);
    }
    // Plan §2: cleared/reconciled records are immutable (use a reversal instead).
    assertEntryEditable(entry.reconcileStatus);
    // Plan §6: amounts must be positive; payment and deposit are mutually exclusive.
    validateTransactionAmounts(input);
    if ((input.payment ?? 0) > 0 && (input.deposit ?? 0) > 0) {
      throw new Error("Register entry cannot contain both payment and deposit.");
    }
    // Plan §4: the target date must belong to an open period.
    validateTransactionPeriod(input.date);

    const newDeposit = input.deposit && input.deposit > 0 ? input.deposit : undefined;
    const newPayment = input.payment && input.payment > 0 ? input.payment : undefined;
    const newAmount = newDeposit ?? newPayment ?? 0;
    // In the register a deposit is a DEBIT and a payment is a CREDIT for this entry's
    // account; the counterparty takes the opposite side so the entry stays balanced.
    const thisAccountSide: PostingEntryType = newDeposit ? "DEBIT" : "CREDIT";
    const counterpartySide: PostingEntryType = thisAccountSide === "DEBIT" ? "CREDIT" : "DEBIT";
    const amountChanged = newAmount > 0;

    entry.date = input.date;
    entry.refNumber = input.refNumber;
    entry.payee = input.payee;
    entry.memo = input.memo;
    if (amountChanged) {
      entry.payment = newPayment;
      entry.deposit = newDeposit;
    }
    if (input.reconcileStatus !== undefined) {
      entry.reconcileStatus = input.reconcileStatus;
    }

    const transaction = this.store.transactions.find((item) => item.id === entry.transactionId);
    const affectedAccountIds = new Set<string>([entry.accountId]);

    if (transaction) {
      transaction.transactionDate = input.date;
      transaction.referenceNumber = input.refNumber;
      transaction.payee = input.payee;
      transaction.memo = input.memo;
      transaction.periodId = getPeriodIdForDate(input.date);
      if (input.reconcileStatus !== undefined) {
        transaction.reconcileStatus = input.reconcileStatus;
      }
      if (amountChanged) {
        // Keep both journal postings consistent with the new amount/direction.
        transaction.postings = transaction.postings.map((posting) =>
          posting.accountId === entry.accountId
            ? { ...posting, type: thisAccountSide, amount: newAmount }
            : { ...posting, type: counterpartySide, amount: newAmount }
        );
      }
      transaction.postings.forEach((posting) => affectedAccountIds.add(posting.accountId));
      transaction.auditLog = [...(transaction.auditLog ?? []), auditEntry("updated")];
      transaction.updatedAt = nowIso();
    }

    // Update the posted ledger entries (the source of truth for currentBalance).
    this.store.ledgerPostings
      .filter((posting) => posting.transactionId === entry.transactionId)
      .forEach((posting) => {
        posting.postingDate = input.date;
        posting.referenceNumber = input.refNumber;
        posting.memo = input.memo;
        if (amountChanged) {
          const isThisAccount = posting.accountId === entry.accountId;
          posting.entryType = isThisAccount ? thisAccountSide : counterpartySide;
          posting.amount = newAmount;
        }
        affectedAccountIds.add(posting.accountId);
      });

    // Mirror the new amount/direction onto the counterparty register row(s).
    if (amountChanged) {
      this.store.registerEntries
        .filter((item) => item.transactionId === entry.transactionId && item.id !== entry.id)
        .forEach((counterEntry) => {
          if (counterpartySide === "DEBIT") {
            counterEntry.deposit = newAmount;
            counterEntry.payment = undefined;
          } else {
            counterEntry.payment = newAmount;
            counterEntry.deposit = undefined;
          }
          affectedAccountIds.add(counterEntry.accountId);
        });
    }

    // Plan §1/§5: an account can't be offset against itself.
    if (input.counterpartyAccountId && input.counterpartyAccountId === entry.accountId) {
      throw new Error("An account can't be its own offset account.");
    }

    // Plan §5: allow changing the offset (counterparty) account for a simple,
    // two-sided transaction. Re-point the other posting to the new account.
    if (input.counterpartyAccountId) {
      const counterpartyPostings = (transaction?.postings ?? []).filter(
        (posting) => posting.accountId !== entry.accountId
      );
      const currentCounterpartyId =
        counterpartyPostings.length === 1 ? counterpartyPostings[0].accountId : undefined;

      if (currentCounterpartyId && currentCounterpartyId !== input.counterpartyAccountId) {
        const newCounterparty = requireAccount(this.store, input.counterpartyAccountId);

        if (transaction) {
          transaction.postings = transaction.postings.map((posting) =>
            posting.accountId === currentCounterpartyId
              ? { ...posting, accountId: newCounterparty.id }
              : posting
          );
          transaction.accountLabel = newCounterparty.name;
        }

        this.store.ledgerPostings
          .filter(
            (posting) =>
              posting.transactionId === entry.transactionId &&
              posting.accountId === currentCounterpartyId
          )
          .forEach((posting) => {
            posting.accountId = newCounterparty.id;
            posting.accountCode = newCounterparty.code;
            posting.accountName = newCounterparty.name;
            posting.currency = newCounterparty.currency;
          });

        this.store.registerEntries
          .filter(
            (item) =>
              item.transactionId === entry.transactionId && item.accountId === currentCounterpartyId
          )
          .forEach((counterEntry) => {
            counterEntry.accountId = newCounterparty.id;
          });

        entry.accountLabel = newCounterparty.name;
        affectedAccountIds.add(currentCounterpartyId);
        affectedAccountIds.add(newCounterparty.id);
      }
    }

    const accountIds = [...affectedAccountIds];
    accountIds.forEach((accountId) => recalculateRunningBalances(this.store, accountId));
    updateAccountBalances(this.store, accountIds);

    return entry;
  }

  async setReconcileStatus(entryId: string, status: ReconcileStatus): Promise<RegisterEntry> {
    const entry = this.store.registerEntries.find((item) => item.id === entryId);
    if (!entry) {
      throw new Error(`Register entry ${entryId} not found`);
    }
    entry.reconcileStatus = status;
    return entry;
  }

  async deleteRegisterEntry(entryId: string): Promise<RegisterEntry> {
    const entry = this.store.registerEntries.find((item) => item.id === entryId);
    if (!entry) {
      throw new Error(`Register entry ${entryId} not found`);
    }
    // Plan §2: only pending records can be deleted; cleared/reconciled need a reversal.
    assertEntryDeletable(entry.reconcileStatus);

    const transactionId = entry.transactionId;
    const deletedAt = nowIso();

    // Collect every account touched by this transaction to revert both sides.
    const affectedAccountIds = new Set<string>([entry.accountId]);
    this.store.registerEntries
      .filter((item) => item.transactionId === transactionId)
      .forEach((item) => affectedAccountIds.add(item.accountId));
    this.store.ledgerPostings
      .filter((posting) => posting.transactionId === transactionId)
      .forEach((posting) => affectedAccountIds.add(posting.accountId));

    // Remove all register rows for this transaction (source + counterparty).
    this.store.registerEntries = this.store.registerEntries.filter(
      (item) => item.transactionId !== transactionId
    );

    // Void the ledger postings so they stop contributing to currentBalance.
    this.store.ledgerPostings
      .filter((posting) => posting.transactionId === transactionId)
      .forEach((posting) => {
        posting.status = "VOIDED";
        posting.voidedAt = deletedAt;
      });

    const transaction = this.store.transactions.find((item) => item.id === transactionId);
    if (transaction) {
      transaction.status = "DELETED";
      transaction.updatedAt = deletedAt;
      transaction.auditLog = [...(transaction.auditLog ?? []), auditEntry("deleted")];
    }

    const accountIds = [...affectedAccountIds];
    accountIds.forEach((accountId) => recalculateRunningBalances(this.store, accountId));
    updateAccountBalances(this.store, accountIds);

    return entry;
  }
}

function seedDefaultRegisterTransactions(store: Store): void {
  const affectedAccountIds: string[] = [];

  SEED_REGISTER_TRANSACTIONS.forEach((seed) => {
    const sourceAccount = store.accounts.find((account) => account.name === seed.sourceAccountName);
    const counterpartyAccount = store.accounts.find((account) => account.name === seed.counterpartyAccountName);
    if (!sourceAccount || !counterpartyAccount || sourceAccount.id === counterpartyAccount.id) {
      return;
    }

    const createdAt = nowIso();
    const sourcePostingType: PostingEntryType = seed.flow === "INFLOW" ? "DEBIT" : "CREDIT";
    const counterpartyPostingType: PostingEntryType = sourcePostingType === "DEBIT" ? "CREDIT" : "DEBIT";

    const transaction: Transaction = {
      id: createId(),
      type: seed.type,
      status: "POSTED",
      transactionDate: seed.date,
      referenceNumber: seed.ref,
      memo: seed.memo,
      payee: seed.payee,
      accountLabel: seed.counterpartyAccountName,
      sourceAccountId: sourceAccount.id,
      reconcileStatus: seed.reconcileStatus,
      periodId: getPeriodIdForDate(seed.date),
      postings: [
        { accountId: sourceAccount.id, type: sourcePostingType, amount: seed.amount },
        { accountId: counterpartyAccount.id, type: counterpartyPostingType, amount: seed.amount }
      ],
      auditLog: [auditEntry("created"), auditEntry("posted")],
      createdAt,
      updatedAt: createdAt,
      postedAt: createdAt,
      createdBy: "seed"
    };

    store.transactions.push(transaction);

    const sourceLedgerPosting: LedgerPosting = {
      id: createId(),
      transactionId: transaction.id,
      accountId: sourceAccount.id,
      accountCode: sourceAccount.code,
      accountName: sourceAccount.name,
      entryType: sourcePostingType,
      amount: seed.amount,
      currency: sourceAccount.currency,
      exchangeRate: 1,
      postingDate: seed.date,
      fiscalPeriod: postingFiscalPeriod(seed.date),
      memo: seed.memo,
      referenceNumber: seed.ref,
      sourceDocumentType: seed.type,
      sourceDocumentId: transaction.id,
      reconciliationStatus: "UNRECONCILED",
      status: "POSTED",
      createdBy: "seed",
      createdAt,
      postedAt: createdAt
    };

    const counterpartyLedgerPosting: LedgerPosting = {
      id: createId(),
      transactionId: transaction.id,
      accountId: counterpartyAccount.id,
      accountCode: counterpartyAccount.code,
      accountName: counterpartyAccount.name,
      entryType: counterpartyPostingType,
      amount: seed.amount,
      currency: counterpartyAccount.currency,
      exchangeRate: 1,
      postingDate: seed.date,
      fiscalPeriod: postingFiscalPeriod(seed.date),
      memo: seed.memo,
      referenceNumber: seed.ref,
      sourceDocumentType: seed.type,
      sourceDocumentId: transaction.id,
      reconciliationStatus: "UNRECONCILED",
      status: "POSTED",
      createdBy: "seed",
      createdAt,
      postedAt: createdAt
    };

    store.ledgerPostings.push(sourceLedgerPosting, counterpartyLedgerPosting);
    createRegisterEntries(store, transaction);
    affectedAccountIds.push(sourceAccount.id, counterpartyAccount.id);
  });

  if (affectedAccountIds.length > 0) {
    updateAccountBalances(store, affectedAccountIds);
  }
}

function runDevAccountingChecks(store: Store): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  // Plan §1: every non-deleted transaction must be balanced (debits = credits).
  store.transactions
    .filter((transaction) => transaction.status !== "DELETED")
    .forEach((transaction) => {
      try {
        validateDoubleEntry(transaction.postings);
      } catch (error) {
        console.error(`[Accounting] ${transaction.id}: ${(error as Error).message}`);
      }
    });

  // Plan §1: the trial balance over posted ledger entries must net to zero.
  const trialBalance = calculateTrialBalance(store.ledgerPostings);
  if (!trialBalance.balanced) {
    console.error(
      `[Accounting] Trial balance does not net to zero: debits=${trialBalance.totalDebits}, credits=${trialBalance.totalCredits}`
    );
  }

  // Plan §6: the accounting equation Assets = Liabilities + Equity must hold.
  const balanceSheet = generateBalanceSheet(store.accounts);
  if (!balanceSheet.balanced) {
    console.error(
      `[Accounting] Balance sheet does not balance: assets=${balanceSheet.assets}, liabilities+equity=${balanceSheet.liabilitiesAndEquity}`
    );
  }
}

export function createMockAccountingServices() {
  const store = buildMockData();
  seedDefaultRegisterTransactions(store);
  runDevAccountingChecks(store);
  return {
    accountService: new MockAccountService(store),
    ledgerService: new MockLedgerService(store),
    transactionService: new MockTransactionService(store),
    registerService: new MockRegisterService(store)
  };
}
