import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

// Bills for the caller's CURRENTLY ACTIVE company (see newgl-api's
// bills.ts). Phase 1.5, Step 3 -- the first Expenses & Bills domain that
// also posts real beancount transactions: creating a bill posts Dr
// Expense / Cr Accounts Payable immediately, paying it posts Dr Accounts
// Payable / Cr Cash-or-Bank.
export type BillStatus = "DRAFT" | "OPEN" | "PAID";

export type Bill = {
  id: string;
  vendorId: string;
  billNumber?: string;
  billDate: string;
  dueDate: string;
  amount: number;
  categoryAccountId: string;
  memo?: string;
  status: BillStatus;
  postedTransactionId?: string;
  paymentTransactionId?: string;
  createdAt: string;
};

export type CreateBillInput = {
  vendorId: string;
  billNumber?: string;
  billDate: string;
  dueDate: string;
  amount: number;
  categoryAccountId: string;
  memo?: string;
};

export type UpdateBillInput = Partial<CreateBillInput>;

export type PayBillInput = {
  paymentAccountId: string;
  paymentDate?: string;
};

export function listBills(): Promise<Bill[]> {
  return request<Bill[]>(BASE_API_URL, "/bills");
}

export function createBill(input: CreateBillInput): Promise<Bill> {
  return request<Bill>(BASE_API_URL, "/bills", { method: "POST", body: JSON.stringify(input) });
}

export function updateBill(billId: string, patch: UpdateBillInput): Promise<Bill> {
  return request<Bill>(BASE_API_URL, `/bills/${billId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function payBill(billId: string, input: PayBillInput): Promise<Bill> {
  return request<Bill>(BASE_API_URL, `/bills/${billId}/pay`, { method: "POST", body: JSON.stringify(input) });
}

export async function deleteBill(billId: string): Promise<void> {
  await request(BASE_API_URL, `/bills/${billId}`, { method: "DELETE" });
}
