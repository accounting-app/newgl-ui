"use client";

import { useRef } from "react";
import { Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLinkedFiles } from "@/lib/hooks/use-linked-files";
import { fetchReceiptFileUrl, type ReceiptRecord, type ReceiptZone } from "@/lib/services/receipts-service";

const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const open = async (r: ReceiptRecord) => window.open(await fetchReceiptFileUrl(r.id), "_blank");

// The "Files / Upload" control on the Bank transactions screen: uploads
// attach straight to the bank feed row `linkedId`.
export function LinkedFiles({ zone, linkedId }: { zone: ReceiptZone; linkedId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const files = useLinkedFiles(zone, linkedId);
  return (
    <div>
      <input ref={input} type="file" multiple hidden onChange={(event) => { void files.upload([...(event.target.files ?? [])]); event.target.value = ""; }} />
      <Button variant="secondary" size="sm" className="!rounded-md" disabled={files.busy} onClick={() => input.current?.click()}>
        {files.busy ? "Uploading..." : "Upload"}
      </Button>
      {files.items.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {files.items.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-[var(--color-icon-secondary)]" aria-hidden="true" />
              <button type="button" onClick={() => void open(r)} className="max-w-[220px] truncate text-left text-[var(--color-link-action)] hover:underline">{r.fileName}</button>
              <span className="text-xs text-[var(--color-icon-secondary)]">{size(r.fileSizeBytes)}</span>
              <button type="button" aria-label={`Remove ${r.fileName}`} onClick={() => void files.remove(r.id)} className="text-[var(--color-icon-secondary)] hover:text-[var(--color-negative)]"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      ) : null}
      {files.error ? <p className="mt-1 text-xs text-[var(--color-negative)]" role="alert">{files.error}</p> : null}
    </div>
  );
}
