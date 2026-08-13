"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";
import { useTenant } from "@/lib/tenant/tenant-provider";

export type Company = {
  name: string;
  isPrimary: boolean;
  isActive: boolean;
  updatedAt: string;
};

export type CompanyTemplate = {
  id: string;
  label: string;
  description: string;
};

// At most one of templateId / duplicateFromName; omitting both creates a
// blank company (PLAINGL_FEATURES_TO_IMPLEMENT.md #13).
export type CreateCompanyInput = {
  name: string;
  templateId?: string;
  duplicateFromName?: string;
};

type CompanyContextValue = {
  companies: Company[];
  templates: CompanyTemplate[];
  activeCompany: Company | null;
  loading: boolean;
  error: string | null;
  isSwitching: boolean;
  switchCompany: (name: string) => Promise<void>;
  createCompany: (input: CreateCompanyInput) => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue>({
  companies: [],
  templates: [],
  activeCompany: null,
  loading: true,
  error: null,
  isSwitching: false,
  switchCompany: async () => {},
  createCompany: async () => {}
});

type CompanyProviderProps = Readonly<{
  children: ReactNode;
}>;

/**
 * Phase A (multi-company support, see newgl-specs/INSTANCE_ARCHITECTURE_PLAN.md).
 * Waits for TenantProvider's bootstrap to finish before fetching -- the
 * caller needs an existing membership for GET /api/companies to succeed.
 */
export function CompanyProvider({ children }: CompanyProviderProps) {
  const { tenant, loading: tenantLoading } = useTenant();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [templates, setTemplates] = useState<CompanyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await request<Company[]>(BASE_API_URL, "/companies");
      setCompanies(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load companies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tenantLoading || !tenant) return;
    load();
    // Static per session, not tied to the active company -- fetched once
    // alongside the company list rather than re-fetched on every switch.
    request<CompanyTemplate[]>(BASE_API_URL, "/company-templates")
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, [tenantLoading, tenant, load]);

  async function switchCompany(name: string) {
    setIsSwitching(true);
    await request(BASE_API_URL, `/companies/${encodeURIComponent(name)}/switch`, { method: "POST" });
    // Full reload, not just refetching companies -- every other piece of
    // page state (accounts, transactions, register, reports) was fetched
    // under the old active company and has no mechanism to know it's now
    // stale. Same teardown approach top-header.tsx uses for sign-out.
    window.location.reload();
  }

  async function createCompany(input: CreateCompanyInput) {
    await request<Company>(BASE_API_URL, "/companies", { method: "POST", body: JSON.stringify(input) });
    await load();
  }

  const activeCompany = companies.find((company) => company.isActive) ?? null;

  return (
    <CompanyContext.Provider
      value={{ companies, templates, activeCompany, loading, error, isSwitching, switchCompany, createCompany }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  return useContext(CompanyContext);
}
