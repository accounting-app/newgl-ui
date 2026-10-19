import { describe, expect, test } from "bun:test";

import { detectDateFormat } from "@/modules/accounting/domain/parse-csv";

describe("detectDateFormat", () => {
  test("a day above 12 rules out month-first even if the AI guessed it", () => {
    expect(detectDateFormat(["01/03/2026", "15/03/2026"], "MM/dd/yyyy")).toBe("dd/MM/yyyy");
  });

  test("keeps the AI's choice when every value is valid either way", () => {
    expect(detectDateFormat(["01/03/2026", "02/03/2026"], "dd/MM/yyyy")).toBe("dd/MM/yyyy");
    expect(detectDateFormat(["01/03/2026", "02/03/2026"], "MM/dd/yyyy")).toBe("MM/dd/yyyy");
  });

  test("picks the format that parses most rows when some rows are invalid", () => {
    expect(detectDateFormat(["01-06-2026", "02-06-2026", "99-06-2026"], "dd-MM-yyyy")).toBe("dd-MM-yyyy");
    expect(detectDateFormat(["13-06-2026", "02-06-2026", "99-06-2026"], "MM-dd-yyyy")).toBe("dd-MM-yyyy");
  });

  test("returns the preferred format for an empty column and null when nothing parses", () => {
    expect(detectDateFormat(["", " "], "yyyy-MM-dd")).toBe("yyyy-MM-dd");
    expect(detectDateFormat(["not a date"], "yyyy-MM-dd")).toBeNull();
  });
});
