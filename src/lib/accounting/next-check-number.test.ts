import { describe, expect, test } from "bun:test";

import { nextCheckNumber, nextJournalNumber, nextSalesReceiptNumber } from "./next-check-number";

const entry = (refNumber: string | undefined, createdAt: string, transactionType: "CHECK" | "DEPOSIT" | "SALES_RECEIPT" = "CHECK") => ({ refNumber, createdAt, transactionType });

describe("nextCheckNumber", () => {
  test("starts at 1 without earlier numbered checks", () => {
    expect(nextCheckNumber([])).toBe("1");
    expect(nextCheckNumber([entry("TX-1003", "2026-01-01"), entry("90", "2026-01-02", "DEPOSIT")])).toBe("1");
  });

  test("follows the most recently entered check, even if the number is lower", () => {
    expect(nextCheckNumber([entry("1001", "2026-01-01"), entry("11", "2026-02-01")])).toBe("12");
  });

  test("keeps leading zeros", () => {
    expect(nextCheckNumber([entry("0042", "2026-01-01")])).toBe("0043");
  });
});

describe("nextSalesReceiptNumber", () => {
  test("starts at 1001 and counts only sales receipts", () => {
    expect(nextSalesReceiptNumber([entry("50", "2026-01-01")])).toBe("1001");
    expect(nextSalesReceiptNumber([entry("1001", "2026-01-01", "SALES_RECEIPT"), entry("9", "2026-02-01")])).toBe("1002");
  });
});

describe("nextJournalNumber", () => {
  const journal = (referenceNumber: string, createdAt: string, dueDate?: string) => ({ type: "JOURNAL_ENTRY" as const, referenceNumber, createdAt, dueDate });

  test("follows the latest journal entry, ignoring invoices and reversals", () => {
    expect(nextJournalNumber([])).toBe("1");
    expect(nextJournalNumber([journal("5", "2026-01-01"), journal("1001", "2026-02-01", "2026-03-01"), journal("5R", "2026-03-01")])).toBe("6");
  });
});
