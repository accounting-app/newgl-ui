"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type Pending = ConfirmOptions & { resolve: (confirmed: boolean) => void };

let pushPending: ((pending: Pending) => void) | null = null;

/**
 * Styled replacement for window.confirm, callable from anywhere (including
 * non-React service code). Resolves false if no <ConfirmDialogHost /> is
 * mounted, so a missing host never silently confirms a destructive action.
 */
export function requestConfirmation(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pushPending) {
      resolve(false);
      return;
    }
    pushPending({ ...options, resolve });
  });
}

export function ConfirmDialogHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    pushPending = (next) => setPending(next);
    return () => {
      pushPending = null;
    };
  }, []);

  function settle(confirmed: boolean) {
    pending?.resolve(confirmed);
    setPending(null);
  }

  return (
    <Modal open={pending !== null} onClose={() => settle(false)} title={pending?.title} size="sm">
      <p className="mb-6 text-sm text-[var(--color-text-primary)]">{pending?.message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => settle(false)}>
          {pending?.cancelLabel ?? "Cancel"}
        </Button>
        <Button onClick={() => settle(true)}>{pending?.confirmLabel ?? "Continue"}</Button>
      </div>
    </Modal>
  );
}
