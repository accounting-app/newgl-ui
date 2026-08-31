"use client";

import { useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BeanEditor } from "@/components/bean-editor/bean-editor";
import { countBeancountErrors } from "@/lib/beancount/lint";

type LedgerCreateFileViewProps = {
  /** Shown as the breadcrumb root and in the description line, e.g. the active company's label. */
  companyLabel: string;
  /** Pre-filled name, e.g. an uploaded file's name minus extension. Empty for a from-scratch file. */
  initialName?: string;
  /** Starting editor content -- boilerplate for a from-scratch file, or the uploaded file's raw text. */
  initialContent: string;
  onCancel: () => void;
  onCreate: (input: { name: string; content: string }) => Promise<void>;
};

// Full-page create flow, styled after a GitHub-style "Create File" screen:
// a breadcrumb row (`{company} / [name input]`) with Cancel/Save on the
// same line, then a full-width editor below. Replaces the small popup that
// used to gather Name/Label separately from the editor -- name is now
// entered inline here, and there's no Label field to match this screenshot;
// files can still be labeled afterward from the file list's rename icon.
export function LedgerCreateFileView({
  companyLabel,
  initialName = "",
  initialContent,
  onCancel,
  onCreate
}: LedgerCreateFileViewProps) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const errorCount = useMemo(() => countBeancountErrors(content), [content]);
  const canSave = name.trim().length > 0 && errorCount === 0 && !saving;

  function handleCancel() {
    if ((name.trim() || content !== initialContent) && !window.confirm("Discard this new file?")) return;
    onCancel();
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), content });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this file");
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <h1 className="text-lg font-semibold text-[var(--color-text-global)]">Create File</h1>
      <p className="mt-1 text-sm text-[var(--color-text-primary)]">
        Create a new file in {companyLabel}. Add Beancount ledger files or documents to your repository.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex h-9 flex-1 items-center gap-2 rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-[var(--override-focus)] focus-within:shadow-[0_0_0_1px_var(--override-focus)]">
          <span className="shrink-0 text-sm text-[var(--color-icon-secondary)]">{companyLabel} /</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name your file..."
            autoFocus
            className="w-full bg-transparent text-sm text-[var(--color-input-text)] outline-none placeholder:text-[var(--color-text-disabled)]"
          />
        </div>
        <Button variant="secondary" onClick={handleCancel} disabled={saving}>
          <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          <Save className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {error ? <p className="mt-2 text-sm text-[var(--color-negative)]">{error}</p> : null}
      {errorCount > 0 ? (
        <p className="mt-2 text-xs text-[var(--color-negative)]">
          {errorCount} syntax {errorCount === 1 ? "error" : "errors"} — fix before saving
        </p>
      ) : null}

      <div className="mt-4 min-h-0 flex-1">
        <BeanEditor value={content} onChange={setContent} />
      </div>
    </div>
  );
}
