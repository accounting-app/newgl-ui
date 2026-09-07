"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createVendor,
  deleteVendor,
  listVendors,
  updateVendor,
  type CreateVendorInput,
  type UpdateVendorInput,
  type Vendor
} from "@/lib/services/vendors-service";

/**
 * Real, API-backed vendor directory -- Phase 1.5, Step 1 (see
 * newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md). Every
 * screen that reads or writes vendors (Vendors, Contractors, 1099s, Bills,
 * Expense Transactions, Receipts, Bank Transactions' payee picker) uses
 * this ONE hook rather than each independently fetching, so they always
 * agree on the same list -- there is no per-screen local copy the way
 * useLocalCollection's "vendors" key used to be read from several places.
 *
 * Shape intentionally mirrors useLocalCollection's `{items, hydrated,
 * add, update, remove}` contract so call sites barely changed; the
 * difference is these are real network calls, so add/update/remove are
 * async and take partial inputs (the server assigns id/createdAt) rather
 * than a full local record.
 */
export function useVendors() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const vendors = await listVendors();
      setItems(vendors);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load vendors");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: CreateVendorInput): Promise<Vendor> => {
    const created = await createVendor(input);
    setItems((current) => [...current, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: UpdateVendorInput): Promise<Vendor> => {
    const updated = await updateVendor(id, patch);
    setItems((current) => current.map((v) => (v.id === id ? updated : v)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteVendor(id);
    setItems((current) => current.filter((v) => v.id !== id));
  }, []);

  return { items, hydrated, error, add, update, remove, refresh };
}
