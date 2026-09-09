"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
  type CreateCustomerInput,
  type Customer,
  type UpdateCustomerInput
} from "@/lib/services/customers-service";

/**
 * Real, API-backed customer directory -- Phase 1.5, Step 6 (see
 * newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md). Same
 * shape/rationale as use-vendors.ts, its AP mirror. Shared by every
 * screen that reads or writes customers (Customers, Sales Transactions,
 * Invoices, Estimates, both overviews) via useSalesData, not read
 * independently per screen.
 */
export function useCustomers() {
  const [items, setItems] = useState<Customer[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const customers = await listCustomers();
      setItems(customers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load customers");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: CreateCustomerInput): Promise<Customer> => {
    const created = await createCustomer(input);
    setItems((current) => [...current, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: UpdateCustomerInput): Promise<Customer> => {
    const updated = await updateCustomer(id, patch);
    setItems((current) => current.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteCustomer(id);
    setItems((current) => current.filter((c) => c.id !== id));
  }, []);

  return { items, hydrated, error, add, update, remove, refresh };
}
