import type { ExcludedFeedRow, Transaction } from "@/modules/accounting/domain/models";

export type FeedRow = { transactionDate: string | null; payee: string; amount: number | null };

function normalizedPayee(payee: string): string {
  return payee.trim().toLowerCase();
}

/** Signed amount a POSTED transaction contributed to the main account, in the same sign convention as a review row's amount (matches importTransactions' isOutflow logic: DEBIT on a debit-normal account is an inflow/positive). */
function transactionSignedAmount(transaction: Transaction, mainAccountId: string): number | null {
  const posting = transaction.postings.find((p) => p.accountId === mainAccountId);
  if (!posting) return null;
  return posting.type === "DEBIT" ? posting.amount : -posting.amount;
}

/**
 * A row "looks like a duplicate" when an existing POSTED transaction on the
 * same main account already has the same date, payee, and signed amount --
 * the classic re-imported-the-same-statement case.
 */
export function findDuplicateTransaction(
  transactions: Transaction[],
  mainAccountId: string,
  row: FeedRow
): Transaction | null {
  if (row.transactionDate === null || row.amount === null) return null;
  const payee = normalizedPayee(row.payee);
  return (
    transactions.find((transaction) => {
      if (transaction.transactionDate !== row.transactionDate) return false;
      if (normalizedPayee(transaction.payee ?? "") !== payee) return false;
      return transactionSignedAmount(transaction, mainAccountId) === row.amount;
    }) ?? null
  );
}

/**
 * Exclusion memory matches on payee + amount only, deliberately ignoring
 * date -- it's meant to catch a *recurring* row pattern (e.g. a monthly bank
 * fee) across different statement periods, not one specific transaction.
 */
export function findExclusionMatch(
  excludedRows: ExcludedFeedRow[],
  mainAccountId: string,
  row: FeedRow
): ExcludedFeedRow | null {
  if (row.amount === null) return null;
  const payee = normalizedPayee(row.payee);
  return (
    excludedRows.find(
      (excluded) =>
        excluded.mainAccountId === mainAccountId &&
        normalizedPayee(excluded.payee) === payee &&
        excluded.amount === row.amount
    ) ?? null
  );
}
