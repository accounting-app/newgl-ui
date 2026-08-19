"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import type { ToastItem, ToastVariant } from "@/components/ui/toast/toast-context";

const VARIANT_ICON: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-emerald-600/30 text-emerald-700",
  error: "border-red-600/30 text-red-700",
  info: "border-sky-600/30 text-sky-700"
};

type ToastViewportProps = {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
};

export function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  const [mounted, setMounted] = useState(false);

  // Portal target only exists client-side -- avoids an SSR/hydration mismatch.
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((item) => {
        const Icon = VARIANT_ICON[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-lg border bg-[var(--color-container-background-primary)] p-3 shadow-lg ${VARIANT_CLASSES[item.variant]}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-global)]">{item.title}</p>
              {item.description ? (
                <p className="mt-0.5 text-xs text-[var(--color-text-primary)]">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => onDismiss(item.id)}
              className="shrink-0 text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
