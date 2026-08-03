"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsCard } from "@/components/settings/settings-card";
import { BASE_API_URL, PRIMARY_LEDGER_NAME } from "@/configuration";
import { getAccessToken, request } from "@/lib/services/http-service-container";

type LedgerVersion = {
  version: number;
  contentHash: string;
  source: "app" | "upload" | "bootstrap" | "restore";
  createdBy: string | null;
  createdAt: string;
};

type LedgerSummary = {
  name: string;
  version: number;
  contentHash: string;
  transactionCount: number;
  accountCount: number;
};

const SOURCE_LABELS: Record<LedgerVersion["source"], string> = {
  app: "Edited in app",
  upload: "Uploaded",
  bootstrap: "Starter ledger",
  restore: "Restored"
};

export default function LedgerSettingsPage() {
  const [versions, setVersions] = useState<LedgerVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await request<LedgerVersion[]>(BASE_API_URL, `/ledgers/${PRIMARY_LEDGER_NAME}/versions`);
      setVersions(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load version history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${BASE_API_URL}/ledgers/${PRIMARY_LEDGER_NAME}/download`, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
      });
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const text = await response.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${PRIMARY_LEDGER_NAME}.bean`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Could not download the ledger");
    } finally {
      setDownloading(false);
    }
  }

  async function handleUploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    setUploadNotice(null);
    try {
      const content = await file.text();
      const accessToken = await getAccessToken();
      const response = await fetch(`${BASE_API_URL}/ledgers/${PRIMARY_LEDGER_NAME}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: content
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Upload failed (${response.status})`);
      }
      const summary = (await response.json()) as LedgerSummary;
      setUploadNotice(
        `Uploaded — now version ${summary.version} (${summary.transactionCount} transactions, ${summary.accountCount} accounts).`
      );
      await loadVersions();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not upload this file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRestore(version: number) {
    setRestoringVersion(version);
    setRestoreError(null);
    try {
      await request(BASE_API_URL, `/ledgers/${PRIMARY_LEDGER_NAME}/versions/${version}/restore`, {
        method: "POST"
      });
      await loadVersions();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Could not restore this version");
    } finally {
      setRestoringVersion(null);
    }
  }

  return (
    <>
      <SettingsCard
        title="Your .bean file"
        description="Download your ledger to edit it directly, or upload a replacement. Uploads are validated before anything is saved — a malformed file is rejected and your current ledger is left untouched."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={handleDownload} disabled={downloading}>
            {downloading ? "Downloading…" : "Download"}
          </Button>

          <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".bean,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleUploadFile(file);
            }}
          />
        </div>
        {downloadError ? <p className="mt-2 text-sm text-red-600">{downloadError}</p> : null}
        {uploadError ? <p className="mt-2 text-sm text-red-600">{uploadError}</p> : null}
        {uploadNotice ? <p className="mt-2 text-sm text-[var(--color-text-primary)]">{uploadNotice}</p> : null}
      </SettingsCard>

      <SettingsCard title="Version history" description="Every replace creates a new version. Restoring adds a new version too, so history is never lost.">
        {loading ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-[var(--color-text-primary)]">No versions yet.</p>
        ) : (
          <>
            {restoreError ? <p className="mb-3 text-sm text-red-600">{restoreError}</p> : null}
            <ul className="flex flex-col divide-y divide-[var(--color-divider-tertiary)]">
              {versions.map((version, index) => (
                <li key={version.version} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm text-[var(--color-text-global)]">
                      Version {version.version} · {SOURCE_LABELS[version.source]}
                    </p>
                    <p className="text-xs text-[var(--color-text-primary)]">
                      {new Date(version.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {index === 0 ? (
                    <span className="text-xs text-[var(--color-text-primary)]">Current</span>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => handleRestore(version.version)}
                      disabled={restoringVersion !== null}
                    >
                      {restoringVersion === version.version ? "Restoring…" : "Restore"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </SettingsCard>
    </>
  );
}
