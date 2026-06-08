import { ACCOUNTING_CONFIG } from "@/modules/accounting/config/accounting-config";
import type {
  Account,
  LedgerPosting,
  PostingEntryType,
  ReconcileStatus,
  RegisterEntry
} from "@/modules/accounting/domain/models";

/**
 * Accounting reports & validators (plan §1, §5, §6).
 *
 * These operate on the app's real double-entry model: a transaction's `postings`
 * are the journal entries (DEBIT/CREDIT), and posted `LedgerPosting`s are the
 * source of truth for balances. We do NOT change the existing transaction types
 * or account categories — these helpers only read and validate them.
 */

/** Categories whose normal balance is on the DEBIT side (assets). */
export const DEBIT_NORMAL_CATEGORIES = new Set<Account["category"]>([
  "ACCOUNTS_RECEIVABLE",
  "BANK",
  "EXPENSE",
  "FIXED_ASSET",
  "OTHER_CURRENT_ASSET",
  "OTHER_EXPENSE"
]);

export type PostingLike = { type: PostingEntryType; amount: number };

const TOLERANCE = ACCOUNTING_CONFIG.roundingTolerance;

function sumBySide(postings: PostingLike[], side: PostingEntryType): number {
  return postings
    .filter((posting) => posting.type === side)
    .reduce((total, posting) => total + posting.amount, 0);
}

/** Plan §1: every transaction's debits must equal its credits. Throws if not. */
export function validateDoubleEntry(postings: PostingLike[]): true {
  if (postings.length < 2) {
    throw new Error("A transaction must have at least two postings (double-entry).");
  }
  const totalDebits = sumBySide(postings, "DEBIT");
  const totalCredits = sumBySide(postings, "CREDIT");
  if (Math.abs(totalDebits - totalCredits) > TOLERANCE) {
    throw new Error(`Unbalanced transaction: debits ${totalDebits} ≠ credits ${totalCredits}`);
  }
  return true;
}

export function isDoubleEntryBalanced(postings: PostingLike[]): boolean {
  try {
    return validateDoubleEntry(postings);
  } catch {
    return false;
  }
}

/** Plan §1: sum of all debits/credits across posted ledger entries must be zero. */
export function calculateTrialBalance(postings: LedgerPosting[]): {
  totalDebits: number;
  totalCredits: number;
  balanced: boolean;
} {
  const posted: PostingLike[] = postings
    .filter((posting) => posting.status === "POSTED")
    .map((posting) => ({ type: posting.entryType, amount: posting.amount }));
  const totalDebits = sumBySide(posted, "DEBIT");
  const totalCredits = sumBySide(posted, "CREDIT");
  return {
    totalDebits: round2(totalDebits),
    totalCredits: round2(totalCredits),
    balanced: Math.abs(totalDebits - totalCredits) < TOLERANCE
  };
}

/** Plan §6: Assets = Liabilities + Equity (uses each account's current balance). */
export function generateBalanceSheet(accounts: Account[]): {
  assets: number;
  liabilitiesAndEquity: number;
  balanced: boolean;
} {
  let assets = 0;
  let liabilitiesAndEquity = 0;
  accounts.forEach((account) => {
    if (DEBIT_NORMAL_CATEGORIES.has(account.category)) {
      assets += account.currentBalance;
    } else {
      liabilitiesAndEquity += account.currentBalance;
    }
  });
  return {
    assets: round2(assets),
    liabilitiesAndEquity: round2(liabilitiesAndEquity),
    balanced: Math.abs(assets - liabilitiesAndEquity) < 0.01
  };
}

/** Plan §6: feed the C/R reconcile statuses into a reconciliation summary. */
export function getBankReconciliationSummary(entries: RegisterEntry[]): {
  clearedBalance: number;
  unclearedBalance: number;
  totalBalance: number;
} {
  const movement = (entry: RegisterEntry) => (entry.deposit ?? 0) - (entry.payment ?? 0);
  const clearedBalance = entries
    .filter((entry) => entry.reconcileStatus === "C" || entry.reconcileStatus === "R")
    .reduce((sum, entry) => sum + movement(entry), 0);
  const unclearedBalance = entries
    .filter((entry) => entry.reconcileStatus === "")
    .reduce((sum, entry) => sum + movement(entry), 0);
  return {
    clearedBalance: round2(clearedBalance),
    unclearedBalance: round2(unclearedBalance),
    totalBalance: round2(clearedBalance + unclearedBalance)
  };
}

/** Plan §6: payment/deposit amounts must always be positive. */
export function validateTransactionAmounts(input: { payment?: number; deposit?: number }): true {
  if (input.payment !== undefined && input.payment < 0) {
    throw new Error(`Payment amount must be positive (got ${input.payment}).`);
  }
  if (input.deposit !== undefined && input.deposit < 0) {
    throw new Error(`Deposit amount must be positive (got ${input.deposit}).`);
  }
  return true;
}

/**
 * Plan §5: a transfer must only move money between asset/liability accounts
 * (e.g. cash → credit card). Touching an equity account means it is really a
 * contribution/draw, not a transfer, and should be flagged.
 */
const TRANSFER_ALLOWED_CATEGORIES = new Set<Account["category"]>([
  "ACCOUNTS_RECEIVABLE",
  "BANK",
  "CREDIT_CARD",
  "FIXED_ASSET",
  "OTHER_CURRENT_ASSET",
  "LONG_TERM_LIABILITY",
  "OTHER_CURRENT_LIABILITY"
]);

export function transferTouchesEquityOrPL(
  postings: Array<{ accountId: string }>,
  accounts: Account[]
): boolean {
  return postings.some((posting) => {
    const account = accounts.find((item) => item.id === posting.accountId);
    if (!account) return false;
    return !TRANSFER_ALLOWED_CATEGORIES.has(account.category);
  });
}

const PERSONAL_ACCOUNT_KEYWORDS = ["personal", "personal income", "personal expense"];

/** Plan §5/§6: entity principle — warn when a personal account is used. */
export function detectPersonalMixing(accountName: string | undefined): {
  warning: boolean;
  message?: string;
} {
  const name = (accountName ?? "").toLowerCase();
  if (PERSONAL_ACCOUNT_KEYWORDS.some((keyword) => name.includes(keyword))) {
    return {
      warning: true,
      message: `"${accountName}" appears to be a personal account. Consider separating business and personal finances to keep accounting records accurate.`
    };
  }
  return { warning: false };
}

/** Plan §2: reference numbers must be unique and sequential (never reused). */
export function generateNextRefNumber(existingRefNumbers: Array<string | undefined>): string {
  const maxNum = existingRefNumbers.reduce((max, ref) => {
    if (!ref) return max;
    const match = /^TX-(\d+)$/.exec(ref.trim());
    if (!match) return max;
    const num = Number.parseInt(match[1], 10);
    return Number.isFinite(num) && num > max ? num : max;
  }, 1000);
  return `TX-${maxNum + 1}`;
}

/**
 * Plan §2: cleared ("C") and reconciled ("R") records are immutable — they must be
 * corrected with a reversal, not edited; only pending ("") records can be deleted.
 */
export function isEntryLocked(status: ReconcileStatus): boolean {
  return status === "C" || status === "R";
}

export function assertEntryEditable(status: ReconcileStatus): void {
  if (isEntryLocked(status)) {
    const label = status === "R" ? "reconciled" : "cleared";
    throw new Error(
      `This transaction is ${label} and cannot be edited. Create a reversal entry instead.`
    );
  }
}

export function assertEntryDeletable(status: ReconcileStatus): void {
  if (status !== "") {
    const label = status === "R" ? "reconciled" : "cleared";
    throw new Error(`Only pending transactions can be deleted (this one is ${label}).`);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
