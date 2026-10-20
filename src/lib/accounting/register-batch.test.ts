import { describe, expect, test } from "bun:test";

import type { RegisterEntry } from "@/modules/accounting/domain/models";
import {
  EMPTY_BATCH_FIELDS,
  EMPTY_BATCH_VALUES,
  applyMemo,
  batchLockedReason,
  buildBatchUpdates,
  isBatchSelectable,
  nextSequentialRef,
  summarizeBatchSelection,
  validateBatchEdit,
  withYear
} from "./register-batch";

function entry(overrides: Partial<RegisterEntry>): RegisterEntry {
  return {
    id: "e1",
    accountId: "bank",
    transactionId: "t1",
    transactionType: "DEPOSIT",
    refNumber: "",
    payee: "",
    accountLabel: "Sales",
    memo: "",
    deposit: 100,
    reconcileStatus: "",
    runningBalance: 0,
    date: "2026-01-10",
    status: "POSTED",
    createdAt: "2026-01-10T00:00:00Z",
    ...overrides
  } as RegisterEntry;
}

describe("selectability", () => {
  test("only pending live rows can be picked", () => {
    expect(isBatchSelectable(entry({}))).toBe(true);
    expect(isBatchSelectable(entry({ reconcileStatus: "C" }))).toBe(false);
    expect(isBatchSelectable(entry({ reconcileStatus: "R" }))).toBe(false);
    expect(isBatchSelectable(entry({ status: "VOIDED" }))).toBe(false);
    expect(batchLockedReason(entry({}))).toBeNull();
    expect(batchLockedReason(entry({ reconcileStatus: "R" }))).toContain("Reconciled");
  });
});

describe("nextSequentialRef", () => {
  test("counts up the last number and keeps zero padding", () => {
    expect(nextSequentialRef("1001", 2)).toBe("1003");
    expect(nextSequentialRef("CHK-0042", 2)).toBe("CHK-0044");
    expect(nextSequentialRef("A9", 1)).toBe("A10");
    expect(nextSequentialRef("INV", 3)).toBe("INV");
  });
});

describe("withYear", () => {
  test("keeps month and day, clamping Feb 29", () => {
    expect(withYear("2026-03-15", 2024)).toBe("2024-03-15");
    expect(withYear("2024-02-29", 2025)).toBe("2025-02-28");
  });
});

describe("applyMemo", () => {
  test("replace, append and prepend", () => {
    expect(applyMemo("old", "new", "replace")).toBe("new");
    expect(applyMemo("old", "new", "append")).toBe("old - new");
    expect(applyMemo("old", "new", "prepend")).toBe("new - old");
    expect(applyMemo("", "new", "append")).toBe("new");
  });
});

describe("validateBatchEdit", () => {
  test("needs a field and valid values", () => {
    expect(validateBatchEdit(EMPTY_BATCH_FIELDS, EMPTY_BATCH_VALUES, "bank")).not.toBeNull();
    expect(validateBatchEdit({ ...EMPTY_BATCH_FIELDS, date: true }, EMPTY_BATCH_VALUES, "bank")).not.toBeNull();
    expect(
      validateBatchEdit({ ...EMPTY_BATCH_FIELDS, refNo: true, refSequential: true }, { ...EMPTY_BATCH_VALUES, refNo: "ABC" }, "bank")
    ).not.toBeNull();
    expect(
      validateBatchEdit({ ...EMPTY_BATCH_FIELDS, account: true }, { ...EMPTY_BATCH_VALUES, accountId: "bank" }, "bank")
    ).not.toBeNull();
    expect(
      validateBatchEdit({ ...EMPTY_BATCH_FIELDS, memo: true, memoMode: "append" }, EMPTY_BATCH_VALUES, "bank")
    ).not.toBeNull();
    expect(
      validateBatchEdit({ ...EMPTY_BATCH_FIELDS, memo: true }, { ...EMPTY_BATCH_VALUES, memo: "x" }, "bank")
    ).toBeNull();
  });
});

describe("buildBatchUpdates", () => {
  const rows = [
    entry({ id: "c", date: "2026-01-12", memo: "third" }),
    entry({ id: "a", date: "2026-01-10", memo: "first" }),
    entry({ id: "b", date: "2026-01-11", memo: "second" })
  ];

  test("numbers refs oldest first and keeps untouched fields", () => {
    const updates = buildBatchUpdates(rows, { ...EMPTY_BATCH_FIELDS, refNo: true, refSequential: true }, { ...EMPTY_BATCH_VALUES, refNo: "0099" });
    const byId = Object.fromEntries(updates.map((update) => [update.entryId, update]));
    expect(byId.a.refNumber).toBe("0099");
    expect(byId.b.refNumber).toBe("0100");
    expect(byId.c.refNumber).toBe("0101");
    expect(byId.a.memo).toBe("first");
    expect(byId.a.date).toBe("2026-01-10");
  });

  test("change year only, memo append, account and cleared", () => {
    const updates = buildBatchUpdates(
      rows,
      { ...EMPTY_BATCH_FIELDS, date: true, dateYearOnly: true, memo: true, memoMode: "append", account: true, reconcileStatus: true },
      { ...EMPTY_BATCH_VALUES, date: "2025-06-01", memo: "fix", accountId: "acct", reconcileStatus: "C" }
    );
    expect(updates[0].date).toBe("2025-01-12");
    expect(updates[0].memo).toBe("third - fix");
    expect(updates[0].counterpartyAccountId).toBe("acct");
    expect(updates[0].reconcileStatus).toBe("C");
  });
});

describe("summarizeBatchSelection", () => {
  test("totals payments and deposits", () => {
    const summary = summarizeBatchSelection([entry({ deposit: 10.1 }), entry({ deposit: undefined, payment: 5.2 })]);
    expect(summary).toEqual({ count: 2, paymentTotal: 5.2, depositTotal: 10.1 });
  });
});
