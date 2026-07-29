import { BASE_API_URL } from "@/configuration";
import type {
  Account,
  AccountHierarchy,
  ChartOfAccount,
  CreateAccountInput,
  CreateTransactionInput,
  ImportTransactionsInput,
  ImportTransactionsResult,
  LedgerPosting,
  ListTransactionsFilter,
  ReconcileStatus,
  RegisterEntry,
  Transaction,
  UpdateAccountInput
} from "@/modules/accounting/domain/models";
import type {
  AccountService,
  LedgerService,
  RegisterService,
  ServiceContainer,
  TransactionService
} from "@/modules/accounting/application/contracts";

export const ACCOUNT_TYPE_BY_CATEGORY: Record<Account["category"], ChartOfAccount["accountType"]> = {
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

export const NORMAL_BALANCE_BY_TYPE: Record<ChartOfAccount["accountType"], ChartOfAccount["normalBalance"]> = {
  ASSET: "DEBIT",
  LIABILITY: "CREDIT",
  EQUITY: "CREDIT",
  REVENUE: "CREDIT",
  EXPENSE: "DEBIT"
};

export function toChartAccount(account: Account): ChartOfAccount {
  const accountType = ACCOUNT_TYPE_BY_CATEGORY[account.category];
  return {
    id: account.id,
    accountNumber: account.code,
    name: account.name,
    accountType,
    accountSubtype: account.subtype,
    normalBalance: NORMAL_BALANCE_BY_TYPE[accountType],
    isParent: false,
    isSystemAccount: false,
    allowsManualPostings: account.allowManualEntries,
    currency: account.currency,
    openingBalance: account.openingBalance ?? 0,
    currentBalance: account.currentBalance,
    availableBalance: account.currentBalance,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt
  };
}

type ApiError = { error: string };

export async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = (await response.json()) as ApiError;
      if (payload.error) message = payload.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export class HttpAccountService implements AccountService {
  private readonly baseUrl = BASE_API_URL;
  constructor() {}

  createAccount(input: CreateAccountInput): Promise<Account> {
    return request(this.baseUrl, "/accounts", { method: "POST", body: JSON.stringify(input) });
  }

  updateAccount(id: string, input: UpdateAccountInput): Promise<Account> {
    return request(this.baseUrl, `/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  async closeAccount(id: string): Promise<void> {
    await request(this.baseUrl, `/accounts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CLOSED" })
    });
  }

  getAccountById(id: string): Promise<Account> {
    return request(this.baseUrl, `/accounts/${id}`);
  }

  listAccounts(): Promise<Account[]> {
    return request(this.baseUrl, "/accounts");
  }

  async getAccountHierarchy(): Promise<AccountHierarchy> {
    const accounts = await this.listAccounts();
    const chartAccounts = accounts.map(toChartAccount);
    return chartAccounts.map((account) => ({
      ...account,
      children: chartAccounts.filter((candidate) => candidate.parentAccountId === account.id)
    }));
  }
}

export class HttpTransactionService implements TransactionService {
  private readonly baseUrl = BASE_API_URL;
  constructor() {}

  createTransaction(input: CreateTransactionInput): Promise<Transaction> {
    return request(this.baseUrl, "/transactions", { method: "POST", body: JSON.stringify(input) });
  }

  getTransactionById(id: string): Promise<Transaction> {
    return request(this.baseUrl, `/transactions/${id}`);
  }

  listTransactions(filter?: ListTransactionsFilter): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (filter?.status) params.set("status", filter.status);
    if (filter?.sourceAccountId) params.set("sourceAccountId", filter.sourceAccountId);
    const query = params.toString();
    return request(this.baseUrl, `/transactions${query ? `?${query}` : ""}`);
  }

  importTransactions(input: ImportTransactionsInput): Promise<ImportTransactionsResult> {
    return request(this.baseUrl, "/transactions/import", { method: "POST", body: JSON.stringify(input) });
  }

  postTransaction(id: string): Promise<Transaction> {
    return request(this.baseUrl, `/transactions/${id}/post`, { method: "POST" });
  }

  voidTransaction(id: string): Promise<Transaction> {
    return request(this.baseUrl, `/transactions/${id}/void`, { method: "POST" });
  }

  reverseTransaction(id: string): Promise<Transaction> {
    return request(this.baseUrl, `/transactions/${id}/reverse`, { method: "POST" });
  }

  createDeposit(input: Omit<CreateTransactionInput, "type">): Promise<Transaction> {
    return request(this.baseUrl, "/deposits", { method: "POST", body: JSON.stringify(input) });
  }

  createTransfer(input: Omit<CreateTransactionInput, "type">): Promise<Transaction> {
    return request(this.baseUrl, "/transfers", { method: "POST", body: JSON.stringify(input) });
  }
}

export class HttpLedgerService implements LedgerService {
  private readonly baseUrl = BASE_API_URL;
  constructor() {}

  getPostingsByTransactionId(transactionId: string): Promise<LedgerPosting[]> {
    return request(this.baseUrl, `/ledger/transactions/${transactionId}/postings`);
  }

  listPostings(): Promise<LedgerPosting[]> {
    return request(this.baseUrl, "/ledger/postings");
  }
}

export class HttpRegisterService implements RegisterService {
  private readonly baseUrl = BASE_API_URL;
  constructor() {}

  listRegisterEntries(accountId: string): Promise<RegisterEntry[]> {
    return request(this.baseUrl, `/accounts/${accountId}/register`);
  }

  getTransactionDetail(transactionId: string): Promise<{
    transaction: Transaction;
    postings: LedgerPosting[];
    registerEntries: RegisterEntry[];
  }> {
    return request(this.baseUrl, `/transactions/${transactionId}/detail`);
  }

  updateRegisterEntry(
    entryId: string,
    input: Pick<RegisterEntry, "date" | "refNumber" | "payee" | "memo"> & {
      payment?: number;
      deposit?: number;
      reconcileStatus?: ReconcileStatus;
      counterpartyAccountId?: string;
    }
  ): Promise<RegisterEntry> {
    return request(this.baseUrl, `/register/${entryId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });
  }

  setReconcileStatus(entryId: string, status: ReconcileStatus): Promise<RegisterEntry> {
    return request(this.baseUrl, `/register/${entryId}/reconcile`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
  }

  deleteRegisterEntry(entryId: string): Promise<RegisterEntry> {
    return request(this.baseUrl, `/register/${entryId}`, { method: "DELETE" });
  }
}

export function createHttpServiceContainer(): ServiceContainer {
  const accountService = new HttpAccountService();
  const transactionService = new HttpTransactionService();
  const ledgerService = new HttpLedgerService();
  const registerService = new HttpRegisterService();
  return {
    accountService,
    transactionService,
    ledgerService,
    registerService
  };
}