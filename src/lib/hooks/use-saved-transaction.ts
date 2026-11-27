"use client";

import { useEffect, useRef, useState } from "react";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Transaction } from "@/modules/accounting/domain/models";

/** Drops empty values, so only filled form fields are stored on a transaction. */
export function formDetails(values: Record<string, string | undefined>): Record<string, string> | undefined {
  const entries = Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()));
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

/**
 * ?txnId= support for the full-screen forms: loads the saved transaction once
 * and hands it to `fill`. `fill` returns a message when the form can't show it,
 * in which case `loaded` stays null and the form can't save over it.
 */
export function useSavedTransaction(
  txnId: string | null,
  type: Transaction["type"],
  typeName: string,
  fill: (txn: Transaction) => string | void
) {
  const [loaded, setLoaded] = useState<Transaction | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fillRef = useRef(fill);
  fillRef.current = fill;

  useEffect(() => {
    if (!txnId) return;
    let cancelled = false;
    getServiceContainer()
      .transactionService.getTransactionById(txnId)
      .then((txn) => {
        if (cancelled) return;
        if (txn.type !== type) return setLoadError(`This transaction isn't ${typeName}.`);
        const problem = fillRef.current(txn);
        if (problem) return setLoadError(problem);
        setLoaded(txn);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Could not load this transaction.");
      });
    return () => {
      cancelled = true;
    };
  }, [txnId, type, typeName]);

  return { loaded, setLoaded, loadError };
}

export const CANNOT_SHOW = "This transaction has lines this form can't show. Edit it from the register instead.";
