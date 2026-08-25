"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { BASE_API_URL } from "@/configuration";
import { getAccessToken } from "@/lib/services/http-service-container";

type LedgerDownloadPanelProps = {
  ledgerName: string;
};

export function LedgerDownloadPanel({ ledgerName }: LedgerDownloadPanelProps) {
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  function exportUrl(): string {
    const params = new URLSearchParams();
    if (exportFrom) params.set("from", exportFrom);
    if (exportTo) params.set("to", exportTo);
    const query = params.toString();
    return `${BASE_API_URL}/ledgers/${encodeURIComponent(ledgerName)}/download${query ? `?${query}` : ""}`;
  }

  async function fetchExportContent(): Promise<string> {
    const accessToken = await getAccessToken();
    const response = await fetch(exportUrl(), {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
    });
    if (!response.ok) throw new Error(`Export failed (${response.status})`);
    return response.text();
  }

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const text = await fetchExportContent();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const suffix = exportFrom || exportTo ? `_${exportFrom || "start"}_${exportTo || "end"}` : "";
      anchor.download = `${ledgerName}${suffix}.bean`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Could not download this file");
    } finally {
      setDownloading(false);
    }
  }

  async function handleCopyToClipboard() {
    setCopying(true);
    setCopyError(null);
    setCopyNotice(null);
    try {
      const text = await fetchExportContent();
      await navigator.clipboard.writeText(text);
      setCopyNotice("Copied to clipboard.");
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "Could not copy this file");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
          From
          <InputField type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
          To
          <InputField type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} />
        </label>
        <span className="pb-1.5 text-xs text-[var(--color-icon-secondary)]">
          {exportFrom || exportTo ? "Scoped to this date range" : "Leave blank for the full file"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={handleDownload} disabled={downloading}>
          {downloading ? "Downloading…" : "Download"}
        </Button>
        <Button variant="secondary" onClick={handleCopyToClipboard} disabled={copying}>
          {copying ? "Copying…" : "Copy to clipboard"}
        </Button>
      </div>
      {downloadError ? <p className="mt-2 text-sm text-red-600">{downloadError}</p> : null}
      {copyError ? <p className="mt-2 text-sm text-red-600">{copyError}</p> : null}
      {copyNotice ? <p className="mt-2 text-sm text-[var(--color-text-primary)]">{copyNotice}</p> : null}
    </div>
  );
}
