import type { RegisterEntry } from "@/modules/accounting/domain/models";

/**
 * The check number to suggest for the next check on an account: one more than
 * the most recently entered check, as QBO does. Following the latest entry (not
 * the highest) means a number the user changes becomes the new starting point.
 * Refs that aren't plain numbers ("TX-1003", "ADJ") are ignored.
 */
export function nextCheckNumber(entries: Pick<RegisterEntry, "transactionType" | "refNumber" | "createdAt">[]): string {
  const latest = entries
    .filter((entry) => entry.transactionType === "CHECK" && /^\d+$/.test(entry.refNumber?.trim() ?? ""))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest?.refNumber) return "1";
  const digits = latest.refNumber.trim();
  return String(Number(digits) + 1).padStart(digits.length, "0");
}
