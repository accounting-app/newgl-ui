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

  // Persists to localStorage as its own effect reacting to `items`, not as
  // a side effect inside the state updater below -- an updater function
  // must stay pure (React can invoke it more than once for the same
  // update), so writing storage from inside one is the same anti-pattern
  // flagged elsewhere in this codebase's own react-doctor pass. Gated on
  // `hydrated` so the initial mount (items still []) never overwrites
  // whatever was already in storage before hydration finishes reading it.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Best-effort only -- private browsing, storage full, etc. This is a
      // Phase-1 stand-in, not the real persistence layer.
    }
  }, [items, storageKey, hydrated]);

  // Functional state updates, not `setItems([...items, item])` computed
  // from the `items` closure -- calling add/update/remove more than once
  // in the same tick (a seed loop, several quick clicks before a
  // re-render) used to have every call compute its result from the SAME
  // stale snapshot, so only the last call's result actually survived.
  // React applies a functional updater against whatever the previous call
  // in the same batch just produced, so this is correct under
  // looped/rapid calls too.
  const add = useCallback((item: T) => setItems((current) => [...current, item]), []);
  const update = useCallback(
    (id: string, patch: Partial<T>) => setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item))),
    []
  );
  const remove = useCallback((id: string) => setItems((current) => current.filter((item) => item.id !== id)), []);

  return { items, hydrated, add, update, remove };
}

/**
 * Same Phase-1 localStorage-backed persistence as useLocalCollection, but
 * for a single arbitrary JSON value instead of an `{id}`-keyed collection --
 * e.g. a screen's saved widget layout or favorited-actions list. Returns
 * `hydrated` so callers can avoid rendering a default before the real
 * stored value (if any) has been read.
 */
export function usePersistedJSON<T>(storageKey: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
    try {
      const raw = window.localStorage.getItem(storageKey);
      setValue(raw ? (JSON.parse(raw) as T) : initialValue);
    } catch {
      setValue(initialValue);
    } finally {
      setHydrated(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Best-effort only -- private browsing, storage full, etc.
    }
  }, [value, storageKey, hydrated]);

  return [value, setValue, hydrated] as const;
}

/** `localStorage` key scoped to one company's data, for a given domain (e.g. "vendors", "bills"). */
export function companyScopedKey(companyName: string, domain: string): string {
  return `newgl:phase1:${companyName}:${domain}`;
}

/** Client-generated id for a new local-only record -- good enough for this Phase-1 stand-in, not meant to look like a real backend id. */
export function localId(): string {
  return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
