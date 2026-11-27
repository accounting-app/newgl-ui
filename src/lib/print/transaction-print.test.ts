import { describe, expect, test } from "bun:test";
import type { Account, Transaction } from "@/modules/accounting/domain/models";
import { amountInWords } from "./amount-in-words";
import { transactionPrintHtml } from "./transaction-print";

const accounts = [
  { id: "bank", name: "Cash" },
  { id: "ads", name: "Advertising" }
] as Account[];
const check = {
  type: "CHECK",
  transactionDate: "2026-11-27",
  referenceNumber: "12",
  sourceAccountId: "bank",
  payee: "A <B>",
  postings: [
    { accountId: "ads", type: "DEBIT", amount: 1105.07 },
    { accountId: "bank", type: "CREDIT", amount: 1105.07 }
  ]
} as unknown as Transaction;

describe("amountInWords", () => {
  test("writes dollars and cents", () => {
    expect(amountInWords(0.5)).toBe("Zero and 50/100");
    expect(amountInWords(21)).toBe("Twenty-One and 00/100");
    expect(amountInWords(1105.07)).toBe("One Thousand One Hundred Five and 07/100");
    expect(amountInWords(2000000)).toBe("Two Million and 00/100");
  });
});

describe("transactionPrintHtml", () => {
  test("prints a check with the written amount, escaping names", () => {
    const html = transactionPrintHtml(check, accounts, "Acme", "check");
    expect(html).toContain("One Thousand One Hundred Five and 07/100");
    expect(html).toContain("A &lt;B&gt;");
    expect(html).toContain("Advertising");
    expect(html).not.toContain("A <B>");
  });

  test("lists debits and credits for a journal entry", () => {
    const html = transactionPrintHtml({ ...check, type: "JOURNAL_ENTRY" }, accounts, "Acme");
    expect(html).toContain("Debits");
    expect(html).toContain("Total $1,105.07");
  });
});
