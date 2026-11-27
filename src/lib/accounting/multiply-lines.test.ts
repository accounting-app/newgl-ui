import { describe, expect, test } from "bun:test";

import { multiplyLines } from "./multiply-lines";

const line = (debit: string, credit: string) => ({ debit, credit });

describe("multiplyLines", () => {
  test("takes a percentage of every amount and leaves blanks blank", () => {
    expect(multiplyLines([line("20.00", ""), line("", "20.00")], 50)).toEqual([line("10.00", ""), line("", "10.00")]);
  });

  test("keeps a balanced entry balanced when rounding", () => {
    expect(multiplyLines([line("0.01", ""), line("0.01", ""), line("", "0.02")], 50)).toEqual([line("0.01", ""), line("0.01", ""), line("", "0.02")]);
  });
});
