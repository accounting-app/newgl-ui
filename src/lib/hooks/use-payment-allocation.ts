"use client";

import { useState } from "react";
import { distribute, type Owed, type Source } from "@/lib/accounting/payment-allocation";

export const cents = (value: number | string) => Math.round((Number(value) || 0) * 100);
const text = (value: number) => (value / 100).toFixed(2);
const total = (values: Record<string, string>) => Object.values(values).reduce((sum, value) => sum + cents(value), 0);

/**
 * What the user has typed on a payment screen: the amount, the payment against
 * each open invoice or bill, and the credits being used. A new payment's amount
 * follows what is ticked; a saved payment's amount (`fixed`) never moves.
 */
export function usePaymentAllocation(owed: Owed[], credits: Source[], fixed: boolean) {
  const [amount, setAmount] = useState("");
  const [payments, setPayments] = useState<Record<string, string>>({});
  const [used, setUsed] = useState<Record<string, string>>({});

  function followAmount(nextPayments: Record<string, string>, nextUsed: Record<string, string>) {
    if (fixed) return;
    const money = total(nextPayments) - total(nextUsed);
    setAmount(money > 0 ? text(money) : "");
  }
  function change(nextPayments: Record<string, string>, nextUsed = used) {
    setPayments(nextPayments);
    setUsed(nextUsed);
    followAmount(nextPayments, nextUsed);
  }

  return {
    amount,
    payments,
    used,
    setAmount,
    /** Typing the amount spreads it, with the credits in use, oldest first. */
    typeAmount(value: string) {
      setAmount(value);
      if (fixed) return;
      const spread = distribute(cents(value) + total(used), owed);
      setPayments(Object.fromEntries(Object.entries(spread).map(([id, paying]) => [id, text(paying)])));
    },
    setPayment(id: string, value: string) {
      const next = { ...payments, [id]: value };
      if (!value) delete next[id];
      change(next);
    },
    toggle(id: string) {
      const next = { ...payments };
      if (id in next) delete next[id];
      else next[id] = text(owed.find((item) => item.id === id)?.open ?? 0);
      change(next);
    },
    toggleAll(ids: string[]) {
      change(ids.every((id) => id in payments) ? {} : Object.fromEntries(ids.map((id) => [id, text(owed.find((item) => item.id === id)?.open ?? 0)])));
    },
    toggleCredit(id: string) {
      const next = { ...used };
      if (id in next) delete next[id];
      else {
        const stillOwed = total(payments) - total(used);
        next[id] = text(Math.min(credits.find((item) => item.id === id)?.available ?? 0, Math.max(0, stillOwed)));
      }
      change(payments, next);
    },
    setCredit(id: string, value: string) {
      const next = { ...used, [id]: value };
      if (!value) delete next[id];
      change(payments, next);
    },
    clear() {
      setPayments({});
      setUsed({});
      if (!fixed) setAmount("");
    }
  };
}
