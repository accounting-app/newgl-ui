import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

// Vendor directory for the caller's CURRENTLY ACTIVE company (see
// newgl-api's vendors.ts). Phase 1.5, Step 1 -- replaces the Phase-1
// localStorage stand-in for this one domain; Bills/Mileage/Receipts stay
// local until their own steps.
export type Vendor = {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  defaultExpenseAccountId?: string;
  is1099Contractor: boolean;
  /** Whether this contractor's W-9 has actually been collected -- matches QBO's own "W-9 status" column on the 1099s screen. */
  w9Received: boolean;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
};

export type CreateVendorInput = {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  defaultExpenseAccountId?: string;
  is1099Contractor?: boolean;
  w9Received?: boolean;
};

export type UpdateVendorInput = Partial<CreateVendorInput> & { status?: "ACTIVE" | "ARCHIVED" };

export function listVendors(): Promise<Vendor[]> {
  return request<Vendor[]>(BASE_API_URL, "/vendors");
}

export function createVendor(input: CreateVendorInput): Promise<Vendor> {
  return request<Vendor>(BASE_API_URL, "/vendors", { method: "POST", body: JSON.stringify(input) });
}

export function updateVendor(vendorId: string, patch: UpdateVendorInput): Promise<Vendor> {
  return request<Vendor>(BASE_API_URL, `/vendors/${vendorId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteVendor(vendorId: string): Promise<void> {
  await request(BASE_API_URL, `/vendors/${vendorId}`, { method: "DELETE" });
}
