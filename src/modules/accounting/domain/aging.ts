import type { Account, Transaction } from "@/modules/accounting/domain/models";

export type AgingBucket = "current" | "d1_30" | "d31_60" | "d61_90" | "d90plus";

export const AGING_BUCKETS: { key: AgingBucket; label: string }[] = [
  { key: "current", label: "Current" },
  { key: "d1_30", label: "1-30" },
  { key: "d31_60", label: "31-60" },
  { key: "d61_90", label: "61-90" },
  { key: "d90plus", label: "90+" }
];

export function bucketForAge(days: number): AgingBucket {
  if (days <= 0) return "current";
  if (days <= 30) return "d1_30";
  if (days <= 60) return "d31_60";
  if (days <= 90) return "d61_90";
  return "d90plus";
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export type AgingRow = { payee: string; buckets: Record<AgingBucket, number>; total: number };

/**
 * Buckets each posting to an A/R or A/P account by the age of its due date
 * (falling back to the transaction date when unset), grouped by payee --
 * same anchor PlainGL's aging report uses. This ages individual postings,
 * not matched/netted invoice-vs-payment pairs (no invoice-matching exists
 * in this app): a payment posted today lands in "Current" as a negative
 * amount for that payee, offsetting an older invoice elsewhere in their
 * row. The per-payee Total column is always the correct net balance;
 * individual bucket columns are a reasonable approximation, not a precise
 * "which invoice is overdue" breakdown.
 *
 * Shared by the /reports/aging page and the dashboard's "Needs attention"
 * panel so both read the exact same buckets.
 */
export function computeAging(
  accounts: Account[],
  transactions: Transaction[],
  category: "ACCOUNTS_RECEIVABLE" | "ACCOUNTS_PAYABLE",
  asOfDate: string
): AgingRow[] {
  const targetAccounts = new Map(accounts.filter((a) => a.category === category).map((a) => [a.id, a]));
  const isDebitNormal = category === "ACCOUNTS_RECEIVABLE";
  const rows = new Map<string, Record<AgingBucket, number>>();

  transactions.forEach((transaction) => {
    const ageAnchor = transaction.dueDate || transaction.transactionDate;
    if (ageAnchor > asOfDate) return;
    transaction.postings.forEach((posting) => {
      const account = targetAccounts.get(posting.accountId);
      if (!account) return;
      const impact = (posting.type === "DEBIT") === isDebitNormal ? posting.amount : -posting.amount;
      const payee = transaction.payee?.trim() || account.name;
      const bucket = bucketForAge(daysBetween(ageAnchor, asOfDate));
      const existing = rows.get(payee) ?? { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
      existing[bucket] += impact;
      rows.set(payee, existing);
    });
  });

  return [...rows.entries()]
    .map(([payee, buckets]) => ({
      payee,
      buckets,
      total: AGING_BUCKETS.reduce((sum, b) => sum + buckets[b.key], 0)
    }))
    .filter((row) => Math.abs(row.total) > 0.0001)
    .sort((a, b) => b.total - a.total);
}

/** Sum of every bucket except "current" -- what PlainGL's "needs attention" panel calls overdue. */
export function overdueTotal(rows: AgingRow[]): number {
  return rows.reduce((sum, row) => sum + (row.total - row.buckets.current), 0);
}
