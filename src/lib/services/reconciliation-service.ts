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
  enteredCount: number;
  completedAt: string;
};

export type ReconciliationEntry = {
  transactionId: string;
  date: string | null;
  refNumber: string | null;
  payee: string | null;
  memo: string | null;
  payment: number | null;
  deposit: number | null;
};

export type ReconciliationDetail = Reconciliation & { entries: ReconciliationEntry[] };

export type FinishReconciliationInput = {
  statementStartDate: string;
  statementEndingDate: string;
  statementEndingBalance: number;
  serviceCharge?: { amount: number; date: string; expenseAccountId: string };
  interestEarned?: { amount: number; date: string; incomeAccountId: string };
  clearedTransactionIds: string[];
};

/** The Reconcile matching screen's "Finish now" -- the only write in this domain (Save-for-later/Undo are deferred, see the plan). */
export function finishReconciliation(accountId: string, input: FinishReconciliationInput): Promise<Reconciliation> {
  return request<Reconciliation>(BASE_API_URL, `/accounts/${accountId}/reconciliations/finish`, {
    method: "POST",
    body: JSON.stringify(input)
  });
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
