"use client";

import { createContext, useContext } from "react";

export type ToastVariant = "success" | "error" | "info";

export type ToastInput = {
  variant?: ToastVariant;
  title: string;
  description?: string;
  /** ms before auto-dismiss. Defaults differ by variant (errors stay longer) -- see toast-provider.tsx. */
  duration?: number;
};

export type ToastItem = ToastInput & { id: string; variant: ToastVariant };

export type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

// No toast/notification system existed anywhere in the app before this
// (UI_DESIGN_SYSTEM_PLAN.md Part 1) -- every error was an inline red <p>,
// with no success-feedback pattern at all. Hand-rolled per the confirmed
// decision to match this codebase's zero-UI-dependency style.
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
