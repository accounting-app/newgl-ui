"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

type ImportConfirmDialogProps = {
  open: boolean;
  transactionCount: number;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ImportConfirmDialog({
  open,
  transactionCount,
  isSubmitting,
  onCancel,
  onConfirm
}: ImportConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmitting) onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isSubmitting, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm import"
        className="mx-4 w-full max-w-[440px] rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-6 shadow-lg"
      >
        <p className="text-base font-medium text-[var(--color-text-primary)]">
          New GL will import {transactionCount} transaction{transactionCount === 1 ? "" : "s"} using the
          fields you chose. Do you want to import now?
        </p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            No
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Importing..." : "Yes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
