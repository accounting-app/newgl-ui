"use client";

import { useSyncExternalStore } from "react";
import type { CategorizationSuggestion } from "@/lib/services/ai-service";

// AI suggestions for staged bank rows. Shared between the Categorize form
// (which fetches them) and the table (which shows the blue "new vendor"
// marker), and kept in localStorage so a reload doesn't spend another AI
// action on a row that was already answered. Each entry remembers what it
// was computed from; editing the payee/memo/amount makes it stale.

type Entry = { key: string; suggestion: CategorizationSuggestion };
type StoreShape = Record<string, Entry>;

const STORAGE_KEY = "newgl:bank-txn-suggestions:v1";
const EMPTY: StoreShape = {};

let cache: StoreShape | null = null;
const listeners = new Set<() => void>();

function load(): StoreShape {
  if (cache) return cache;
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as StoreShape) : {};
  } catch {
    cache = {};
  }
  return cache;
}

export function suggestionKey(input: { payee: string; memo?: string; amount: number }): string {
  return `${input.payee}|${input.memo ?? ""}|${input.amount}`;
}

export function getStoredSuggestion(txnId: string, key: string): CategorizationSuggestion | undefined {
  const entry = load()[txnId];
  return entry && entry.key === key ? entry.suggestion : undefined;
}

export function storeSuggestion(txnId: string, key: string, suggestion: CategorizationSuggestion): void {
  cache = { ...load(), [txnId]: { key, suggestion } };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // storage blocked/full: the in-memory copy still serves this visit
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Every stored suggestion by row id, re-rendering the caller when one is added. */
export function useStoredSuggestions(): StoreShape {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}
