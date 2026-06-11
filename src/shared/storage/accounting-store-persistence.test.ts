import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { AccountingStore } from "@/modules/accounting/mocks/accounting-store";
import { createMockAccountingServices } from "@/modules/accounting/mocks/mock-services";
import {
  clearAccountingStore,
  loadAccountingStore,
  saveAccountingStore,
  scheduleAccountingStorePersist
} from "@/shared/storage/accounting-store-persistence";

const STORAGE_KEY = "newgl:accounting-store";

function createLocalStorageMock(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    }
  };
}

function installBrowserStorage(): void {
  const localStorage = createLocalStorageMock();
  globalThis.localStorage = localStorage;
  globalThis.window = { localStorage } as Window & typeof globalThis;
}

function createMinimalStore(): AccountingStore {
  return {
    accounts: [],
    chartAccounts: [],
    transactions: [],
    ledgerPostings: [],
    registerEntries: []
  };
}

async function waitForPersist(delayMs = 60): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

describe("accounting-store-persistence", () => {
  beforeEach(() => {
    installBrowserStorage();
    clearAccountingStore();
  });

  afterEach(() => {
    clearAccountingStore();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  test("returns null when storage is empty", () => {
    expect(loadAccountingStore()).toBeNull();
  });

  test("round-trips a store through localStorage", () => {
    const store = createMinimalStore();
    store.accounts.push({
      id: "11111111-1111-4111-8111-111111111111",
      code: "1000",
      name: "Cash on hand",
      category: "BANK",
      currency: "USD",
      currentBalance: 100,
      allowManualEntries: true,
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z"
    });

    saveAccountingStore(store);

    const loaded = loadAccountingStore();
    expect(loaded).not.toBeNull();
    expect(loaded?.accounts).toHaveLength(1);
    expect(loaded?.accounts[0]?.name).toBe("Cash on hand");
    expect(loaded?.accounts[0]?.currentBalance).toBe(100);
  });

  test("rejects an unsupported storage version and clears the key", () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 999, store: createMinimalStore() })
    );

    expect(loadAccountingStore()).toBeNull();
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("rejects malformed payloads and clears the key", () => {
    globalThis.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, store: { accounts: "not-an-array" } })
    );

    expect(loadAccountingStore()).toBeNull();
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("rejects invalid JSON and clears the key", () => {
    globalThis.localStorage.setItem(STORAGE_KEY, "{not-json");

    expect(loadAccountingStore()).toBeNull();
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  test("debounces scheduled persistence writes", async () => {
    const store = createMinimalStore();

    scheduleAccountingStorePersist(store);
    scheduleAccountingStorePersist(store);
    scheduleAccountingStorePersist(store);

    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBeNull();

    await waitForPersist();

    const loaded = loadAccountingStore();
    expect(loaded).not.toBeNull();
    expect(loaded?.accounts).toHaveLength(0);
  });

  test("clearAccountingStore removes persisted data", () => {
    saveAccountingStore(createMinimalStore());
    expect(globalThis.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    clearAccountingStore();

    expect(globalThis.localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(loadAccountingStore()).toBeNull();
  });
});

describe("mock accounting services persistence", () => {
  beforeEach(() => {
    installBrowserStorage();
    clearAccountingStore();
  });

  afterEach(() => {
    clearAccountingStore();
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  test("seeds and reloads the same data from localStorage", async () => {
    const first = createMockAccountingServices();
    const firstTransactions = await first.transactionService.listTransactions();
    const firstAccounts = await first.accountService.listAccounts();

    expect(globalThis.localStorage.getItem(STORAGE_KEY)).not.toBeNull();

    const second = createMockAccountingServices();
    const secondTransactions = await second.transactionService.listTransactions();
    const secondAccounts = await second.accountService.listAccounts();

    expect(secondTransactions).toHaveLength(firstTransactions.length);
    expect(secondAccounts).toHaveLength(firstAccounts.length);
    expect(secondTransactions.map((transaction) => transaction.referenceNumber)).toEqual(
      firstTransactions.map((transaction) => transaction.referenceNumber)
    );
  });

  test("persists mutations across service re-initialization", async () => {
    const first = createMockAccountingServices();
    const cashAccount =
      (await first.accountService.listAccounts()).find((account) => account.name === "Cash on hand") ??
      null;

    expect(cashAccount).not.toBeNull();

    const entries = await first.registerService.listRegisterEntries(cashAccount!.id);
    expect(entries.length).toBeGreaterThan(0);

    const targetEntry = entries[0];
    await first.registerService.setReconcileStatus(targetEntry.id, "C");
    await waitForPersist();

    const second = createMockAccountingServices();
    const reloadedEntries = await second.registerService.listRegisterEntries(cashAccount!.id);
    const reloadedEntry = reloadedEntries.find((entry) => entry.id === targetEntry.id);

    expect(reloadedEntry?.reconcileStatus).toBe("C");
  });
});
