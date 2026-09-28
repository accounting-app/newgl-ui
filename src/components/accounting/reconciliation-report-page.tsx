"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getReconciliation, type ReconciliationDetail } from "@/lib/services/reconciliation-service";

function formatMoney(value: number | null): string {
  if (value === null) return "";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The printable per-session Reconciliation Report, behind History-by-account's "View report" link. */
export function ReconciliationReportPage({ reconciliationId }: { reconciliationId: string }) {
  const [userName, setUserName] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReconciliationDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserName(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    getReconciliation(reconciliationId)
      .then(setDetail)
      .catch(() => setError(true));
  }, [reconciliationId]);

  if (error) {
    return <p className="text-sm text-[var(--color-negative)]">This reconciliation report couldn&apos;t be found.</p>;
  }
  if (!detail) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <section className="report-print-card mx-auto mt-4 w-full max-w-[840px] rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5 shadow-sm">
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <div className="mb-4 text-center">
        <h2 className="mb-2 text-[28px] font-medium text-[var(--color-text-global)]">{userName ?? ""}</h2>
        <p className="mb-2 text-[16px] text-[var(--color-text-primary)]">Reconciliation Report</p>
        <p className="text-xs text-[var(--color-icon-secondary)]">Statement ending date: {detail.statementEndingDate}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <p className="text-[var(--color-text-primary)]">Beginning balance</p>
        <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.statementBeginningBalance)}</p>
        <p className="text-[var(--color-text-primary)]">Statement ending balance</p>
        <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.statementEndingBalance)}</p>
        <p className="text-[var(--color-text-primary)]">Cleared balance</p>
        <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.clearedBalance)}</p>
        {detail.serviceChargeAmount !== null ? (
          <>
            <p className="text-[var(--color-text-primary)]">Service charge</p>
            <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.serviceChargeAmount)}</p>
          </>
        ) : null}
        {detail.interestEarnedAmount !== null ? (
          <>
            <p className="text-[var(--color-text-primary)]">Interest earned</p>
            <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.interestEarnedAmount)}</p>
          </>
        ) : null}
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Date</th>
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Ref No.</th>
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Payee</th>
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Memo</th>
            <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Payment</th>
            <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Deposit</th>
          </tr>
        </thead>
        <tbody>
          {detail.entries.map((entry) => (
            <tr key={entry.transactionId} className="border-b border-[var(--color-divider-tertiary)]">
              <td className="px-3 py-1 text-[var(--color-text-primary)]">{entry.date}</td>
              <td className="px-3 py-1 text-[var(--color-text-primary)]">{entry.refNumber}</td>
              <td className="px-3 py-1 text-[var(--color-text-global)]">{entry.payee}</td>
              <td className="px-3 py-1 text-[var(--color-text-primary)]">{entry.memo}</td>
              <td className="px-3 py-1 text-right text-[var(--color-text-global)]">{formatMoney(entry.payment)}</td>
              <td className="px-3 py-1 text-right text-[var(--color-text-global)]">{formatMoney(entry.deposit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
