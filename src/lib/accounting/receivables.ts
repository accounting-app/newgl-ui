import type { Account, Transaction } from "@/modules/accounting/domain/models";

/** The account customer payments post against. Same name the invoices API uses, when there is one. */
export function findReceivableAccount(accounts: Account[]): Account | undefined {
  const receivable = accounts.filter((account) => account.category === "ACCOUNTS_RECEIVABLE" && account.status === "ACTIVE");
  return receivable.find((account) => account.name === "Accounts Receivable") ?? receivable[0];
}

/** Total applied from each payment transaction, over all invoices or bills. */
export function appliedByTransaction(documents: { payments: { transactionId: string; amount: number }[] }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const payment of documents.flatMap((document) => document.payments)) {
    totals.set(payment.transactionId, (totals.get(payment.transactionId) ?? 0) + payment.amount);
  }
  return totals;
}

/** The account bill payments post against: the same pick the bills API makes. */
export function findPayableAccount(accounts: Account[]): Account | undefined {
  return accounts.find((account) => account.category === "ACCOUNTS_PAYABLE" && account.status === "ACTIVE");
}

const SIDES = {
  customer: { type: "RECEIVE_PAYMENT", posting: "CREDIT", category: "ACCOUNTS_RECEIVABLE" },
  vendor: { type: "BILL_PAYMENT", posting: "DEBIT", category: "ACCOUNTS_PAYABLE" }
} as const;

/**
 * What each payment has left over after the invoices or bills it was applied
 * to: QBO's "Unapplied payment" credits. `applied` is the total applied per
 * payment transaction id (see appliedByTransaction).
 */
export function unappliedPayments(
  transactions: Transaction[],
  accounts: Account[],
  applied: ReadonlyMap<string, number>,
  name: string,
  contact: keyof typeof SIDES = "customer"
): { id: string; date: string; original: number; amount: number }[] {
  const side = SIDES[contact];
  const accountIds = new Set(accounts.filter((account) => account.category === side.category).map((account) => account.id));
  if (!name) return [];
  return transactions
    .filter((txn) => txn.type === side.type && txn.status === "POSTED" && !txn.reversedAt && txn.payee === name)
    .map((txn) => {
      const original = txn.postings.filter((p) => p.type === side.posting && accountIds.has(p.accountId)).reduce((sum, p) => sum + Math.round(p.amount * 100), 0);
      const left = original - Math.round((applied.get(txn.id) ?? 0) * 100);
      return { id: txn.id, date: txn.transactionDate, original: original / 100, amount: left / 100 };
    })
    .filter((credit) => credit.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
