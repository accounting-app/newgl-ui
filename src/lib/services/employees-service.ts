import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

// Employee roster/directory for the caller's CURRENTLY ACTIVE company
// (see newgl-api's employees.ts). Phase 1.5, Step 9 (final step) -- no
// pay rate, no paychecks, nothing payroll-shaped (no Payroll behind
// this, out of scope).
export type Employee = {
  id: string;
  name: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  hireDate?: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
};

export type CreateEmployeeInput = {
  name: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  hireDate?: string;
};

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & { status?: "ACTIVE" | "ARCHIVED" };

export function listEmployees(): Promise<Employee[]> {
  return request<Employee[]>(BASE_API_URL, "/employees");
}

export function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return request<Employee>(BASE_API_URL, "/employees", { method: "POST", body: JSON.stringify(input) });
}

export function updateEmployee(employeeId: string, patch: UpdateEmployeeInput): Promise<Employee> {
  return request<Employee>(BASE_API_URL, `/employees/${employeeId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  await request(BASE_API_URL, `/employees/${employeeId}`, { method: "DELETE" });
}
