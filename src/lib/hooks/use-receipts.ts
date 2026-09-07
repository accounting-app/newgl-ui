"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteReceipt,
  listReceipts,
  updateReceipt,
  uploadReceipt,
  type ReceiptRecord,
  type UpdateReceiptInput
} from "@/lib/services/receipts-service";

/**
 * Real, API-backed receipts -- Phase 1.5, Step 5 (see
 * newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md). Same
 * shape/rationale as use-vendors.ts and friends, except `add` here takes
 * a File plus optional fields (an upload), not a plain object.
 */
export function useReceipts() {
  const [items, setItems] = useState<ReceiptRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const receipts = await listReceipts();
      setItems(receipts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load receipts");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (file: File, fields?: Parameters<typeof uploadReceipt>[1]): Promise<ReceiptRecord> => {
    const created = await uploadReceipt(file, fields);
    setItems((current) => [created, ...current]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: UpdateReceiptInput): Promise<ReceiptRecord> => {
    const updated = await updateReceipt(id, patch);
    setItems((current) => current.map((receipt) => (receipt.id === id ? updated : receipt)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteReceipt(id);
    setItems((current) => current.filter((receipt) => receipt.id !== id));
  }, []);

  return { items, hydrated, error, add, update, remove, refresh };
}
