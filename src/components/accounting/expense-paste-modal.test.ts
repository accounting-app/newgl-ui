import { describe, expect, test } from "bun:test";

import { matchCategory, parsePastedRows } from "./expense-paste-modal";

const accounts = [
  { id: "1", name: "Office Expenses" },
  { id: "2", name: "Officer Wages" },
  { id: "3", name: "Utilities:Phone" }
];

describe("matchCategory", () => {
  test("exact ignores case and spacing", () => {
    expect(matchCategory("  office   expenses ", accounts)).toMatchObject({ kind: "exact", accountId: "1" });
  });
  test("partial prefers whole words over substrings", () => {
    expect(matchCategory("Office", accounts)).toMatchObject({ kind: "partial", accountId: "1" });
    expect(matchCategory("phone", accounts)).toMatchObject({ kind: "partial", accountId: "3" });
  });
  test("no match for unrelated text or empty", () => {
    expect(matchCategory("Nonsense", accounts).kind).toBe("none");
    expect(matchCategory("", accounts).kind).toBe("none");
  });
});

describe("parsePastedRows", () => {
  test("reads tab and comma rows and strips currency", () => {
    expect(parsePastedRows('Office\tPaper\t$1,010.50\n"Utilities",Phone,20')).toEqual([
      { category: "Office", description: "Paper", amount: "1010.50" },
      { category: "Utilities", description: "Phone", amount: "20" }
    ]);
  });
});
