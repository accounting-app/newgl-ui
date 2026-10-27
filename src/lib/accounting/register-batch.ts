import type { BatchRegisterEntryUpdate } from "@/modules/accounting/application/contracts";
import type { RegisterEntry } from "@/modules/accounting/domain/models";

/**
 * Pure logic behind the register's "Batch -> Edit": which rows can be picked,
 * how each chosen field is applied, and the per-row updates sent to the API.
 * Kept free of React so every rule (change year only, sequential ref no.,
 * append/prepend memo) is unit-tested on its own.
 */

export type BatchMemoMode = "replace" | "append" | "prepend";

/** Which fields the user ticked in the "Edit" chooser, plus each one's option. */
export type BatchEditFields = {
  date: boolean;
  /** Date: keep every row's month/day and only change the year. */
  dateYearOnly: boolean;
  refNo: boolean;
  /** Ref No.: count up from the typed number instead of repeating it. */
  refSequential: boolean;
  payee: boolean;
  account: boolean;
  memo: boolean;
  memoMode: BatchMemoMode;
  reconcileStatus: boolean;
};

export type BatchEditValues = {
  date: string;
  refNo: string;
  payee: string;
  accountId: string;
  memo: string;
  /** Pending ("") or Cleared ("C") -- Reconciled only comes from finishing a reconciliation. */
  reconcileStatus: "" | "C";
};

export const EMPTY_BATCH_FIELDS: BatchEditFields = {
  date: false,
  dateYearOnly: false,
  refNo: false,
  refSequential: false,
  payee: false,
  account: false,
  memo: false,
  memoMode: "replace",
  reconcileStatus: false
};

export const EMPTY_BATCH_VALUES: BatchEditValues = {
  date: "",
  refNo: "",
  payee: "",
  accountId: "",
  memo: "",
  reconcileStatus: ""
};

export function hasBatchFieldSelected(fields: BatchEditFields): boolean {
  return fields.date || fields.refNo || fields.payee || fields.account || fields.memo || fields.reconcileStatus;
}

/**
 * Only pending, live rows can be batch-edited or batch-deleted: the API
 * locks cleared and reconciled entries (a reversal is the correct fix there),
 * and voided/deleted rows are history.
 */
export function isBatchSelectable(entry: Pick<RegisterEntry, "reconcileStatus" | "status">): boolean {
  return entry.reconcileStatus === "" && entry.status !== "VOIDED" && entry.status !== "DELETED";
}

/** Why a row can't be picked, for its checkbox tooltip. */
export function batchLockedReason(entry: Pick<RegisterEntry, "reconcileStatus" | "status">): string | null {
  if (isBatchSelectable(entry)) return null;
  if (entry.status === "VOIDED" || entry.status === "DELETED") return "Voided or deleted transactions can't be changed.";
  return entry.reconcileStatus === "R"
    ? "Reconciled transactions can't be changed in a batch."
    : "Cleared transactions can't be changed in a batch.";
}

const TRAILING_NUMBER = /(\d+)(?!.*\d)/;

/** True when the ref has a number to count up from ("1001", "CHK-0042"). */
export function hasSequenceNumber(ref: string): boolean {
  return TRAILING_NUMBER.test(ref);
}

/**
 * The ref `offset` steps after `start`: the LAST number in the text is the
 * counter, everything around it is kept, and zero-padding is preserved
 * ("CHK-0042" + 2 -> "CHK-0044", "A9" + 1 -> "A10").
 */
export function nextSequentialRef(start: string, offset: number): string {
  const match = start.match(TRAILING_NUMBER);
  if (!match || match.index === undefined) return start;
  const digits = match[1];
  const next = String(Number(digits) + offset).padStart(digits.length, "0");
  return start.slice(0, match.index) + next + start.slice(match.index + digits.length);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `entryDate` (YYYY-MM-DD) moved to `year`, keeping month/day (Feb 29 clamps to Feb 28 in a non-leap year). */
export function withYear(entryDate: string, year: number): string {
  const [, month, day] = entryDate.split("-").map(Number);
  const clampedDay = Math.min(day, daysInMonth(year, month));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

/** The text a memo becomes. The " - " separator matches what RightTool uses. */
export function applyMemo(existing: string | undefined, text: string, mode: BatchMemoMode): string {
  const current = existing ?? "";
  if (mode === "append") return current ? `${current} - ${text}` : text;
  if (mode === "prepend") return current ? `${text} - ${current}` : text;
  return text;
}

/** First problem with the chosen fields/values, or null when the batch is ready to confirm. */
export function validateBatchEdit(
  fields: BatchEditFields,
  values: BatchEditValues,
  registerAccountId: string
): string | null {
  if (!hasBatchFieldSelected(fields)) return "Choose at least one field to edit.";
  if (fields.date && !/^\d{4}-\d{2}-\d{2}$/.test(values.date)) {
    return fields.dateYearOnly ? "Enter a date to take the year from." : "Enter the new date.";
  }
  if (fields.refNo) {
    if (!values.refNo.trim()) return "Enter the new Ref No.";
    if (fields.refSequential && !hasSequenceNumber(values.refNo)) {
      return "To change Ref No. sequentially, start from a number (for example 1001).";
    }
  }
  if (fields.payee && !values.payee.trim()) return "Choose the new payee.";
  if (fields.account) {
    if (!values.accountId) return "Choose the new account.";
    if (values.accountId === registerAccountId) return "An account can't be its own offset account.";
  }
  if (fields.memo && fields.memoMode !== "replace" && !values.memo.trim()) {
    return "Enter the memo text to add.";
  }
  return null;
}

/** Oldest first -- the order sequential numbers are handed out in. */
function chronological(a: RegisterEntry, b: RegisterEntry): number {
  return `${a.date}-${a.createdAt}`.localeCompare(`${b.date}-${b.createdAt}`);
}

/**
 * One full update per selected row, starting from each row's current values
 * and overwriting only the ticked fields. The API replaces date/ref/payee/
 * memo wholesale, so untouched fields must be sent back unchanged.
 */
export function buildBatchUpdates(
  entries: RegisterEntry[],
  fields: BatchEditFields,
  values: BatchEditValues
): BatchRegisterEntryUpdate[] {
  const sequenceIndex = new Map<string, number>();
  [...entries].sort(chronological).forEach((entry, index) => sequenceIndex.set(entry.id, index));
  const targetYear = fields.date && fields.dateYearOnly ? Number(values.date.slice(0, 4)) : null;

  return entries.map((entry) => {
    let date = entry.date;
    if (fields.date) date = targetYear !== null ? withYear(entry.date, targetYear) : values.date;

    let refNumber = entry.refNumber;
    if (fields.refNo) {
      refNumber = fields.refSequential
        ? nextSequentialRef(values.refNo.trim(), sequenceIndex.get(entry.id) ?? 0)
        : values.refNo.trim();
    }

    const update: BatchRegisterEntryUpdate = {
      entryId: entry.id,
      date,
      refNumber,
      payee: fields.payee ? values.payee.trim() : entry.payee,
      memo: fields.memo ? applyMemo(entry.memo, values.memo.trim(), fields.memoMode) : entry.memo
    };
    if (fields.account) update.counterpartyAccountId = values.accountId;
    if (fields.reconcileStatus) update.reconcileStatus = values.reconcileStatus;
    return update;
  });
}

export type BatchSelectionSummary = { count: number; paymentTotal: number; depositTotal: number };

/** What the confirmation dialog quotes: how many rows and the money they move. */
export function summarizeBatchSelection(entries: RegisterEntry[]): BatchSelectionSummary {
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    count: entries.length,
    paymentTotal: round(entries.reduce((sum, entry) => sum + (entry.payment ?? 0), 0)),
    depositTotal: round(entries.reduce((sum, entry) => sum + (entry.deposit ?? 0), 0))
  };
}
