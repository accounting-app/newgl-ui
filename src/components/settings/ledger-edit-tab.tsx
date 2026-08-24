"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BeanEditor } from "@/components/bean-editor/bean-editor";
import { countBeancountErrors } from "@/lib/beancount/lint";
import { BASE_API_URL, PRIMARY_LEDGER_NAME } from "@/configuration";
import { getAccessToken } from "@/lib/services/http-service-container";

type LedgerSummary = {
  name: string;
  version: number;
  contentHash: string;
  transactionCount: number;
  accountCount: number;
};

type LedgerEditTabProps = {
  /** Called after a successful save so the sibling "Manage file" tab's version list stays in sync. */
  onSaved: () => void;
  /** Lets the parent tab switcher warn before navigating away from unsaved edits. */
  onDirtyChange: (dirty: boolean) => void;
};

export function LedgerEditTab({ onSaved, onDirtyChange }: LedgerEditTabProps) {
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
        const response = await fetch(`${BASE_API_URL}/ledgers/${PRIMARY_LEDGER_NAME}/download`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
        });
        if (!response.ok) throw new Error(`Could not load the ledger (${response.status})`);
        const text = await response.text();
        setContent(text);
        setSavedContent(text);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Could not load the ledger");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty = content !== null && content !== savedContent;
  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const errorCount = useMemo(() => (content === null ? 0 : countBeancountErrors(content)), [content]);

  async function handleSave() {
    if (content === null || errorCount > 0) return;
    setSaving(true);
    setSaveError(null);
    setSaveNotice(null);
    try {
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
    <Card
      title="Edit .bean file"
      description="Syntax errors are underlined as you type and block saving. This does not check things like unbalanced transactions or accounts that were never opened -- only syntax."
    >
      {loading ? (
        <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
      ) : loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : content === null ? null : (
        <>
          <BeanEditor value={content} onChange={setContent} />
          <div className="mt-3 flex items-center gap-3">
            <Button variant="primary" onClick={handleSave} disabled={saving || errorCount > 0 || !isDirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
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
    </Card>
  );
}
