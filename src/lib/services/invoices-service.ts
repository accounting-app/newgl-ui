import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

// Invoices for the caller's CURRENTLY ACTIVE company (see newgl-api's
// invoices.ts) -- the AR mirror of bills-service.ts. Phase 1.5, Step 7.
export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID";

export type Invoice = {
  id: string;
  customerId: string;
  productServiceId?: string;
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  memo?: string;
  status: InvoiceStatus;
  postedTransactionId?: string;
  paymentTransactionId?: string;
  createdAt: string;
};

export type CreateInvoiceInput = {
  customerId: string;
  productServiceId?: string;
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  memo?: string;
};

export type UpdateInvoiceInput = Partial<CreateInvoiceInput>;

export type PayInvoiceInput = {
  depositAccountId: string;
  paymentDate?: string;
};

export function listInvoices(): Promise<Invoice[]> {
  return request<Invoice[]>(BASE_API_URL, "/invoices");
}

export function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  return request<Invoice>(BASE_API_URL, "/invoices", { method: "POST", body: JSON.stringify(input) });
}

export function updateInvoice(invoiceId: string, patch: UpdateInvoiceInput): Promise<Invoice> {
  return request<Invoice>(BASE_API_URL, `/invoices/${invoiceId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function payInvoice(invoiceId: string, input: PayInvoiceInput): Promise<Invoice> {
  return request<Invoice>(BASE_API_URL, `/invoices/${invoiceId}/pay`, { method: "POST", body: JSON.stringify(input) });
}

export async function deleteInvoice(invoiceId: string): Promise<void> {
  await request(BASE_API_URL, `/invoices/${invoiceId}`, { method: "DELETE" });
}
