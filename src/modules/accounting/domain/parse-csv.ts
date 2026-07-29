import type { ColumnMapping, DateFormatOption, FormatOptions, ParsedCsvRow, SignConvention } from "@/modules/accounting/domain/csv-import";

export function splitCsvLine(line: string): string[] {
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

export function tokenizeCsvText(text: string): string[][] {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  return lines.map(splitCsvLine);
}

// Returns the raw header text per column (or "" when there's no header row / the cell is blank) —
// callers are responsible for building a display label like "Column 1: Date" from this.
export function getColumnLabels(rows: string[][], hasHeaderRow: boolean): string[] {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (hasHeaderRow && rows.length > 0) {
    const header = rows[0];
    return Array.from({ length: columnCount }, (_, index) => header[index]?.trim() ?? "");
  }
  return Array.from({ length: columnCount }, () => "");
}

const DATE_FORMAT_PATTERNS: Record<DateFormatOption, RegExp> = {
  "yyyy-MM-dd": /^(\d{4})-(\d{2})-(\d{2})$/,
  "MM/dd/yyyy": /^(\d{2})\/(\d{2})\/(\d{4})$/,
  "dd/MM/yyyy": /^(\d{2})\/(\d{2})\/(\d{4})$/,
  "MM-dd-yyyy": /^(\d{2})-(\d{2})-(\d{4})$/,
  "dd-MM-yyyy": /^(\d{2})-(\d{2})-(\d{4})$/
};

const DATE_FORMAT_FIELD_ORDER: Record<DateFormatOption, Array<"y" | "m" | "d">> = {
  "yyyy-MM-dd": ["y", "m", "d"],
  "MM/dd/yyyy": ["m", "d", "y"],
  "dd/MM/yyyy": ["d", "m", "y"],
  "MM-dd-yyyy": ["m", "d", "y"],
  "dd-MM-yyyy": ["d", "m", "y"]
};

export function parseDateWithFormat(raw: string, format: DateFormatOption): string | null {
  const match = raw.trim().match(DATE_FORMAT_PATTERNS[format]);
  if (!match) return null;
  const order = DATE_FORMAT_FIELD_ORDER[format];
  const values = { y: 0, m: 0, d: 0 };
  order.forEach((key, index) => {
    values[key] = Number(match[index + 1]);
  });
  const date = new Date(Date.UTC(values.y, values.m - 1, values.d));
  const isReal =
    date.getUTCFullYear() === values.y && date.getUTCMonth() === values.m - 1 && date.getUTCDate() === values.d;
  if (!isReal) return null;
  return `${String(values.y).padStart(4, "0")}-${String(values.m).padStart(2, "0")}-${String(values.d).padStart(2, "0")}`;
}

export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  // Accounting notation wraps negatives in parentheses, e.g. "(186.42)" or "($186.42)".
  const isParenNegative = /^\(.*\)$/.test(trimmed);
  const unwrapped = isParenNegative ? trimmed.slice(1, -1) : trimmed;

  const cleaned = unwrapped.replace(/,/g, "").replace(/\$/g, "").trim();
  if (cleaned === "") return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return isParenNegative ? -Math.abs(value) : value;
}

function cellAt(row: string[], columnIndex: number | null): string {
  if (columnIndex === null) return "";
  return row[columnIndex]?.trim() ?? "";
}

export function buildReviewRows(
  dataRows: string[][],
  mapping: ColumnMapping,
  formatOptions: FormatOptions,
  signConvention: SignConvention
): ParsedCsvRow[] {
  return dataRows.map((row, index) => {
    const rawDate = cellAt(row, mapping.dateColumn);
    const rawDescription = cellAt(row, mapping.descriptionColumn);
    const rawPayee = cellAt(row, mapping.payeeColumn);
    const parseErrors: string[] = [];

    const transactionDate = rawDate ? parseDateWithFormat(rawDate, formatOptions.dateFormat) : null;
    if (!rawDate) {
      parseErrors.push("Date is required.");
    } else if (!transactionDate) {
      parseErrors.push(`Date must match the ${formatOptions.dateFormat} format.`);
    }

    let rawAmount: string;
    let amount: number | null;

    if (formatOptions.amountColumnsMode === "SINGLE") {
      rawAmount = cellAt(row, mapping.amountColumn);
      amount = rawAmount ? parseAmount(rawAmount) : null;
      if (!rawAmount) {
        parseErrors.push("Amount is required.");
      } else if (amount === null) {
        parseErrors.push("Amount is not a number.");
      }
    } else {
      const rawDebit = cellAt(row, mapping.debitColumn);
      const rawCredit = cellAt(row, mapping.creditColumn);
      rawAmount = rawCredit || rawDebit ? `debit: ${rawDebit || "0"} / credit: ${rawCredit || "0"}` : "";
      const debit = rawDebit ? parseAmount(rawDebit) : null;
      const credit = rawCredit ? parseAmount(rawCredit) : null;

      if (rawDebit && debit === null) {
        parseErrors.push("Debit is not a number.");
        amount = null;
      } else if (rawCredit && credit === null) {
        parseErrors.push("Credit is not a number.");
        amount = null;
      } else if (!rawDebit && !rawCredit) {
        parseErrors.push("Debit or Credit is required.");
        amount = null;
      } else if ((debit ?? 0) !== 0 && (credit ?? 0) !== 0) {
        parseErrors.push("Only one of Debit or Credit should be set per row.");
        amount = null;
      } else {
        amount = (credit ?? 0) - (debit ?? 0);
      }
    }

    if (amount !== null && amount === 0) {
      parseErrors.push("Amount must not be zero.");
    }
    if (amount !== null && signConvention === "REVERSED") {
      amount = -amount;
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
}
