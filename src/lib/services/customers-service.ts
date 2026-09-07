import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

// Customer directory for the caller's CURRENTLY ACTIVE company (see
// newgl-api's customers.ts) -- the AR mirror of vendors-service.ts.
// Phase 1.5, Step 6.
export type Customer = {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
};

export type CreateCustomerInput = {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  address?: string;
};

export type UpdateCustomerInput = Partial<CreateCustomerInput> & { status?: "ACTIVE" | "ARCHIVED" };

export function listCustomers(): Promise<Customer[]> {
  return request<Customer[]>(BASE_API_URL, "/customers");
}

export function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  return request<Customer>(BASE_API_URL, "/customers", { method: "POST", body: JSON.stringify(input) });
}

export function updateCustomer(customerId: string, patch: UpdateCustomerInput): Promise<Customer> {
  return request<Customer>(BASE_API_URL, `/customers/${customerId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteCustomer(customerId: string): Promise<void> {
  await request(BASE_API_URL, `/customers/${customerId}`, { method: "DELETE" });
}
