"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// QBO's built-in payment methods; "+ Add new" adds your own (kept in this browser).
const DEFAULT_METHODS = ["ACH", "Cash", "Check", "Credit Card"];
const METHODS_KEY = "newgl:payment-methods:v1";

export function usePaymentMethods() {
  const [custom, setCustom] = useState<string[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(METHODS_KEY) ?? "[]");
      if (Array.isArray(stored)) setCustom(stored.filter((m): m is string => typeof m === "string"));
    } catch {
      // storage unavailable: only the built-in methods
    }
  }, []);
  const options = useMemo(() => [...new Set([...DEFAULT_METHODS, ...custom])].sort((a, b) => a.localeCompare(b)).map((m) => ({ value: m, label: m })), [custom]);
  const add = useCallback((name: string) => {
    setCustom((current) => {
      const next = [...new Set([...current, name])];
      try {
        window.localStorage.setItem(METHODS_KEY, JSON.stringify(next));
      } catch {
        // not persisted; still usable for this visit
      }
      return next;
    });
  }, []);
  return { options, add };
}
