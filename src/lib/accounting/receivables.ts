import type { Account, Transaction } from "@/modules/accounting/domain/models";

/** The account customer payments post against. Same name the invoices API uses, when there is one. */
export function findReceivableAccount(accounts: Account[]): Account | undefined {
  const receivable = accounts.filter((account) => account.category === "ACCOUNTS_RECEIVABLE" && account.status === "ACTIVE");
  return receivable.find((account) => account.name === "Accounts Receivable") ?? receivable[0];
}

/**
 * A customer's payments that no invoice was paid with: QBO's "Unapplied
 * payment" credits. `appliedIds` are the invoices' payment transaction ids.
 */
export function unappliedPayments(
  transactions: Transaction[],
  accounts: Account[],
  appliedIds: ReadonlySet<string>,
  customer: string
): { id: string; date: string; amount: number }[] {
  const receivableIds = new Set(accounts.filter((account) => account.category === "ACCOUNTS_RECEIVABLE").map((account) => account.id));
  if (!customer) return [];
  return transactions
    .filter((txn) => txn.type === "RECEIVE_PAYMENT" && txn.status === "POSTED" && !txn.reversedAt && txn.payee === customer && !appliedIds.has(txn.id))
    .map((txn) => ({
      id: txn.id,
      date: txn.transactionDate,
      amount: txn.postings.filter((p) => p.type === "CREDIT" && receivableIds.has(p.accountId)).reduce((sum, p) => sum + p.amount, 0)
    }))
    .filter((credit) => credit.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
