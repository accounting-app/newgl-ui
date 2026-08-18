"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ToastContext } from "@/components/ui/toast/toast-context";
import type { ToastInput, ToastItem } from "@/components/ui/toast/toast-context";
import { ToastViewport } from "@/components/ui/toast/toast-viewport";

const DEFAULT_DURATION_MS: Record<ToastItem["variant"], number> = {
  success: 4000,
  info: 4000,
  error: 7000 // errors stay longer -- more likely to need reading/re-reading
};

function createId(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `toast-${Date.now()}-${Math.random()}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = createId();
      const variant = input.variant ?? "info";
      const duration = input.duration ?? DEFAULT_DURATION_MS[variant];
      setToasts((current) => [...current, { ...input, id, variant }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
