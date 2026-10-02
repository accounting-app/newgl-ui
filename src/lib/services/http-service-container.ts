import { BASE_API_URL } from "@/configuration";
import { requestConfirmation } from "@/components/ui/confirm-dialog";
import { createClient } from "@/lib/supabase/client";
import type {
  Account,
  AccountHierarchy,
  BankRule,
  ChartOfAccount,
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
import type {
  AccountService,
  BankRuleService,
  ExcludedFeedRowService,
  LedgerService,
  RegisterService,
  ServiceContainer,
  TransactionService
} from "@/modules/accounting/application/contracts";

export const ACCOUNT_TYPE_BY_CATEGORY: Record<Account["category"], ChartOfAccount["accountType"]> = {
  ACCOUNTS_PAYABLE: "LIABILITY",
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

type ApiError = { error: string | { message: string } };

// Thrown specifically on 401 so callers (or a shared boundary) can
// distinguish "your session expired, log in again" from every other
// failure, rather than rendering a generic error toast for both
// (AI_INTEGRATION_PLAN.md frontend plan, Part A4).
export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "SessionExpiredError";
  }
}

export async function getAccessToken(): Promise<string | null> {
  // Every current call site in this app is a Client Component (verified --
  // no Route Handlers, no server-side data fetching exist today), so the
  // browser client is sufficient. Revisit if server-side fetching is ever
  // added.
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();
  const confirmedReconciled = new Headers(init?.headers).get("X-Confirm-Reconciled") === "true";

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 401) {
    // The session cookie exists but newgl-api rejected it (expired,
    // revoked, or -- with accessToken null -- there was never one to send).
    // middleware.ts already redirects unauthenticated page loads to
    // /login; this covers the case where a session expires mid-session on
    // an already-open tab.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new SessionExpiredError();
  }

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let extra: Record<string, unknown> | undefined;
    try {
      const payload = (await response.json()) as ApiError & Record<string, unknown>;
      // Changing a reconciled transaction is a warning, not a lock (same as
      // QBO): ask once, and on "OK" repeat the same request confirmed.
      if (response.status === 409 && payload.code === "RECONCILED_TRANSACTION" && !confirmedReconciled && typeof window !== "undefined") {
        if (await requestConfirmation({
            title: "This transaction has been reconciled",
            message: typeof payload.error === "string" ? payload.error : "Changing it can make your reconciliation reports out of balance. Continue?",
            confirmLabel: "Change anyway"
          })) {
          return request<T>(baseUrl, path, { ...init, headers: { ...(init?.headers ?? {}), "X-Confirm-Reconciled": "true" } });
        }
        throw new Error("Change cancelled -- the transaction is reconciled.");
      }
      if (typeof payload.error === "string") message = payload.error;
      else if (payload.error?.message) message = payload.error.message;
      // Some routes put extra structured detail alongside `error` (e.g. a
      // numeric `difference` on the reconciliations finish route's 400) --
      // copy it onto the thrown Error so a caller that knows to expect it
      // can read it back, without every other caller needing to care.
      const { error: _error, ...rest } = payload;
      if (Object.keys(rest).length > 0) extra = rest;
    } catch {
      // ignore parse errors
    }
    const requestError = new Error(message);
    if (extra) Object.assign(requestError, extra);
    throw requestError;
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

  async deleteAccount(id: string): Promise<void> {
    await request(this.baseUrl, `/accounts/${id}`, { method: "DELETE" });
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

export class HttpBankRuleService implements BankRuleService {
  private readonly baseUrl = BASE_API_URL;
  constructor() {}

  listRules(): Promise<BankRule[]> {
    return request(this.baseUrl, "/bank-rules");
  }

  createRule(input: CreateBankRuleInput): Promise<BankRule> {
    return request(this.baseUrl, "/bank-rules", { method: "POST", body: JSON.stringify(input) });
  }

  updateRule(id: string, input: UpdateBankRuleInput): Promise<BankRule> {
    return request(this.baseUrl, `/bank-rules/${id}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  async deleteRule(id: string): Promise<void> {
    await request(this.baseUrl, `/bank-rules/${id}`, { method: "DELETE" });
  }
}

export class HttpExcludedFeedRowService implements ExcludedFeedRowService {
  private readonly baseUrl = BASE_API_URL;
  constructor() {}

  listExcludedRows(mainAccountId?: string): Promise<ExcludedFeedRow[]> {
    const query = mainAccountId ? `?mainAccountId=${encodeURIComponent(mainAccountId)}` : "";
    return request(this.baseUrl, `/excluded-feed-rows${query}`);
  }

  createExcludedRow(input: CreateExcludedFeedRowInput): Promise<ExcludedFeedRow> {
    return request(this.baseUrl, "/excluded-feed-rows", { method: "POST", body: JSON.stringify(input) });
  }

  async deleteExcludedRow(id: string): Promise<void> {
    await request(this.baseUrl, `/excluded-feed-rows/${id}`, { method: "DELETE" });
  }
}

export function createHttpServiceContainer(): ServiceContainer {
  const accountService = new HttpAccountService();
  const transactionService = new HttpTransactionService();
  const ledgerService = new HttpLedgerService();
  const registerService = new HttpRegisterService();
  const bankRuleService = new HttpBankRuleService();
  const excludedFeedRowService = new HttpExcludedFeedRowService();
  return {
    accountService,
    transactionService,
    ledgerService,
    registerService,
    bankRuleService,
    excludedFeedRowService
  };
}