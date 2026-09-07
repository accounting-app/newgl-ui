"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createProductOrService,
  deleteProductOrService,
  listProductsServices,
  updateProductOrService,
  type CreateProductInput,
  type ProductOrService,
  type UpdateProductInput
} from "@/lib/services/products-services-service";

/**
 * Real, API-backed Products & Services catalog -- Phase 1.5, Step 6. Same
 * shape/rationale as use-vendors.ts and use-customers.ts.
 */
export function useProductsServices() {
  const [items, setItems] = useState<ProductOrService[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const products = await listProductsServices();
      setItems(products);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load products & services");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: CreateProductInput): Promise<ProductOrService> => {
    const created = await createProductOrService(input);
    setItems((current) => [...current, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: UpdateProductInput): Promise<ProductOrService> => {
    const updated = await updateProductOrService(id, patch);
    setItems((current) => current.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteProductOrService(id);
    setItems((current) => current.filter((p) => p.id !== id));
  }, []);

  return { items, hydrated, error, add, update, remove, refresh };
}
