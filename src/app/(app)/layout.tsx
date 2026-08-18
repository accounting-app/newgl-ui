import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { TenantProvider } from "@/lib/tenant/tenant-provider";
import { CompanyProvider } from "@/lib/company/company-provider";
import { ToastProvider } from "@/components/ui/toast/toast-provider";

type AppGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Everything under (app) is an authenticated page -- middleware.ts already
// guarantees a session exists by the time this renders. TenantProvider makes
// the current tenant/plan available to any component without re-fetching.
// CompanyProvider nests inside it -- it needs bootstrap to have already run.
// ToastProvider wraps everything so useToast() works from any page.
export default function AppGroupLayout({ children }: AppGroupLayoutProps) {
  return (
    <ToastProvider>
      <TenantProvider>
        <CompanyProvider>
          <AppShell>{children}</AppShell>
        </CompanyProvider>
      </TenantProvider>
    </ToastProvider>
  );
}
