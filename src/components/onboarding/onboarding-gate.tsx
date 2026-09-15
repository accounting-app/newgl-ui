"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/lib/tenant/tenant-provider";

type OnboardingGateProps = Readonly<{
  children: ReactNode;
}>;

/**
 * The mandatory-onboarding enforcement point: nothing under (app) renders
 * until the current tenant has completed the wizard once.
 * `tenant.onboardingCompletedAt === null` is the single source of truth
 * (set by PATCH /api/tenants/onboarding -- see tenant-service.ts).
 *
 * Lives here rather than in middleware.ts because tenant lookup goes
 * through newgl-api (RLS blocks the anon key from reading `tenants`
 * directly), and TenantProvider already does that lookup once per page
 * load -- redirecting off its result avoids a second network hop on every
 * request just to check one flag.
 */
export function OnboardingGate({ children }: OnboardingGateProps) {
  const { tenant, loading } = useTenant();
  const router = useRouter();
  const needsOnboarding = !loading && tenant !== null && tenant.onboardingCompletedAt === null;

  useEffect(() => {
    if (needsOnboarding) {
      router.replace("/onboarding");
    }
  }, [needsOnboarding, router]);

  if (loading || needsOnboarding) {
    // Same "nothing to see yet" moment TenantProvider's own consumers
    // already tolerate (e.g. Organization settings' `tenantLoading` guard)
    // -- avoids a flash of the real dashboard before the redirect fires.
    return null;
  }

  return <>{children}</>;
}
