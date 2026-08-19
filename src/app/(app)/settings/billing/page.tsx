"use client";

import { Card } from "@/components/ui/card";
import { useTenant } from "@/lib/tenant/tenant-provider";

const PLAN_LABELS: Record<string, string> = {
  free: "Free"
};

export default function BillingSettingsPage() {
  const { tenant, loading, error } = useTenant();

  if (loading) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (error || !tenant) {
    return <p className="text-sm text-red-600">{error ?? "Could not load your plan"}</p>;
  }

  return (
    <Card title="Plan" description="What your account is currently on." className="mb-6">
      <p className="text-sm text-[var(--color-text-global)]">{PLAN_LABELS[tenant.planId] ?? tenant.planId} plan</p>
      <p className="mt-2 text-sm text-[var(--color-text-primary)]">
        Paid plans aren&apos;t available yet — every account is on the free plan today. You can bring your own
        Anthropic key at any time from the AI tab for unlimited AI usage.
      </p>
    </Card>
  );
}
