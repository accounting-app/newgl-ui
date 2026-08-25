"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

type LedgerVersion = {
  version: number;
  contentHash: string;
  source: "app" | "upload" | "bootstrap" | "restore";
  createdBy: string | null;
  createdAt: string;
};

const SOURCE_LABELS: Record<LedgerVersion["source"], string> = {
  app: "Edited in app",
  upload: "Uploaded",
  bootstrap: "Starter ledger",
  restore: "Restored"
};

type LedgerVersionHistoryProps = {
  ledgerName: string;
  /** Called after a successful restore so the file list's "updated" timestamp stays in sync. */
  onRestored?: () => void;
};

export function LedgerVersionHistory({ ledgerName, onRestored }: LedgerVersionHistoryProps) {
  const [versions, setVersions] = useState<LedgerVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const loadVersions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await request<LedgerVersion[]>(BASE_API_URL, `/ledgers/${encodeURIComponent(ledgerName)}/versions`);
      setVersions(result);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load version history");
    } finally {
      setLoading(false);
    }
  }, [ledgerName]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  async function handleRestore(version: number) {
    setRestoringVersion(version);
    setRestoreError(null);
    try {
      await request(BASE_API_URL, `/ledgers/${encodeURIComponent(ledgerName)}/versions/${version}/restore`, {
        method: "POST"
      });
      await loadVersions();
      onRestored?.();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Could not restore this version");
    } finally {
      setRestoringVersion(null);
    }
  }

  if (loading) return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  if (loadError) return <p className="text-sm text-red-600">{loadError}</p>;
  if (versions.length === 0) return <p className="text-sm text-[var(--color-text-primary)]">No versions yet.</p>;

  return (
    <>
      {restoreError ? <p className="mb-3 text-sm text-red-600">{restoreError}</p> : null}
      <ul className="flex flex-col divide-y divide-[var(--color-divider-tertiary)]">
        {versions.map((version, index) => (
          <li key={version.version} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm text-[var(--color-text-global)]">
                Version {version.version} · {SOURCE_LABELS[version.source]}
              </p>
              <p className="text-xs text-[var(--color-text-primary)]">{new Date(version.createdAt).toLocaleString()}</p>
            </div>
            {index === 0 ? (
              <span className="text-xs text-[var(--color-text-primary)]">Current</span>
            ) : (
              <Button variant="secondary" onClick={() => handleRestore(version.version)} disabled={restoringVersion !== null}>
                {restoringVersion === version.version ? "Restoring…" : "Restore"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
