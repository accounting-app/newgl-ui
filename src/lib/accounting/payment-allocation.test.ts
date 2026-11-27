import { describe, expect, test } from "bun:test";

import { allocationProblem, distribute, planApplications } from "./payment-allocation";

describe("distribute", () => {
  test("pays oldest first and part-pays the last one", () => {
    expect(distribute(700, [{ id: "a", open: 500 }, { id: "b", open: 500 }, { id: "c", open: 500 }])).toEqual({ a: 500, b: 200 });
  });
});

describe("planApplications", () => {
  test("uses credits before new money and splits across them", () => {
    expect(planApplications([{ id: "a", cents: 300 }, { id: "b", cents: 200 }], [{ id: "credit", available: 100 }, { id: "new", available: 900 }])).toEqual([
      { documentId: "a", sourceId: "credit", cents: 100 },
      { documentId: "a", sourceId: "new", cents: 200 },
      { documentId: "b", sourceId: "new", cents: 200 }
    ]);
  });
});

describe("allocationProblem", () => {
  const base = { noun: "invoice" as const, money: 100, payments: [{ cents: 150, open: 200 }], credits: [{ cents: 50, available: 50 }] };
  test("accepts money plus credit covering the payments", () => expect(allocationProblem(base)).toBeNull());
  test("rejects more than money plus credit", () => expect(allocationProblem({ ...base, money: 99 })).toContain("more than the amount"));
  test("rejects over-paying a document", () => expect(allocationProblem({ ...base, payments: [{ cents: 250, open: 200 }], money: 300 })).toContain("open balance"));
  test("rejects credit with nothing to pay", () => expect(allocationProblem({ ...base, payments: [] })).toContain("Credits can only"));
});
