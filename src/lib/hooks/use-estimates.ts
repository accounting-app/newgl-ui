"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createEstimate,
  deleteEstimate,
  listEstimates,
  updateEstimate,
  type CreateEstimateInput,
  type Estimate,
  type UpdateEstimateInput
} from "@/lib/services/estimates-service";

/**
 * Real, API-backed estimates -- Phase 1.5, Step 8. Same shape/rationale
 * as use-vendors.ts and friends.
 */
export function useEstimates() {
  const [items, setItems] = useState<Estimate[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const estimates = await listEstimates();
      setItems(estimates);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load estimates");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: CreateEstimateInput): Promise<Estimate> => {
    const created = await createEstimate(input);
    setItems((current) => [created, ...current]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: UpdateEstimateInput): Promise<Estimate> => {
    const updated = await updateEstimate(id, patch);
    setItems((current) => current.map((estimate) => (estimate.id === id ? updated : estimate)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteEstimate(id);
    setItems((current) => current.filter((estimate) => estimate.id !== id));
  }, []);

  return { items, hydrated, error, add, update, remove, refresh };
}
