// Phase-1 local-only shapes for the Accounting category's new screens
// (Bank Transactions, Reconcile) -- see
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md. These are
// a staging area distinct from the real Register/ledger: nothing here
// posts a real transaction until Phase 1.5 wires it to the real backend.

export type PendingTxnStatus = "PENDING" | "POSTED" | "EXCLUDED";

export type PendingBankTxn = {
  id: string;
  accountId: string;
  date: string;
  description: string;
  spent?: number;
  received?: number;
  payee?: string;
  categoryAccountId?: string;
  /** QBO's Purpose column; unset reads as Business. */
  purpose?: "BUSINESS" | "PERSONAL";
  memo?: string;
  /** Which directory the payee came from (a vendor or a customer). */
  payeeKind?: "CUSTOMER" | "VENDOR";
  /** Overrides the type derived from direction (money in = Deposit, money out = Expense). */
  txnType?: "Deposit" | "Expense" | "Transfer";
  /** Set when Post created the real ledger transaction; Undo voids it. */
  postedTransactionId?: string;
  postedType?: "Deposit" | "Expense";
  status: PendingTxnStatus;
  createdAt: string;
};
