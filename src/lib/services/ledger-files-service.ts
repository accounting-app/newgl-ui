import { BASE_API_URL } from "@/configuration";
import { getAccessToken, request } from "@/lib/services/http-service-container";

// Extra .bean files scoped to the caller's CURRENTLY ACTIVE company (see
// newgl-api's ledger-files.ts) -- separate from that company's own primary
// content, which still goes through /api/ledgers/{name}/... as before.
export type LedgerFile = {
  id: string;
  name: string;
  label?: string;
  version: number;
  contentHash: string;
  updatedAt: string;
};

export type LedgerFileSummary = {
  id: string;
  name: string;
  label?: string;
  version: number;
  contentHash: string;
  transactionCount: number;
  accountCount: number;
};

export type LedgerFileVersion = {
  version: number;
  contentHash: string;
  source: "upload" | "bootstrap" | "restore";
  createdBy: string | null;
  createdAt: string;
};

export function listLedgerFiles(): Promise<LedgerFile[]> {
  return request<LedgerFile[]>(BASE_API_URL, "/ledger-files");
}

export function createLedgerFile(input: { name: string; label?: string; content: string }): Promise<LedgerFile> {
  return request<LedgerFile>(BASE_API_URL, "/ledger-files", { method: "POST", body: JSON.stringify(input) });
}

export function updateLedgerFileLabel(fileId: string, label: string | null): Promise<LedgerFile> {
  return request<LedgerFile>(BASE_API_URL, `/ledger-files/${fileId}`, {
    method: "PATCH",
    body: JSON.stringify({ label })
  });
}

export async function deleteLedgerFile(fileId: string): Promise<void> {
  await request(BASE_API_URL, `/ledger-files/${fileId}`, { method: "DELETE" });
}

export async function downloadLedgerFile(fileId: string): Promise<string> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE_API_URL}/ledger-files/${fileId}/download`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
  });
  if (!response.ok) throw new Error(`Could not load this file (${response.status})`);
  return response.text();
}

export async function uploadLedgerFile(fileId: string, content: string): Promise<LedgerFileSummary> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${BASE_API_URL}/ledger-files/${fileId}/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: content
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Save failed (${response.status})`);
  }
  return response.json() as Promise<LedgerFileSummary>;
}

export function listLedgerFileVersions(fileId: string): Promise<LedgerFileVersion[]> {
  return request<LedgerFileVersion[]>(BASE_API_URL, `/ledger-files/${fileId}/versions`);
}

export function restoreLedgerFileVersion(fileId: string, version: number): Promise<LedgerFileSummary> {
  return request<LedgerFileSummary>(BASE_API_URL, `/ledger-files/${fileId}/versions/${version}/restore`, {
    method: "POST"
  });
}
