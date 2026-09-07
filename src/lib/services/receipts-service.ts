import { BASE_API_URL } from "@/configuration";
import { getAccessToken, request } from "@/lib/services/http-service-container";

// Receipts for the caller's CURRENTLY ACTIVE company (see newgl-api's
// receipts.ts). Phase 1.5, Step 5 -- the file itself lives in Supabase
// Storage; this is just the metadata + review fields.
export type ReceiptRecord = {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  contentType: string;
  uploadedAt: string;
  linkedTransactionId?: string;
  vendorId?: string;
  paymentAccountId?: string;
  categoryAccountId?: string;
  amount?: number;
  taxAmount?: number;
  note?: string;
};

// `null` explicitly clears a field (matches the API); `undefined`/omitted
// leaves it unchanged.
export type UpdateReceiptInput = {
  vendorId?: string | null;
  paymentAccountId?: string | null;
  categoryAccountId?: string | null;
  amount?: number | null;
  taxAmount?: number | null;
  note?: string | null;
  linkedTransactionId?: string | null;
};

export function listReceipts(): Promise<ReceiptRecord[]> {
  return request<ReceiptRecord[]>(BASE_API_URL, "/receipts");
}

// multipart/form-data, so this bypasses the shared request() helper (which
// always sends application/json) and builds the fetch call directly --
// same reasoning as ledger-files-service.ts's own upload/download
// functions.
export async function uploadReceipt(
  file: File,
  fields: { vendorId?: string; paymentAccountId?: string; categoryAccountId?: string; amount?: number; taxAmount?: number; note?: string } = {}
): Promise<ReceiptRecord> {
  const accessToken = await getAccessToken();
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) form.append(key, String(value));
  }

  const response = await fetch(`${BASE_API_URL}/receipts`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: form
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Upload failed (${response.status})`);
  }
  return response.json() as Promise<ReceiptRecord>;
}

export function updateReceipt(receiptId: string, patch: UpdateReceiptInput): Promise<ReceiptRecord> {
  return request<ReceiptRecord>(BASE_API_URL, `/receipts/${receiptId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteReceipt(receiptId: string): Promise<void> {
  await request(BASE_API_URL, `/receipts/${receiptId}`, { method: "DELETE" });
}

// The file's own URL, for an <img>/<a> to load directly -- the download
// route checks auth via the same Bearer token as everything else, so a
// plain <img src> won't carry it; call this only from contexts that can
// attach the header (e.g. fetching a blob and creating an object URL),
// mirroring downloadLedgerFile's approach.
export async function fetchReceiptFileUrl(receiptId: string): Promise<string> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE_API_URL}/receipts/${receiptId}/file`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });
  if (!response.ok) throw new Error(`Could not load this file (${response.status})`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
