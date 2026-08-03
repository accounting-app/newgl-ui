"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

export type Tenant = {
  id: string;
  name: string;
  planId: string;
  aiEnabled: boolean;
};

type TenantContextValue = {
  tenant: Tenant | null;
  loading: boolean;
  error: string | null;
  setTenant: (tenant: Tenant) => void;
};

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  loading: true,
  error: null,
  setTenant: () => {}
});

type TenantProviderProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Runs POST /api/tenants/bootstrap once per mount -- idempotent server-side
 * (AI_INTEGRATION_PLAN.md Part 3), so this is what turns a returning user's
 * session into a working set of books, not just a first-signup thing.
 * Bootstrap's response already has everything GET /api/tenants/me would
 * return, so this uses that directly rather than firing a second request;
 * /me stays available for anything that wants a read-only re-fetch later
 * (e.g. a settings page) without re-running bootstrap's create-if-missing
 * check.
 */
export function TenantProvider({ children }: TenantProviderProps) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    request<Tenant>(BASE_API_URL, "/tenants/bootstrap", { method: "POST" })
      .then((result) => {
        if (!cancelled) setTenant(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load your account");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <TenantContext.Provider value={{ tenant, loading, error, setTenant }}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
