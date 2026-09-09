"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createMileageEntry,
  deleteMileageEntry,
  listMileageEntries,
  type CreateMileageEntryInput,
  type MileageEntry
} from "@/lib/services/mileage-service";

/**
 * Real, API-backed mileage log -- Phase 1.5, Step 2 (see
 * newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md). Same
 * shape/rationale as use-vendors.ts: mirrors useLocalCollection's
 * `{items, hydrated, add, remove}` contract so the Mileage page barely
 * changed, but add/remove are real network calls now.
 */
export function useMileageEntries() {
  const [items, setItems] = useState<MileageEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const entries = await listMileageEntries();
      setItems(entries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load mileage entries");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: CreateMileageEntryInput): Promise<MileageEntry> => {
    const created = await createMileageEntry(input);
    setItems((current) => [created, ...current]);
    return created;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteMileageEntry(id);
    setItems((current) => current.filter((entry) => entry.id !== id));
  }, []);

  return { items, hydrated, error, add, remove, refresh };
}
