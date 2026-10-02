import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

export type Reconciliation = {
  id: string;
  accountId: string;
  statementStartDate: string;
  statementEndingDate: string;
  statementBeginningBalance: number;
  statementEndingBalance: number;
  clearedBalance: number;
  serviceChargeAmount: number | null;
  interestEarnedAmount: number | null;
  discrepancyAdjustmentAmount: number | null;
  enteredCount: number;
  reconciledBy: string | null;
  completedAt: string;
};

export type ReconciliationEntry = {
  transactionId: string;
  transactionType: string | null;
  date: string | null;
  refNumber: string | null;
  payee: string | null;
  memo: string | null;
  payment: number | null;
  deposit: number | null;
};

export type ReconciliationDetail = Reconciliation & {
  entries: ReconciliationEntry[];
  paymentsCount: number;
  paymentsTotal: number;
  depositsCount: number;
  depositsTotal: number;
  unclearedTotal: number;
  registerBalance: number;
  unclearedEntries: ReconciliationEntry[];
  normalBalance: "DEBIT" | "CREDIT";
  // Computed from the ledger on its own, so isBalanced is a real proof:
  // statement balance +/- uncleared items must equal the books exactly.
  bookBalance: number;
  adjustedBankBalance: number;
  isBalanced: boolean;
};

export type ReconciliationSetup = {
  normalBalance: "DEBIT" | "CREDIT";
  beginningBalance: number;
  lastStatementEndingDate: string | null;
  lastStatementEndingBalance: number | null;
  lastReconciliationId: string | null;
  beginningBalanceMatchesLastStatement: boolean;
};

export type FinishReconciliationInput = {
  statementStartDate: string;
  statementEndingDate: string;
  statementEndingBalance: number;
  serviceCharge?: { amount: number; date: string; expenseAccountId: string };
  interestEarned?: { amount: number; date: string; incomeAccountId: string };
  clearedTransactionIds: string[];
  // Set only on the confirmed retry after ReconciliationOutOfBalanceError --
  // matches QBO's "Hold on! Your difference isn't $0.00 yet" -> "Add
  // adjustment and finish".
  discrepancyAdjustmentDate?: string;
};

/**
 * Thrown by finishReconciliation on a 400 "out of balance" response --
 * carries the numeric difference so the caller can show QBO's own "Hold
 * on! Your difference isn't $0.00 yet" confirmation instead of just an
 * error toast.
 */
export class ReconciliationOutOfBalanceError extends Error {
  difference: number;
  constructor(message: string, difference: number) {
    super(message);
    this.name = "ReconciliationOutOfBalanceError";
    this.difference = difference;
  }
}

/** The Reconcile matching screen's "Finish now" -- the only write in this domain (Save-for-later/Undo are deferred, see the plan). */
export async function finishReconciliation(accountId: string, input: FinishReconciliationInput): Promise<Reconciliation> {
  try {
    return await request<Reconciliation>(BASE_API_URL, `/accounts/${accountId}/reconciliations/finish`, {
      method: "POST",
      body: JSON.stringify(input)
    });
  } catch (error) {
    if (error instanceof Error && "difference" in error && typeof (error as { difference?: unknown }).difference === "number") {
      throw new ReconciliationOutOfBalanceError(error.message, (error as { difference: number }).difference);
    }
    throw error;
  }
}

/** What the setup screen needs: the ledger-derived beginning balance and the last statement. */
export function getReconciliationSetup(accountId: string): Promise<ReconciliationSetup> {
  return request<ReconciliationSetup>(BASE_API_URL, `/accounts/${accountId}/reconciliation-setup`);
}

/** History-by-account tab. */
export function listReconciliationsForAccount(accountId: string): Promise<Reconciliation[]> {
  return request<Reconciliation[]>(BASE_API_URL, `/accounts/${accountId}/reconciliations`);
}

/** Reconciliation-summary tab. */
export function listReconciliations(): Promise<Reconciliation[]> {
  return request<Reconciliation[]>(BASE_API_URL, "/reconciliations");
}

/** The printable Reconciliation Report behind "View report". */
export function getReconciliation(reconciliationId: string): Promise<ReconciliationDetail> {
  return request<ReconciliationDetail>(BASE_API_URL, `/reconciliations/${reconciliationId}`);
}
