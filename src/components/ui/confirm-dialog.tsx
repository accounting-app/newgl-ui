"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** QBO's delete warning: a red "!" beside the message, No on the left and Yes on the right. */
  warning?: boolean;
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

  if (pending?.warning) {
    return (
      <Modal open onClose={() => settle(false)} hideHeader size="sm">
        <div className="flex items-center gap-4 px-3 pb-6 pt-4">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#d52b1e] text-3xl font-bold text-white">
            !
          </span>
          <p className="text-base leading-6 text-[var(--color-text-global)]">{pending.message}</p>
        </div>
        <div className="flex justify-between gap-3 border-t border-[var(--color-divider-tertiary)] px-3 pt-5">
          <Button variant="secondary" onClick={() => settle(false)} className="min-w-[80px]">
            {pending.cancelLabel ?? "No"}
          </Button>
          <Button variant="primary" onClick={() => settle(true)} className="min-w-[80px]">
            {pending.confirmLabel ?? "Yes"}
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={pending !== null} onClose={() => settle(false)} title={pending?.title} size="sm">
      <p className="mb-6 whitespace-pre-line text-sm text-[var(--color-text-primary)]">{pending?.message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => settle(false)}>
          {pending?.cancelLabel ?? "Cancel"}
        </Button>
        <Button onClick={() => settle(true)}>{pending?.confirmLabel ?? "Continue"}</Button>
      </div>
    </Modal>
  );
}
