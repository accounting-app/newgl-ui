import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { TenantProvider } from "@/lib/tenant/tenant-provider";
import { CompanyProvider } from "@/lib/company/company-provider";
import { ConfirmDialogHost } from "@/components/ui/confirm-dialog";
import { ToastProvider } from "@/components/ui/toast/toast-provider";

type AppGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Everything under (app) is an authenticated page -- middleware.ts already
// guarantees a session exists by the time this renders. TenantProvider makes
// the current tenant/plan available to any component without re-fetching.
// OnboardingGate sits right inside it -- nothing past this point renders
// until the tenant has completed /onboarding once. CompanyProvider nests
// inside that -- it needs bootstrap to have already run. ToastProvider
// wraps everything so useToast() works from any page.
export default function AppGroupLayout({ children }: AppGroupLayoutProps) {
  return (
    <ToastProvider>
      <TenantProvider>
        <OnboardingGate>
          <CompanyProvider>
            <AppShell>{children}</AppShell>
            <ConfirmDialogHost />
          </CompanyProvider>
        </OnboardingGate>
      </TenantProvider>
    </ToastProvider>
  );
}
