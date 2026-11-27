import type { RegisterEntry } from "@/modules/accounting/domain/models";

type NumberedEntry = Pick<RegisterEntry, "transactionType" | "refNumber" | "createdAt">;

/**
 * The number to suggest for the next document of a type on an account: one more
 * than the most recently entered one, as QBO does. Following the latest entry
 * (not the highest) means a number the user changes becomes the new starting
 * point. Refs that aren't plain numbers ("TX-1003", "ADJ") are ignored.
 */
export function nextDocumentNumber(entries: NumberedEntry[], type: RegisterEntry["transactionType"], first: string): string {
  const latest = entries
    .filter((entry) => entry.transactionType === type && /^\d+$/.test(entry.refNumber?.trim() ?? ""))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest?.refNumber) return first;
  const digits = latest.refNumber.trim();
  return String(Number(digits) + 1).padStart(digits.length, "0");
}

export const nextCheckNumber = (entries: NumberedEntry[]) => nextDocumentNumber(entries, "CHECK", "1");

/** QBO starts sales receipts at 1001. */
export const nextSalesReceiptNumber = (entries: NumberedEntry[]) => nextDocumentNumber(entries, "SALES_RECEIPT", "1001");
