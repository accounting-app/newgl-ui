"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useLinkedFiles } from "@/lib/hooks/use-linked-files";
import type { ReceiptZone } from "@/lib/services/receipts-service";

// The "Files / Upload" control on the Bank transactions screen. Upload
// only: every file is stored against the bank feed row `linkedId`, with no
// list to browse -- the count just confirms the files are attached.
export function LinkedFiles({ zone, linkedId }: { zone: ReceiptZone; linkedId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const files = useLinkedFiles(zone, linkedId);
  return (
    <div>
      <input ref={input} type="file" multiple hidden onChange={(event) => { void files.upload([...(event.target.files ?? [])]); event.target.value = ""; }} />
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" className="!rounded-md" disabled={files.busy} onClick={() => input.current?.click()}>
          {files.busy ? "Uploading..." : "Upload"}
        </Button>
        {files.items.length > 0 ? <span className="text-xs text-[var(--color-icon-secondary)]">{files.items.length} file{files.items.length === 1 ? "" : "s"} attached</span> : null}
      </div>
      {files.error ? <p className="mt-1 text-xs text-[var(--color-negative)]" role="alert">{files.error}</p> : null}
    </div>
  );
}
