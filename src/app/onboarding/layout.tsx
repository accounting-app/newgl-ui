import type { ReactNode } from "react";
import { TenantProvider } from "@/lib/tenant/tenant-provider";

type OnboardingLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Top-level route (not under (app) -- no sidebar/AppShell chrome for a
// full-bleed wizard; not under (auth) -- this requires a session).
// middleware.ts's PUBLIC_PATHS doesn't list /onboarding, so an
// unauthenticated visitor is already bounced to /login before this ever
// renders. Its own TenantProvider instance (bootstrap is idempotent, so
// running it again here is harmless) is what lets the wizard read/write
// the tenant without depending on (app)'s tree -- which itself redirects
// *away* from here once onboarding is done.
export default function OnboardingLayout({ children }: OnboardingLayoutProps) {
  return (
    <TenantProvider>
      <main className="min-h-screen bg-[var(--color-container-background-accent)]">{children}</main>
    </TenantProvider>
  );
}
