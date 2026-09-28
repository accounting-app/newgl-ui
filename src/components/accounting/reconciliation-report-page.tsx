"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { getReconciliation, type ReconciliationDetail, type ReconciliationEntry } from "@/lib/services/reconciliation-service";

function formatMoney(value: number | null): string {
  if (value === null) return "";
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function EntryGroup({ title, entries, amountOf }: { title: string; entries: ReconciliationEntry[]; amountOf: (entry: ReconciliationEntry) => number | null }) {
  if (entries.length === 0) return null;
  const total = entries.reduce((sum, entry) => sum + (amountOf(entry) ?? 0), 0);
  return (
    <div className="mb-6">
      <p className="mb-2 text-sm font-medium text-[var(--color-text-global)]">
        {title} ({entries.length})
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--color-divider-tertiary)]">
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Date</th>
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Ref No.</th>
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Payee</th>
            <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.transactionId} className="border-b border-[var(--color-divider-tertiary)]">
              <td className="px-3 py-1 text-[var(--color-text-primary)]">{entry.date}</td>
              <td className="px-3 py-1 text-[var(--color-text-primary)]">{entry.refNumber}</td>
              <td className="px-3 py-1 text-[var(--color-text-global)]">{entry.payee}</td>
              <td className="px-3 py-1 text-right text-[var(--color-text-global)]">{formatMoney(amountOf(entry))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end border-t border-[var(--color-divider-tertiary)] px-3 py-1 text-sm font-medium text-[var(--color-text-global)]">
        Total: {formatMoney(total)}
      </div>
    </div>
  );
}

/** The printable per-session Reconciliation Report, behind History-by-account's "View report" link. */
export function ReconciliationReportPage({ reconciliationId }: { reconciliationId: string }) {
  const services = useMemo(() => getServiceContainer(), []);
  const [userName, setUserName] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReconciliationDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserName(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    getReconciliation(reconciliationId)
      .then((loaded) => {
        setDetail(loaded);
        services.accountService.getAccountById(loaded.accountId).then((account) => setAccountName(account.name));
      })
      .catch(() => setError(true));
  }, [reconciliationId, services]);

  if (error) {
    return <p className="text-sm text-[var(--color-negative)]">This reconciliation report couldn&apos;t be found.</p>;
  }
  if (!detail) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  const payments = detail.entries.filter((entry) => (entry.payment ?? 0) > 0);
  const deposits = detail.entries.filter((entry) => (entry.deposit ?? 0) > 0);

  return (
    <section className="report-print-card mx-auto mt-4 w-full max-w-[840px] rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5 shadow-sm">
      <div className="mb-4 flex justify-end">
        <Button variant="secondary" size="sm" className="no-print" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <div className="mb-4 text-center">
        <h2 className="mb-2 text-[28px] font-medium text-[var(--color-text-global)]">{userName ?? ""}</h2>
        <p className="mb-2 text-[16px] text-[var(--color-text-primary)]">
          {accountName ? `${accountName}, ` : ""}Period Ending {detail.statementEndingDate}
        </p>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Reconciliation Report</p>
        <p className="mt-2 text-xs text-[var(--color-icon-secondary)]">Reconciled on: {new Date(detail.completedAt).toLocaleDateString()}</p>
        <p className="text-xs text-[var(--color-icon-secondary)]">Reconciled by: {detail.reconciledBy ?? ""}</p>
      </div>
      <p className="mb-4 text-center text-xs text-[var(--color-icon-secondary)]">Any changes made to transactions after this date aren&apos;t included in this report.</p>

      <div className="mb-6">
        <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Summary</p>
        <div className="grid grid-cols-2 gap-y-1 text-sm">
          <p className="text-[var(--color-text-primary)]">Statement beginning balance</p>
          <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.statementBeginningBalance)}</p>
          <p className="text-[var(--color-text-primary)]">Checks and payments cleared ({detail.paymentsCount})</p>
          <p className="text-right text-[var(--color-text-global)]">{formatMoney(-detail.paymentsTotal)}</p>
          <p className="text-[var(--color-text-primary)]">Deposits and other credits cleared ({detail.depositsCount})</p>
          <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.depositsTotal)}</p>
          {detail.serviceChargeAmount !== null ? (
            <>
              <p className="text-[var(--color-text-primary)]">Service charge</p>
              <p className="text-right text-[var(--color-text-global)]">{formatMoney(-detail.serviceChargeAmount)}</p>
            </>
          ) : null}
          {detail.interestEarnedAmount !== null ? (
            <>
              <p className="text-[var(--color-text-primary)]">Interest earned</p>
              <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.interestEarnedAmount)}</p>
            </>
          ) : null}
          {detail.discrepancyAdjustmentAmount !== null ? (
            <>
              <p className="text-[var(--color-text-primary)]">Adjustment</p>
              <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.discrepancyAdjustmentAmount)}</p>
            </>
          ) : null}
          <p className="border-t border-[var(--color-divider-tertiary)] pt-1 font-medium text-[var(--color-text-global)]">Statement ending balance</p>
          <p className="border-t border-[var(--color-divider-tertiary)] pt-1 text-right font-medium text-[var(--color-text-global)]">{formatMoney(detail.statementEndingBalance)}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-y-1 text-sm">
          <p className="text-[var(--color-text-primary)]">Uncleared transactions as of {detail.statementEndingDate}</p>
          <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.unclearedTotal)}</p>
          <p className="text-[var(--color-text-primary)]">Register balance as of {detail.statementEndingDate}</p>
          <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.registerBalance)}</p>
        </div>
      </div>

      <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Details</p>
      <EntryGroup title="Checks and payments cleared" entries={payments} amountOf={(entry) => entry.payment} />
      <EntryGroup title="Deposits and other credits cleared" entries={deposits} amountOf={(entry) => entry.deposit} />
    </section>
  );
}
