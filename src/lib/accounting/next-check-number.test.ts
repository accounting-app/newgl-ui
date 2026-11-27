import { describe, expect, test } from "bun:test";

import { nextCheckNumber } from "./next-check-number";

const entry = (refNumber: string | undefined, createdAt: string, transactionType: "CHECK" | "DEPOSIT" = "CHECK") => ({ refNumber, createdAt, transactionType });

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
