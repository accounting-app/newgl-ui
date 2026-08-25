"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { BeanEditor } from "@/components/bean-editor/bean-editor";
import { countBeancountErrors } from "@/lib/beancount/lint";
import { createLedgerFile } from "@/lib/services/ledger-files-service";

type LedgerUploadFileModalProps = {
  onCreated: () => void;
};

// "Upload, then view and verify, finally save to our list of files" -- a
// staged flow, unlike a plain replace-in-place upload. The uploaded
// content is fully editable here before it's ever persisted, same live
// linter as the real editor. Always creates a new extra file scoped to
// the caller's currently active company (never a whole new company, and
// never replaces an existing file).
export function LedgerUploadFileModal({ onCreated }: LedgerUploadFileModalProps) {
  const [content, setContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [readError, setReadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(file: File) {
    setReadError(null);
    try {
      const text = await file.text();
      setContent(text);
      setFileName(file.name);
      setName(file.name.replace(/\.bean$/i, ""));
    } catch {
      setReadError("Could not read that file. Please try again.");
    }
  }

  const errorCount = content === null ? 0 : countBeancountErrors(content);

  async function handleCreate() {
    if (content === null || !name.trim() || errorCount > 0) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      await createLedgerFile({ name: name.trim(), label: label.trim() || undefined, content });
      onCreated();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not save this file");
    } finally {
      setIsCreating(false);
    }
  }

  if (content === null) {
    return (
      <div>
        <p className="mb-4 text-sm text-[var(--color-text-primary)]">
          Choose a .bean file from your computer. You'll be able to review and edit it before it's saved.
        </p>
        <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
          Choose file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".bean,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleFileSelected(file);
          }}
        />
        {readError ? <p className="mt-2 text-sm text-red-600">{readError}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--color-text-primary)]">
        Review <span className="font-medium">{fileName}</span> below -- fix any syntax errors, then name it to add it
        to your file list.
      </p>
      <div className="h-[280px]">
        <BeanEditor value={content} onChange={setContent} minHeight={280} />
      </div>
      {errorCount > 0 ? (
        <p className="text-xs text-red-600">
          {errorCount} syntax {errorCount === 1 ? "error" : "errors"} — fix before saving
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
          Name
          <InputField type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payroll" />
        </label>
        <label className="flex flex-1 min-w-[180px] flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
          Label (optional)
          <InputField
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Payroll ledger"
          />
        </label>
      </div>
      {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={handleCreate} disabled={isCreating || !name.trim() || errorCount > 0}>
          {isCreating ? "Saving…" : "Save to file list"}
        </Button>
        <Button variant="secondary" onClick={() => setContent(null)} disabled={isCreating}>
          Choose a different file
        </Button>
      </div>
    </div>
  );
}
