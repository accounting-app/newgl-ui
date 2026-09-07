import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

// Estimates for the caller's CURRENTLY ACTIVE company (see newgl-api's
// estimates.ts). Phase 1.5, Step 8 -- metadata-only, no ledger impact.
export type EstimateStatus = "OPEN" | "ACCEPTED" | "DECLINED";

export type Estimate = {
  id: string;
  customerId: string;
  productServiceId?: string;
  estimateNumber?: string;
  estimateDate: string;
  expirationDate?: string;
  amount: number;
  memo?: string;
  status: EstimateStatus;
  createdAt: string;
};

export type CreateEstimateInput = {
  customerId: string;
  productServiceId?: string;
  estimateNumber?: string;
  estimateDate: string;
  expirationDate?: string;
  amount: number;
  memo?: string;
};

export type UpdateEstimateInput = Partial<CreateEstimateInput> & { status?: EstimateStatus };

export function listEstimates(): Promise<Estimate[]> {
  return request<Estimate[]>(BASE_API_URL, "/estimates");
}

export function createEstimate(input: CreateEstimateInput): Promise<Estimate> {
  return request<Estimate>(BASE_API_URL, "/estimates", { method: "POST", body: JSON.stringify(input) });
}

export function updateEstimate(estimateId: string, patch: UpdateEstimateInput): Promise<Estimate> {
  return request<Estimate>(BASE_API_URL, `/estimates/${estimateId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteEstimate(estimateId: string): Promise<void> {
  await request(BASE_API_URL, `/estimates/${estimateId}`, { method: "DELETE" });
}
