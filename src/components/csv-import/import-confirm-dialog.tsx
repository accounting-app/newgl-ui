"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useFocusTrap } from "@/hooks/use-focus-trap";

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
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, open);

  // Latest-ref pattern (same as BeanEditor's onChangeRef / ui/modal.tsx) so
  // the effect only subscribes once per `open`, not on every render.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const isSubmittingRef = useRef(isSubmitting);
  isSubmittingRef.current = isSubmitting;

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSubmittingRef.current) onCancelRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label="Confirm import"
        tabIndex={-1}
        className="mx-4 w-full max-w-[440px] rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-6 shadow-lg outline-none"
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
