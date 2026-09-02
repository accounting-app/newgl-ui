"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Phase-1 placeholder data layer for the QBO-parity screens (Vendors,
 * Bills, Mileage, Receipts) that don't have a real backend yet -- see
 * newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md. Persists
 * a collection of records to localStorage under a caller-supplied key.
 * Swapping this for real API calls later only touches the screen that
 * calls it, not this hook's contract (items/add/update/remove).
 *
 * Callers MUST scope `storageKey` per active company (see
 * `companyScopedKey` below) -- company data must never leak across
 * companies, the same hard constraint the real ledger_files backend
 * already enforces, and this local-only stand-in is no exception.
 */
export function useLocalCollection<T extends { id: string }>(storageKey: string) {
  const [items, setItems] = useState<T[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    try {
      const raw = window.localStorage.getItem(storageKey);
      setItems(raw ? (JSON.parse(raw) as T[]) : []);
    } catch {
      setItems([]);
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next: T[]) => {
      setItems(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Best-effort only -- private browsing, storage full, etc. This is
        // a Phase-1 stand-in, not the real persistence layer.
      }
    },
    [storageKey]
  );

  const add = useCallback((item: T) => persist([...items, item]), [items, persist]);
  const update = useCallback(
    (id: string, patch: Partial<T>) => persist(items.map((item) => (item.id === id ? { ...item, ...patch } : item))),
    [items, persist]
  );
  const remove = useCallback((id: string) => persist(items.filter((item) => item.id !== id)), [items, persist]);

  return { items, hydrated, add, update, remove };
}

/** `localStorage` key scoped to one company's data, for a given domain (e.g. "vendors", "bills"). */
export function companyScopedKey(companyName: string, domain: string): string {
  return `newgl:phase1:${companyName}:${domain}`;
}

/** Client-generated id for a new local-only record -- good enough for this Phase-1 stand-in, not meant to look like a real backend id. */
export function localId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
