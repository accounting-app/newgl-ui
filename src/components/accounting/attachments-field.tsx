"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Paperclip, Trash2, X } from "lucide-react";
import type { FormAttachments } from "@/lib/hooks/use-form-attachments";
import { fetchReceiptFileUrl, listReceipts, type ReceiptRecord, type ReceiptZone } from "@/lib/services/receipts-service";

const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

async function openFile(receipt: ReceiptRecord) {
  const url = await fetchReceiptFileUrl(receipt.id);
  window.open(url, "_blank");
}

// QBO's "Attachments" box under a transaction form: dashed drop zone with
// "Add attachment", the files already on this form, and a "Show existing"
// side panel ("Add to <form>") that lists stored files to attach.
export function AttachmentsField({ attachments, formLabel, zone = "forms" }: { attachments: FormAttachments; formLabel: string; zone?: ReceiptZone }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [panel, setPanel] = useState(false);
  const [filter, setFilter] = useState<"unlinked" | "linked" | "all">("unlinked");
  const [filterOpen, setFilterOpen] = useState(false);
  const [stored, setStored] = useState<ReceiptRecord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!panel) return;
    setStored(null);
    setLoadError(null);
    listReceipts(zone).then(setStored).catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load attachments"));
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setPanel(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel, zone]);

  const onForm = new Set(attachments.items.map((r) => r.id));
  const shown = (stored ?? []).filter((r) => !onForm.has(r.id) && (filter === "all" || (filter === "linked") === Boolean(r.linkedTransactionId)));

  return (
    <div>
      <span className={LABEL}>Attachments</span>
      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void attachments.upload([...event.dataTransfer.files]); }}
        className={`min-h-[170px] rounded-md border border-dashed px-6 py-6 text-center ${dragging ? "border-[var(--color-ui-primary)] bg-[var(--color-action-passive-subtle-hover)]" : "border-[var(--color-container-border-secondary)]"}`}
      >
        <input ref={input} type="file" multiple hidden onChange={(event) => { void attachments.upload([...(event.target.files ?? [])]); event.target.value = ""; }} />
        <button type="button" onClick={() => input.current?.click()} disabled={attachments.uploading} className="text-[var(--color-link-action)] hover:underline disabled:opacity-60">
          {attachments.uploading ? "Uploading..." : "Add attachment"}
        </button>
        <p className="text-sm">Max file size: 20 MB</p>
        {attachments.items.length > 0 ? (
          <ul className="mt-4 space-y-1 text-left">
            {attachments.items.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded border border-[var(--color-divider-tertiary)] px-2 py-1.5 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                <button type="button" onClick={() => void openFile(r)} className="min-w-0 flex-1 truncate text-left text-[var(--color-link-action)] hover:underline">{r.fileName}</button>
                <span className="shrink-0 text-xs text-[var(--color-icon-secondary)]">{size(r.fileSizeBytes)}</span>
                <button type="button" aria-label={`Remove ${r.fileName}`} onClick={() => void attachments.detach(r.id)} className="text-[var(--color-icon-secondary)] hover:text-[var(--color-negative)]"><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {attachments.error ? <p className="mt-1 text-sm text-[var(--color-negative)]" role="alert">{attachments.error}</p> : null}
      <button type="button" onClick={() => setPanel(true)} className="mx-auto mt-2 block text-[var(--color-link-action)] hover:underline">Show existing</button>

      {panel ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/30">
          <button type="button" aria-label="Close attachments" tabIndex={-1} className="h-full flex-1" onClick={() => setPanel(false)} />
          <aside role="dialog" aria-label={`Add to ${formLabel}`} className="flex h-full w-[min(1100px,80vw)] flex-col overflow-y-auto bg-[var(--color-container-background-primary)] p-8 shadow-2xl">
            <div className="relative text-center">
              <h2 className="text-lg text-[var(--color-text-global)]">Add to {formLabel}</h2>
              <button type="button" onClick={() => setPanel(false)} aria-label="Close attachments panel" className="absolute right-0 top-0 rounded-md border-2 border-[var(--color-ui-primary)] p-1.5 text-[var(--color-icon-secondary)]">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <div className="relative mt-4 inline-block">
                <button type="button" onClick={() => setFilterOpen((v) => !v)} aria-expanded={filterOpen} className="inline-flex items-center gap-4 rounded-md border border-[var(--color-input-border-primary)] px-4 py-2 text-base text-[var(--color-text-global)]">
                  {filter === "unlinked" ? "Unlinked" : filter === "linked" ? "Linked" : "All"} <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </button>
                {filterOpen ? (
                  <ul className="absolute left-0 top-full z-10 mt-1 w-full rounded-md border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 text-left shadow-lg">
                    {(["unlinked", "linked", "all"] as const).map((f) => (
                      <li key={f}><button type="button" onClick={() => { setFilter(f); setFilterOpen(false); }} className="block w-full px-4 py-1.5 text-left capitalize hover:bg-[var(--color-action-passive-subtle-hover)]">{f}</button></li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
            {loadError ? <p className="mt-8 text-base text-[var(--color-negative)]" role="alert">{loadError}</p> : stored === null ? <p className="mt-8 text-base">Loading...</p> : shown.length === 0 ? (
              <p className="mt-8 text-base">No {filter === "all" ? "" : `${filter} `}attachments</p>
            ) : (
              <ul className="mt-8 divide-y divide-[var(--color-divider-tertiary)] border-y border-[var(--color-divider-tertiary)]">
                {shown.map((r) => (
                  <li key={r.id} className="flex items-center gap-4 py-3 text-base">
                    <FileText className="h-5 w-5 shrink-0 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                    <button type="button" onClick={() => void openFile(r)} className="min-w-0 flex-1 truncate text-left text-[var(--color-link-action)] hover:underline">{r.fileName}</button>
                    <span className="w-24 text-right text-sm text-[var(--color-icon-secondary)]">{size(r.fileSizeBytes)}</span>
                    <span className="w-28 text-right text-sm text-[var(--color-icon-secondary)]">{new Date(r.uploadedAt).toLocaleDateString()}</span>
                    <span className="w-20 text-sm text-[var(--color-icon-secondary)]">{r.linkedTransactionId ? "Linked" : "Unlinked"}</span>
                    <button type="button" onClick={() => attachments.attach(r)} className="rounded-md border border-[var(--color-button-border)] px-3 py-1 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Add</button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
