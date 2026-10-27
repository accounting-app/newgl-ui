"use client";

import { useCallback, useEffect, useState } from "react";
import { MAX_ATTACHMENT_BYTES } from "@/lib/hooks/use-form-attachments";
import { listReceipts, uploadReceipt, type ReceiptRecord, type ReceiptZone } from "@/lib/services/receipts-service";

export const FILES_CHANGED_EVENT = "newgl:files-changed";

/**
 * Every file of one zone, optionally narrowed to one record (`linkedId`).
 * Unlike the quick-add forms, the record already exists here (a bank feed
 * row), so uploads are linked to it immediately. Other mounted users of
 * this hook (the row's file count, the detail form) refresh on the
 * FILES_CHANGED_EVENT broadcast.
 */
export function useLinkedFiles(zone: ReceiptZone, linkedId?: string) {
  const [all, setAll] = useState<ReceiptRecord[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => listReceipts(zone).then(setAll).catch(() => setAll([])), [zone]);
  useEffect(() => {
    void refresh();
    window.addEventListener(FILES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(FILES_CHANGED_EVENT, refresh);
  }, [refresh]);

  const items = linkedId ? all.filter((r) => r.linkedTransactionId === linkedId) : all;

  const upload = useCallback(async (files: File[]) => {
    if (!linkedId) return;
    setError(null);
    const tooBig = files.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) return setError(`${tooBig.name} is over the 20 MB limit.`);
    setBusy(true);
    try {
      for (const file of files) await uploadReceipt(file, { zone, linkedTransactionId: linkedId });
      window.dispatchEvent(new Event(FILES_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this file.");
    } finally {
      setBusy(false);
    }
  }, [zone, linkedId]);

  // Upload to any record of the zone (the row buttons on the bank list). Resolves to an error message, if any.
  const uploadTo = useCallback(async (id: string, files: File[]): Promise<string | null> => {
    const tooBig = files.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) return `${tooBig.name} is over the 20 MB limit.`;
    try {
      for (const file of files) await uploadReceipt(file, { zone, linkedTransactionId: id });
      window.dispatchEvent(new Event(FILES_CHANGED_EVENT));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Could not upload this file.";
    }
  }, [zone]);

  return { items, all, busy, error, upload, uploadTo };
}
