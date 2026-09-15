"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useTenant } from "@/lib/tenant/tenant-provider";
import { completeOnboarding } from "@/lib/services/tenant-service";

const INDUSTRY_OPTIONS = [
  { value: "Freelancer/Consultant", label: "Freelancer / Consultant" },
  { value: "Retail", label: "Retail" },
  { value: "Restaurant/Food service", label: "Restaurant / Food service" },
  { value: "Construction/Trades", label: "Construction / Trades" },
  { value: "Professional services", label: "Professional services" },
  { value: "E-commerce", label: "E-commerce" },
  { value: "Nonprofit", label: "Nonprofit" },
  { value: "Other", label: "Other" }
];

const COMPANY_SIZE_OPTIONS = [
  { value: "Just me", label: "Just me" },
  { value: "2-10", label: "2-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "50+", label: "50+ employees" }
];

// Short, practical list rather than every country -- easy to extend later;
// this is a self-reported default, not a compliance-grade field.
const COUNTRY_OPTIONS = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "MX", label: "Mexico" },
  { value: "GB", label: "United Kingdom" },
  { value: "ES", label: "Spain" },
  { value: "Other", label: "Other" }
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "MXN", label: "MXN - Mexican Peso" }
];

const STEPS = [
  { key: "about-you", label: "About you" },
  { key: "company", label: "Your company" },
  { key: "review", label: "Review" }
] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const { tenant, loading: tenantLoading, setTenant } = useTenant();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 -- personal (Supabase auth.users.user_metadata, not the tenant).
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2 -- company (the tenant row). Prefilled from bootstrap's
  // auto-generated name once the tenant loads, editable from here on.
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [companyPrefilled, setCompanyPrefilled] = useState(false);

  useEffect(() => {
    if (tenant && !companyPrefilled) {
      setCompanyName(tenant.name);
      setCompanyPrefilled(true);
    }
  }, [tenant, companyPrefilled]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const metadata = data.user?.user_metadata;
      if (typeof metadata?.first_name === "string") setFirstName(metadata.first_name);
      if (typeof metadata?.last_name === "string") setLastName(metadata.last_name);
      if (typeof metadata?.phone === "string") setPhone(metadata.phone);
    });
  }, []);

  async function handleContinueFromAboutYou() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = createClient();
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      const { error: updateError } = await supabase.auth.updateUser({
        data: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: fullName, phone: phone.trim() || null }
      });
      if (updateError) throw updateError;
      setStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleContinueFromCompany() {
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      const updated = await completeOnboarding({
        companyName: companyName.trim(),
        industry: industry || null,
        companySize: companySize || null,
        country: country || null,
        baseCurrency: currency
      });
      setTenant(updated);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish setup. Please try again.");
      setSaving(false);
    }
  }

  if (tenantLoading || !tenant) {
    return <p className="p-10 text-center text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-12">
      <StepIndicator currentIndex={step} />

      <div className="mt-8 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-6">
        {step === 0 ? (
          <>
            <h1 className="mb-1 text-xl font-semibold text-[var(--color-text-global)]">About you</h1>
            <p className="mb-6 text-sm text-[var(--color-text-primary)]">
              So we can greet you by name instead of your email.
            </p>
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <InputField label="First name*" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="flex-1">
                  <InputField label="Last name*" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <InputField
                label="Phone (optional)"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 className="mb-1 text-xl font-semibold text-[var(--color-text-global)]">Your company</h1>
            <p className="mb-6 text-sm text-[var(--color-text-primary)]">
              A few basics that help us tailor reports and defaults to your business.
            </p>
            <div className="flex flex-col gap-4">
              <InputField label="Company name*" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <Select label="Industry" value={industry} onChange={setIndustry} options={INDUSTRY_OPTIONS} placeholder="Select an industry" allowCustomValue={false} />
              <Select label="Company size" value={companySize} onChange={setCompanySize} options={COMPANY_SIZE_OPTIONS} placeholder="Select company size" allowCustomValue={false} />
              <div className="flex gap-3">
                <div className="flex-1">
                  <Select label="Country" value={country} onChange={setCountry} options={COUNTRY_OPTIONS} placeholder="Select country" allowCustomValue={false} />
                </div>
                <div className="flex-1">
                  <Select label="Base currency" value={currency} onChange={setCurrency} options={CURRENCY_OPTIONS} placeholder="Select currency" allowCustomValue={false} />
                </div>
              </div>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="mb-1 text-xl font-semibold text-[var(--color-text-global)]">Review</h1>
            <p className="mb-6 text-sm text-[var(--color-text-primary)]">Here's what we've got -- you can always change this later in Settings.</p>
            <dl className="flex flex-col gap-3 text-sm">
              <ReviewRow label="Name" value={`${firstName} ${lastName}`.trim()} />
              {phone.trim() ? <ReviewRow label="Phone" value={phone} /> : null}
              <ReviewRow label="Company" value={companyName} />
              {industry ? <ReviewRow label="Industry" value={INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label ?? industry} /> : null}
              {companySize ? <ReviewRow label="Company size" value={companySize} /> : null}
              {country ? <ReviewRow label="Country" value={COUNTRY_OPTIONS.find((o) => o.value === country)?.label ?? country} /> : null}
              <ReviewRow label="Base currency" value={currency} />
            </dl>
          </>
        ) : null}

        {error ? <p className="mt-4 text-sm text-[var(--color-negative)]">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          {step > 0 ? (
            <Button type="button" variant="secondary" onClick={() => setStep((s) => s - 1)} disabled={saving}>
              Back
            </Button>
          ) : null}
          {step === 0 ? (
            <Button type="button" variant="primary" onClick={handleContinueFromAboutYou} disabled={saving}>
              {saving ? "Saving…" : "Continue"}
            </Button>
          ) : null}
          {step === 1 ? (
            <Button type="button" variant="primary" onClick={handleContinueFromCompany} disabled={saving}>
              Continue
            </Button>
          ) : null}
          {step === 2 ? (
            <Button type="button" variant="primary" onClick={handleFinish} disabled={saving}>
              {saving ? "Finishing…" : "Go to Dashboard"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[var(--color-divider-tertiary)] pb-2">
      <dt className="text-[var(--color-text-primary)]">{label}</dt>
      <dd className="font-medium text-[var(--color-text-global)]">{value}</dd>
    </div>
  );
}

function StepIndicator({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="flex items-center">
      {STEPS.map((s, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isDone
                    ? "bg-[var(--color-ui-primary)] text-white"
                    : isCurrent
                      ? "bg-[var(--color-action-standard)] text-white"
                      : "bg-[var(--color-container-background-secondary)] text-[var(--color-text-disabled)]"
                }`}
              >
                {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={`text-sm font-medium ${isCurrent || isDone ? "text-[var(--color-text-global)]" : "text-[var(--color-text-disabled)]"}`}
              >
                {s.label}
              </span>
            </div>
            {index < STEPS.length - 1 ? <span className="mx-3 h-px flex-1 bg-[var(--color-divider-tertiary)]" /> : null}
          </div>
        );
      })}
    </div>
  );
}
