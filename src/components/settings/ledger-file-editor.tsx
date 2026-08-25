"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeanEditor } from "@/components/bean-editor/bean-editor";
import { countBeancountErrors } from "@/lib/beancount/lint";
import { BASE_API_URL } from "@/configuration";
import { getAccessToken } from "@/lib/services/http-service-container";

type LedgerSummary = {
  name: string;
  version: number;
  contentHash: string;
  transactionCount: number;
  accountCount: number;
};

type LedgerFileEditorProps = {
  /** Internal/unique ledger identifier -- used in every API call. */
  ledgerName: string;
  /** What to show in the header -- the file's label, falling back to ledgerName. */
  displayName: string;
  /** Returns to the file list. Guards against unsaved changes itself (asks the caller only after confirming). */
  onCancel: () => void;
  /** Called after a successful save so the file list's "updated" timestamp stays in sync. */
  onSaved: () => void;
};

export function LedgerFileEditor({ ledgerName, displayName, onCancel, onSaved }: LedgerFileEditorProps) {
  const [content, setContent] = useState<string | null>(null);
  const [savedContent, setSavedContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (loadedOnce.current) return;
    loadedOnce.current = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const accessToken = await getAccessToken();
        const response = await fetch(`${BASE_API_URL}/ledgers/${encodeURIComponent(ledgerName)}/download`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
        });
        if (!response.ok) throw new Error(`Could not load this file (${response.status})`);
        const text = await response.text();
        setContent(text);
        setSavedContent(text);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load this file");
      } finally {
        setLoading(false);
      }
    })();
  }, [ledgerName]);

  const isDirty = content !== null && content !== savedContent;

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const errorCount = useMemo(() => (content === null ? 0 : countBeancountErrors(content)), [content]);

  function handleDiscard() {
    if (savedContent === null) return;
    if (!window.confirm("Discard your unsaved changes?")) return;
    setContent(savedContent);
    setSaveError(null);
    setSaveNotice(null);
  }

  function handleCancel() {
    if (isDirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    onCancel();
  }

  async function handleSave() {
    if (content === null || errorCount > 0) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
      const accessToken = await getAccessToken();
      const response = await fetch(`${BASE_API_URL}/ledgers/${encodeURIComponent(ledgerName)}/upload`, {
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
      const summary = (await response.json()) as LedgerSummary;
      setSavedContent(content);
      setSaveNotice(
        `Saved — now version ${summary.version} (${summary.transactionCount} transactions, ${summary.accountCount} accounts).`
      );
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save this file");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleCancel}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-primary)]"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>
        <h1 className="flex-1 truncate text-lg font-semibold text-[var(--color-text-global)]">{displayName}</h1>
        <div className="flex items-center gap-2">
          {isDirty ? (
            <Button variant="secondary" onClick={handleDiscard} disabled={saving}>
              Discard changes
            </Button>
          ) : null}
          <Button variant="primary" onClick={handleSave} disabled={saving || errorCount > 0 || !isDirty}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <p className="mb-3 text-sm text-[var(--color-text-primary)]">
        Syntax errors are underlined as you type and block saving. This does not check things like unbalanced
        transactions or accounts that were never opened -- only syntax.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : content === null ? null : (
        <>
          <div className="min-h-0 flex-1">
            <BeanEditor value={content} onChange={setContent} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            {errorCount > 0 ? (
              <span className="text-xs text-red-600">
                {errorCount} syntax {errorCount === 1 ? "error" : "errors"} — fix before saving
              </span>
            ) : isDirty ? (
              <span className="text-xs text-[var(--color-icon-secondary)]">Unsaved changes</span>
            ) : null}
          </div>
          {saveError ? <p className="mt-2 text-sm text-red-600">{saveError}</p> : null}
          {saveNotice ? <p className="mt-2 text-sm text-[var(--color-text-primary)]">{saveNotice}</p> : null}
        </>
      )}
    </div>
  );
}
