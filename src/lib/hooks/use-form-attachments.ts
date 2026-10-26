"use client";

import { useCallback, useRef, useState } from "react";
import { deleteReceipt, updateReceipt, uploadReceipt, type ReceiptRecord } from "@/lib/services/receipts-service";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export type FormAttachments = ReturnType<typeof useFormAttachments>;

/**
 * Attachments on a full-screen transaction form. Files are real receipts
 * (Postgres metadata + Supabase Storage bytes, see receipts-service.ts):
 * "Add attachment" uploads straight away, "Show existing" picks files that
 * are already stored, and `linkTo` stamps the saved transaction's id on
 * every file once the form is saved -- which is what makes it "linked".
 */
export function useFormAttachments() {
  const [items, setItems] = useState<ReceiptRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Files uploaded on this form (not picked from "Show existing"): detaching one deletes it, so abandoned forms don't leave orphans.
  const uploadedHere = useRef(new Set<string>());

  const upload = useCallback(async (files: File[]) => {
    setError(null);
    const tooBig = files.find((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig) return setError(`${tooBig.name} is over the 20 MB limit.`);
    setUploading(true);
    try {
      for (const file of files) {
        const created = await uploadReceipt(file);
        uploadedHere.current.add(created.id);
        setItems((current) => [...current, created]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload this file.");
    } finally {
      setUploading(false);
    }
  }, []);

  const attach = useCallback((receipt: ReceiptRecord) => setItems((current) => (current.some((r) => r.id === receipt.id) ? current : [...current, receipt])), []);

  const detach = useCallback(async (id: string) => {
    setItems((current) => current.filter((r) => r.id !== id));
    if (uploadedHere.current.delete(id)) await deleteReceipt(id).catch(() => undefined);
  }, []);

  const linkTo = useCallback(async (transactionId: string) => {
    await Promise.all(items.map((r) => updateReceipt(r.id, { linkedTransactionId: transactionId })));
    uploadedHere.current.clear();
    setItems([]);
  }, [items]);

  const reset = useCallback(() => {
    const orphans = [...uploadedHere.current];
    uploadedHere.current.clear();
    setItems([]);
    setError(null);
    orphans.forEach((id) => void deleteReceipt(id).catch(() => undefined));
  }, []);

  return { items, uploading, error, upload, attach, detach, linkTo, reset };
}
