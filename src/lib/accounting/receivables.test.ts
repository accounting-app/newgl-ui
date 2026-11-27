import { describe, expect, test } from "bun:test";
import type { Account, Transaction } from "@/modules/accounting/domain/models";
import { findReceivableAccount, unappliedPayments } from "./receivables";

const account = (id: string, name: string, category: Account["category"]) => ({ id, name, category, status: "ACTIVE" }) as Account;
const accounts = [account("bank", "Cash", "BANK"), account("ar2", "Accounts Receivable (A/R)", "ACCOUNTS_RECEIVABLE"), account("ar", "Accounts Receivable", "ACCOUNTS_RECEIVABLE")];
const payment = (id: string, extra: Partial<Transaction> = {}, creditAccount = "ar") =>
  ({
    id,
    type: "RECEIVE_PAYMENT",
    status: "POSTED",
    payee: "John Doe",
    transactionDate: "2026-11-27",
    postings: [
      { accountId: "bank", type: "DEBIT", amount: 90 },
      { accountId: creditAccount, type: "CREDIT", amount: 90 }
    ],
    ...extra
  }) as Transaction;

describe("findReceivableAccount", () => {
  test("prefers the account the invoices API posts to", () => expect(findReceivableAccount(accounts)?.id).toBe("ar"));
  test("falls back to any receivable account", () => expect(findReceivableAccount(accounts.slice(0, 2))?.id).toBe("ar2"));
});

describe("unappliedPayments", () => {
  test("lists only the customer's posted payments that no invoice used", () => {
    const transactions = [
      payment("open"),
      payment("applied"),
      payment("voided", { status: "VOIDED" }),
      payment("other", { payee: "Jane" }),
      payment("income", {}, "bank")
    ];
    expect(unappliedPayments(transactions, accounts, new Set(["applied"]), "John Doe")).toEqual([{ id: "open", date: "2026-11-27", amount: 90 }]);
  });
});
