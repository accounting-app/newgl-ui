"use client";

import { useEffect, useState } from "react";
import { SettingsCard } from "@/components/settings/settings-card";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/lib/tenant/tenant-provider";

export default function OrganizationSettingsPage() {
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  if (tenantLoading) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (tenantError || !tenant) {
    return <p className="text-sm text-red-600">{tenantError ?? "Could not load your organization"}</p>;
  }

  return (
    <SettingsCard title="Organization" description="Your account and who has access to it.">
      <dl className="flex flex-col gap-3 text-sm">
        <div>
          <dt className="text-[var(--color-text-primary)]">Organization name</dt>
          <dd className="text-[var(--color-text-global)]">{tenant.name}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-primary)]">Signed in as</dt>
          <dd className="text-[var(--color-text-global)]">{userEmail ?? "—"}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-[var(--color-text-primary)]">
        Inviting teammates isn&apos;t available yet — each organization has a single member for now.
      </p>
    </SettingsCard>
  );
}
