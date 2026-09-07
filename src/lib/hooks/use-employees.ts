"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
  type CreateEmployeeInput,
  type Employee,
  type UpdateEmployeeInput
} from "@/lib/services/employees-service";

/**
 * Real, API-backed employee roster -- Phase 1.5, Step 9 (final step, see
 * newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md). Same
 * shape/rationale as use-vendors.ts.
 */
export function useEmployees() {
  const [items, setItems] = useState<Employee[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const employees = await listEmployees();
      setItems(employees);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load employees");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const add = useCallback(async (input: CreateEmployeeInput): Promise<Employee> => {
    const created = await createEmployee(input);
    setItems((current) => [...current, created]);
    return created;
  }, []);

  const update = useCallback(async (id: string, patch: UpdateEmployeeInput): Promise<Employee> => {
    const updated = await updateEmployee(id, patch);
    setItems((current) => current.map((e) => (e.id === id ? updated : e)));
    return updated;
  }, []);

  const remove = useCallback(async (id: string): Promise<void> => {
    await deleteEmployee(id);
    setItems((current) => current.filter((e) => e.id !== id));
  }, []);

  return { items, hydrated, error, add, update, remove, refresh };
}
