import type { AccountingStore } from "@/modules/accounting/mocks/accounting-store";

// localStorage persistence is disabled — the UI reads/writes through the GL API
// (NEXT_PUBLIC_API_URL in ui/.env). The implementation below is kept for reference.

// const STORAGE_KEY = "newgl:accounting-store";
// const STORAGE_VERSION = 1;

// type PersistedPayload = {
//   version: number;
//   store: AccountingStore;
// };

// function isBrowser(): boolean {
//   return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
// }

// function isAccountingStore(value: unknown): value is AccountingStore {
//   if (!value || typeof value !== "object") {
//     return false;
//   }
//   const candidate = value as AccountingStore;
//   return (
//     Array.isArray(candidate.accounts) &&
//     Array.isArray(candidate.chartAccounts) &&
//     Array.isArray(candidate.transactions) &&
//     Array.isArray(candidate.ledgerPostings) &&
//     Array.isArray(candidate.registerEntries)
//   );
// }

export function loadAccountingStore(): AccountingStore | null {
  return null;

  // if (!isBrowser()) {
  //   return null;
  // }

  // try {
  //   const raw = window.localStorage.getItem(STORAGE_KEY);
  //   if (!raw) {
  //     return null;
  //   }

  //   const parsed = JSON.parse(raw) as PersistedPayload;
  //   if (parsed.version !== STORAGE_VERSION || !isAccountingStore(parsed.store)) {
  //     window.localStorage.removeItem(STORAGE_KEY);
  //     return null;
  //   }

  //   return parsed.store;
  // } catch {
  //   window.localStorage.removeItem(STORAGE_KEY);
  //   return null;
  // }
}

export function saveAccountingStore(_store: AccountingStore): void {
  // localStorage disabled — persistence is handled by the backend API.
  // if (!isBrowser()) {
  //   return;
  // }

  // const payload: PersistedPayload = {
  //   version: STORAGE_VERSION,
  //   store
  // };

  // try {
  //   window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  // } catch (error) {
  //   console.error("[Accounting] Failed to persist store to localStorage:", error);
  // }
}

// let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleAccountingStorePersist(_store: AccountingStore): void {
  // localStorage disabled — persistence is handled by the backend API.
  // if (!isBrowser()) {
  //   return;
  // }

  // if (persistTimer !== null) {
  //   clearTimeout(persistTimer);
  // }

  // persistTimer = setTimeout(() => {
  //   persistTimer = null;
  //   saveAccountingStore(store);
  // }, 50);
}

export function clearAccountingStore(): void {
  // localStorage disabled.
  // if (!isBrowser()) {
  //   return;
  // }
  // window.localStorage.removeItem(STORAGE_KEY);
}
