import type { ParsedCsvRow } from "@/modules/accounting/domain/csv-import";

const EXPECTED_HEADERS = ["date", "payee", "description", "amount"];
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

function isValidCalendarDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").replace(/^\$/, "").trim();
  if (cleaned === "") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function parseCsvText(text: string): { rows: ParsedCsvRow[]; headerError: string | null } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return { rows: [], headerError: "The file is empty." };
  }

  const header = splitCsvLine(lines[0]).map((field) => field.toLowerCase());
  const headerMatches =
    header.length === EXPECTED_HEADERS.length && EXPECTED_HEADERS.every((name, index) => header[index] === name);
  if (!headerMatches) {
    return {
      rows: [],
      headerError: "Expected columns: Date, Payee, Description, Amount (in that order)."
    };
  }

  const rows: ParsedCsvRow[] = lines.slice(1).map((line, index) => {
    const [rawDate = "", rawPayee = "", rawDescription = "", rawAmount = ""] = splitCsvLine(line);
    const parseErrors: string[] = [];

    const transactionDate = isValidCalendarDate(rawDate) ? rawDate : null;
    if (!rawDate) {
      parseErrors.push("Date is required.");
    } else if (!transactionDate) {
      parseErrors.push("Date must be in YYYY-MM-DD format.");
    }

    const amount = parseAmount(rawAmount);
    if (!rawAmount) {
      parseErrors.push("Amount is required.");
    } else if (amount === null) {
      parseErrors.push("Amount is not a number.");
    } else if (amount === 0) {
      parseErrors.push("Amount must not be zero.");
    }

    return {
      clientRowId: `row-${index}-${crypto.randomUUID()}`,
      rawDate,
      rawPayee,
      rawDescription,
      rawAmount,
      transactionDate,
      payee: rawPayee,
      memo: rawDescription,
      amount,
      categoryAccountId: null,
      parseErrors
    };
  });

  return { rows, headerError: null };
}
