import { describe, expect, test } from "bun:test";
import type { Account, Transaction } from "@/modules/accounting/domain/models";
import { appliedByTransaction, findReceivableAccount, unappliedPayments } from "./receivables";

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
  test("lists what the customer's posted payments have left over", () => {
    const transactions = [
      payment("open"),
      payment("applied"),
      payment("part"),
      payment("voided", { status: "VOIDED" }),
      payment("other", { payee: "Jane" }),
      payment("income", {}, "bank")
    ];
    const applied = appliedByTransaction([
      { payments: [{ transactionId: "applied", amount: 90 }, { transactionId: "part", amount: 30 }] },
      { payments: [{ transactionId: "part", amount: 20 }] }
    ]);
    expect(unappliedPayments(transactions, accounts, applied, "John Doe")).toEqual([
      { id: "open", date: "2026-11-27", original: 90, amount: 90 },
      { id: "part", date: "2026-11-27", original: 90, amount: 40 }
    ]);
  });
});

describe("unappliedPayments for a vendor", () => {
  test("reads bill payments debited to Accounts Payable", () => {
    const payable = account("ap", "Accounts Payable", "ACCOUNTS_PAYABLE");
    const billPayment = {
      ...payment("bp"),
      type: "BILL_PAYMENT",
      postings: [
        { accountId: "ap", type: "DEBIT", amount: 400 },
        { accountId: "bank", type: "CREDIT", amount: 400 }
      ]
    } as Transaction;
    expect(unappliedPayments([billPayment, payment("received")], [...accounts, payable], new Map(), "John Doe", "vendor")).toEqual([{ id: "bp", date: "2026-11-27", original: 400, amount: 400 }]);
  });
});
