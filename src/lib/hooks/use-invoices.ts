"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createInvoice,
  deleteInvoice,
  listInvoices,
  payInvoice,
  updateInvoice,
  type CreateInvoiceInput,
  type Invoice,
  type PayInvoiceInput,
  type UpdateInvoiceInput
} from "@/lib/services/invoices-service";

/**
 * Real, API-backed invoices -- Phase 1.5, Step 7 (see
 * newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md). Same
 * shape/rationale as use-bills.ts, its AP mirror.
 */
export function useInvoices() {
  const [items, setItems] = useState<Invoice[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const invoices = await listInvoices();
      setItems(invoices);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load invoices");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: CreateInvoiceInput): Promise<Invoice> => {
    const created = await createInvoice(input);
    setItems((current) => [created, ...current]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: UpdateInvoiceInput): Promise<Invoice> => {
    const updated = await updateInvoice(id, patch);
    setItems((current) => current.map((invoice) => (invoice.id === id ? updated : invoice)));
    return updated;
  }, []);

  const pay = useCallback(async (id: string, input: PayInvoiceInput): Promise<Invoice> => {
    const paid = await payInvoice(id, input);
    setItems((current) => current.map((invoice) => (invoice.id === id ? paid : invoice)));
    return paid;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteInvoice(id);
    setItems((current) => current.filter((invoice) => invoice.id !== id));
  }, []);

  return { items, hydrated, error, add, update, pay, remove, refresh };
}
