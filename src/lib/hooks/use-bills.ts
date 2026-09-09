"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createBill,
  deleteBill,
  listBills,
  payBill,
  updateBill,
  type Bill,
  type CreateBillInput,
  type PayBillInput,
  type UpdateBillInput
} from "@/lib/services/bills-service";

/**
 * Real, API-backed bills -- Phase 1.5, Step 3 (see
 * newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md). Same
 * shape/rationale as use-vendors.ts and use-mileage-entries.ts: every
 * screen that reads bills (Bills, Vendors' open-balance summary, Expense
 * Transactions' open-bill count, the Expenses & Bills overview funnel)
 * uses this one hook rather than each independently reading a "bills"
 * localStorage key.
 */
export function useBills() {
  const [items, setItems] = useState<Bill[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const bills = await listBills();
      setItems(bills);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load bills");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: CreateBillInput): Promise<Bill> => {
    const created = await createBill(input);
    setItems((current) => [created, ...current]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: UpdateBillInput): Promise<Bill> => {
    const updated = await updateBill(id, patch);
    setItems((current) => current.map((bill) => (bill.id === id ? updated : bill)));
    return updated;
  }, []);

  const pay = useCallback(async (id: string, input: PayBillInput): Promise<Bill> => {
    const paid = await payBill(id, input);
    setItems((current) => current.map((bill) => (bill.id === id ? paid : bill)));
    return paid;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteBill(id);
    setItems((current) => current.filter((bill) => bill.id !== id));
  }, []);

  return { items, hydrated, error, add, update, pay, remove, refresh };
}
