import type { RegisterEntry, Transaction } from "@/modules/accounting/domain/models";

type NumberedEntry = Pick<RegisterEntry, "transactionType" | "refNumber" | "createdAt">;

/**
 * The number to suggest for the next document of a type on an account: one more
 * than the most recently entered one, as QBO does. Following the latest entry
 * (not the highest) means a number the user changes becomes the new starting
 * point. Refs that aren't plain numbers ("TX-1003", "ADJ") are ignored.
 */
export function nextDocumentNumber(entries: NumberedEntry[], types: RegisterEntry["transactionType"][], first: string): string {
  const latest = entries
    .filter((entry) => types.includes(entry.transactionType) && /^\d+$/.test(entry.refNumber?.trim() ?? ""))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest?.refNumber) return first;
  const digits = latest.refNumber.trim();
  return String(Number(digits) + 1).padStart(digits.length, "0");
}

/** Checks and bill payments come out of the same check book, so they share one sequence. */
export const nextCheckNumber = (entries: NumberedEntry[]) => nextDocumentNumber(entries, ["CHECK", "BILL_PAYMENT"], "1");

/** QBO starts sales receipts at 1001. */
export const nextSalesReceiptNumber = (entries: NumberedEntry[]) => nextDocumentNumber(entries, ["SALES_RECEIPT"], "1001");

/**
 * Journal numbers run across the whole company, not per account. Invoices are
 * also posted as journal entries; they carry a due date, so they're left out.
 */
export function nextJournalNumber(transactions: Pick<Transaction, "type" | "referenceNumber" | "createdAt" | "dueDate">[]): string {
  const journals = transactions
    .filter((txn) => txn.type === "JOURNAL_ENTRY" && !txn.dueDate)
    .map((txn) => ({ transactionType: "JOURNAL_ENTRY" as const, refNumber: txn.referenceNumber, createdAt: txn.createdAt ?? "" }));
  return nextDocumentNumber(journals, ["JOURNAL_ENTRY"], "1");
}
