import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";
import type { Tenant } from "@/lib/tenant/tenant-provider";

export type OnboardingInput = {
  companyName: string;
  industry: string | null;
  companySize: string | null;
  country: string | null;
  baseCurrency: string;
};

/** The onboarding wizard's final "Finish" step -- always a full submit of every field at once. */
export function completeOnboarding(input: OnboardingInput): Promise<Tenant> {
  return request<Tenant>(BASE_API_URL, "/tenants/onboarding", {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}
