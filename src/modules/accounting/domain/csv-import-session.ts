import type { ReviewRow } from "@/modules/accounting/domain/csv-import";

export type CsvImportSession = {
  mainAccountId: string;
  rows: ReviewRow[];
};

function storageKey(accountId: string): string {
  return `newgl:csv-import-session:${accountId}`;
}

export function saveCsvImportSession(accountId: string, session: CsvImportSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(accountId), JSON.stringify(session));
  } catch {
    // storage full or unavailable — the review just won't survive a reload this time
  }
}

export function loadCsvImportSession(accountId: string): CsvImportSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CsvImportSession;
    if (!parsed || !Array.isArray(parsed.rows) || parsed.rows.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearCsvImportSession(accountId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(accountId));
  } catch {
    // ignore
  }
}
