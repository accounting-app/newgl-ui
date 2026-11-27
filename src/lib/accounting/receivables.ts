import type { Account, Transaction } from "@/modules/accounting/domain/models";

/** The account customer payments post against. Same name the invoices API uses, when there is one. */
export function findReceivableAccount(accounts: Account[]): Account | undefined {
  const receivable = accounts.filter((account) => account.category === "ACCOUNTS_RECEIVABLE" && account.status === "ACTIVE");
  return receivable.find((account) => account.name === "Accounts Receivable") ?? receivable[0];
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
 * Payments that no invoice or bill was paid with: QBO's "Unapplied payment"
 * credits. `appliedIds` are the invoices' or bills' payment transaction ids.
 */
export function unappliedPayments(
  transactions: Transaction[],
  accounts: Account[],
  appliedIds: ReadonlySet<string>,
  name: string,
  contact: keyof typeof SIDES = "customer"
): { id: string; date: string; amount: number }[] {
  const side = SIDES[contact];
  const accountIds = new Set(accounts.filter((account) => account.category === side.category).map((account) => account.id));
  if (!name) return [];
  return transactions
    .filter((txn) => txn.type === side.type && txn.status === "POSTED" && !txn.reversedAt && txn.payee === name && !appliedIds.has(txn.id))
    .map((txn) => ({
      id: txn.id,
      date: txn.transactionDate,
      amount: txn.postings.filter((p) => p.type === side.posting && accountIds.has(p.accountId)).reduce((sum, p) => sum + p.amount, 0)
    }))
    .filter((credit) => credit.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}
