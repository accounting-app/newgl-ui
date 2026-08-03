import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { TenantProvider } from "@/lib/tenant/tenant-provider";

type AppGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Everything under (app) is an authenticated page -- middleware.ts already
// guarantees a session exists by the time this renders. TenantProvider makes
// the current tenant/plan available to any component without re-fetching.
export default function AppGroupLayout({ children }: AppGroupLayoutProps) {
  return (
    <TenantProvider>
      <AppShell>{children}</AppShell>
    </TenantProvider>
  );
}
