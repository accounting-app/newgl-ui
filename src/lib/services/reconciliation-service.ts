import { BASE_API_URL } from "@/configuration";
import { getAccessToken, request } from "@/lib/services/http-service-container";

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
  draft: { statementEndingDate: string; statementEndingBalance: number } | null;
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

export type ReconciliationDiscrepancy = {
  reconciliationId: string;
  statementEndingDate: string;
  transactionId: string;
  change: "DELETED" | "UNRECONCILED" | "AMOUNT_CHANGED" | "DATE_CHANGED";
  date: string | null;
  refNumber: string | null;
  payee: string | null;
  reconciledAmount: number | null;
  currentAmount: number | null;
  reconciledDate: string | null;
};

/** Undo the most recent reconciliation for an account (History by account -> View report -> Undo). */
export function undoReconciliation(reconciliationId: string): Promise<{ undone: true; accountId: string }> {
  return request(BASE_API_URL, `/reconciliations/${reconciliationId}/undo`, { method: "POST" });
}

/** The Reconciliation Discrepancy report: reconciled transactions changed, deleted or un-reconciled afterwards. */
export function listReconciliationDiscrepancies(accountId: string): Promise<ReconciliationDiscrepancy[]> {
  return request<ReconciliationDiscrepancy[]>(BASE_API_URL, `/accounts/${accountId}/reconciliation-discrepancies`);
}

export type ReconciliationDraft = {
  statementStartDate: string;
  statementEndingDate: string;
  statementEndingBalance: number;
  serviceCharge: { amount: number; date: string; expenseAccountId: string } | null;
  interestEarned: { amount: number; date: string; incomeAccountId: string } | null;
  clearedTransactionIds: string[];
  updatedAt: string;
};

/** "Save for later" / "Resume reconciling": one in-progress reconciliation per account. */
export function getReconciliationDraft(accountId: string): Promise<ReconciliationDraft | null> {
  return request<ReconciliationDraft | null>(BASE_API_URL, `/accounts/${accountId}/reconciliation-draft`);
}

export function saveReconciliationDraft(accountId: string, draft: Omit<ReconciliationDraft, "updatedAt">): Promise<ReconciliationDraft> {
  return request<ReconciliationDraft>(BASE_API_URL, `/accounts/${accountId}/reconciliation-draft`, { method: "PUT", body: JSON.stringify(draft) });
}

export function discardReconciliationDraft(accountId: string): Promise<{ deleted: boolean }> {
  return request(BASE_API_URL, `/accounts/${accountId}/reconciliation-draft`, { method: "DELETE" });
}

export type ReconciliationAttachment = {
  id: string;
  reconciliationId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export function listReconciliationAttachments(accountId: string): Promise<ReconciliationAttachment[]> {
  return request<ReconciliationAttachment[]>(BASE_API_URL, `/accounts/${accountId}/reconciliation-attachments`);
}

/** Attach the bank statement file to a finished reconciliation (multipart, so not through the JSON request helper). */
export async function uploadReconciliationAttachment(reconciliationId: string, file: File): Promise<ReconciliationAttachment> {
  const token = await getAccessToken();
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${BASE_API_URL}/reconciliations/${reconciliationId}/attachments`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Upload failed (${response.status})`);
  }
  return (await response.json()) as ReconciliationAttachment;
}

/** Download needs the auth header, so it can't be a plain link: fetch, then hand the browser the blob. */
export async function downloadReconciliationAttachment(attachment: ReconciliationAttachment): Promise<void> {
  const token = await getAccessToken();
  const response = await fetch(`${BASE_API_URL}/reconciliation-attachments/${attachment.id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) throw new Error(`Download failed (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function deleteReconciliationAttachment(attachmentId: string): Promise<{ deleted: boolean }> {
  return request(BASE_API_URL, `/reconciliation-attachments/${attachmentId}`, { method: "DELETE" });
}
