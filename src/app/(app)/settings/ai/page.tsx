"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { SettingsCard } from "@/components/settings/settings-card";
import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";
import { setAiFeaturesEnabled } from "@/lib/services/ai-service";
import { useTenant } from "@/lib/tenant/tenant-provider";

type AiStatus = {
  keySource: "platform" | "byok";
  maskedKey: string | null;
  model: string;
  validatedAt: string | null;
};

type UsageSummary = {
  summary: {
    periodStart: string;
    totalActions: number;
    totalTokens: number;
    byKeySource: Record<string, { actions: number; tokens: number }>;
  };
  limits: { monthlyAiActions: number; monthlyTokenCap: number } | null;
};

export default function AiSettingsPage() {
  const { tenant, setTenant } = useTenant();
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState("");
  const [keyError, setKeyError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState(false);
  const [showKeyForm, setShowKeyForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [statusResult, usageResult] = await Promise.all([
        request<AiStatus>(BASE_API_URL, "/ai/status"),
        request<UsageSummary>(BASE_API_URL, "/ai/usage")
      ]);
      setStatus(statusResult);
      setUsage(usageResult);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load AI settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSaveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKeyError(null);
    setSavingKey(true);
    try {
      await request(BASE_API_URL, "/ai/key", { method: "PUT", body: JSON.stringify({ apiKey }) });
      setApiKey("");
      setShowKeyForm(false);
      await load();
    } catch (err) {
      // A rejected key must never look like it saved -- surface the
      // backend's validate-on-save error inline, don't close the form.
      setKeyError(err instanceof Error ? err.message : "Could not validate this key");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleRemoveKey() {
    setSavingKey(true);
    try {
      await request(BASE_API_URL, "/ai/key", { method: "DELETE" });
      await load();
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : "Could not remove this key");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleToggleAi() {
    if (!tenant) return;
    setIsTogglingAi(true);
    setToggleError(null);
    try {
      const updated = await setAiFeaturesEnabled(!tenant.aiEnabled);
      setTenant(updated);
    } catch (err) {
      setToggleError(err instanceof Error ? err.message : "Could not update this setting");
    } finally {
      setIsTogglingAi(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  const actionsUsed = usage?.summary.totalActions ?? 0;
  const actionsLimit = usage?.limits?.monthlyAiActions ?? null;
  const usagePercent = actionsLimit ? Math.min(100, Math.round((actionsUsed / actionsLimit) * 100)) : 0;

  return (
    <>
      <SettingsCard
        title="AI features"
        description="Turn AI suggestions off entirely -- column mapping, categorization, and payee learning all stop, and no data is sent to Anthropic."
      >
        <div className="flex items-center justify-between">
          <p className="text-sm text-[var(--color-text-global)]">
            {tenant?.aiEnabled ? "AI features are on" : "AI features are off"}
          </p>
          <Button variant="secondary" onClick={handleToggleAi} disabled={isTogglingAi || !tenant}>
            {isTogglingAi ? "Saving…" : tenant?.aiEnabled ? "Turn off" : "Turn on"}
          </Button>
        </div>
        {toggleError ? <p className="mt-2 text-sm text-red-600">{toggleError}</p> : null}
      </SettingsCard>

      <SettingsCard title="AI key" description="Bring your own Anthropic key, or use New GL's free-plan key.">
        {status?.keySource === "byok" ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-global)]">Using your key · {status.maskedKey}</p>
              <p className="text-xs text-[var(--color-text-primary)]">
                Model: {status.model}
                {status.validatedAt ? ` · validated ${new Date(status.validatedAt).toLocaleDateString()}` : ""}
              </p>
            </div>
            <Button variant="secondary" onClick={handleRemoveKey} disabled={savingKey}>
              Remove
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-global)]">Using New GL&apos;s key (free plan)</p>
              <p className="text-xs text-[var(--color-text-primary)]">Model: {status?.model}</p>
            </div>
            <Button variant="secondary" onClick={() => setShowKeyForm((value) => !value)}>
              {showKeyForm ? "Cancel" : "Add your key"}
            </Button>
          </div>
        )}

        {showKeyForm ? (
          <form onSubmit={handleSaveKey} className="mt-4 flex flex-col gap-2 border-t border-[var(--color-divider-tertiary)] pt-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-[var(--color-text-primary)]">Anthropic API key</span>
              <InputField
                type="password"
                placeholder="sk-ant-..."
                required
                minLength={20}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </label>
            {keyError ? <p className="text-sm text-red-600">{keyError}</p> : null}
            <div>
              <Button type="submit" variant="primary" disabled={savingKey}>
                {savingKey ? "Validating…" : "Save key"}
              </Button>
            </div>
          </form>
        ) : null}
      </SettingsCard>

      <SettingsCard title="Usage this period">
        {actionsLimit !== null ? (
          <>
            <div className="mb-2 flex items-baseline justify-between text-sm text-[var(--color-text-primary)]">
              <span>
                {actionsUsed} of {actionsLimit} actions used
              </span>
              <span>{usagePercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-container-background-accent)]">
              <div
                className="h-full rounded-full bg-[var(--color-link-action)]"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--color-text-primary)]">
            {actionsUsed} actions used this period — no limit applies with your own key.
          </p>
        )}
      </SettingsCard>

      <SettingsCard
        title="What we send to Anthropic"
        description="When AI suggestions run, only the fields needed for that suggestion are sent -- payee, memo, amount, and date for categorization, for example. We never send account balances or your full ledger."
      >
        <p className="text-sm text-[var(--color-text-primary)]">
          Requests go through New GL&apos;s AI service to Anthropic. If you&apos;ve added your own key, requests are
          billed to your Anthropic account instead of New GL&apos;s.
        </p>
      </SettingsCard>
    </>
  );
}
