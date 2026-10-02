"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { listReconciliationDiscrepancies, type ReconciliationDiscrepancy } from "@/lib/services/reconciliation-service";

function formatMoney(value: number | null): string {
  if (value === null) return "";
  return (value === 0 ? 0 : value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CHANGE_LABEL: Record<ReconciliationDiscrepancy["change"], string> = {
  DELETED: "Deleted",
  UNRECONCILED: "No longer reconciled",
  AMOUNT_CHANGED: "Amount changed",
  DATE_CHANGED: "Date changed"
};

/**
 * QBO's Reconciliation Discrepancy report: transactions that were
 * reconciled and have since been deleted, un-reconciled, or edited. Each
 * one means the books no longer agree with the statement it was
 * reconciled against.
 */
export function ReconciliationDiscrepancyPage({ accountId }: { accountId: string }) {
  const services = useMemo(() => getServiceContainer(), []);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [rows, setRows] = useState<ReconciliationDiscrepancy[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    services.accountService.getAccountById(accountId).then((account) => setAccountName(account.name)).catch(() => undefined);
    listReconciliationDiscrepancies(accountId)
      .then(setRows)
      .catch(() => setError(true));
  }, [accountId, services]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <nav className="mb-1 flex items-center gap-1.5 text-sm text-[var(--color-text-primary)]">
            <Link href="/all-apps/chart-of-accounts" className="hover:text-[var(--color-link-action)] hover:underline">
              Chart of accounts
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/all-apps/reconcile?view=history" className="hover:text-[var(--color-link-action)] hover:underline">
              History by account
            </Link>
            <span aria-hidden="true">/</span>
            <span>Discrepancy report</span>
          </nav>
          <h1 className="flex items-center gap-1.5 text-2xl font-semibold text-[var(--color-text-global)]">
            Reconciliation discrepancy report
            <HelpCircle className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
          </h1>
          {accountName ? <p className="text-sm text-[var(--color-text-primary)]">{accountName}</p> : null}
        </div>
        <div className="flex gap-2">
          <Link href="/all-apps/reconcile?view=history">
            <Button variant="secondary">History by account</Button>
          </Link>
          <Button variant="secondary" className="no-print" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <p className="mb-4 max-w-3xl text-sm text-[var(--color-text-primary)]">
        Transactions that were reconciled and then deleted, un-reconciled, or edited. Each one puts your books out of agreement with the bank statement
        it was reconciled against. Fix or restore it, or undo the most recent reconciliation and redo it.
      </p>

      {error ? <p className="text-sm text-[var(--color-negative)]">The discrepancy report couldn&apos;t be loaded.</p> : null}
      {rows === null && !error ? <p className="text-sm text-[var(--color-text-primary)]">Loading…</p> : null}
      {rows !== null ? (
        <div className="tw-override report-print-card overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead className="header-table text-left uppercase tracking-wide">
              <tr>
                <th className="px-2 pb-[5px] pt-2 text-left align-middle">Statement ending</th>
                <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Date</th>
                <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Ref No.</th>
                <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Payee</th>
                <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">What changed</th>
                <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">When reconciled</th>
                <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Now</th>
              </tr>
            </thead>
            <tbody className="content-table">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-sm text-[var(--color-text-primary)]">
                    No discrepancies. Every reconciled transaction is still as it was when you reconciled it.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.reconciliationId}-${row.transactionId}`} className="border-t border-[var(--color-divider-tertiary)]">
                    <td className="p-2 align-top text-[13px] text-[var(--color-text-primary)]">
                      <Link href={`/all-apps/reconcile/report/${row.reconciliationId}`} className="text-[var(--color-link-action)] hover:underline">
                        {row.statementEndingDate}
                      </Link>
                    </td>
                    <td className="p-2 align-top text-[13px] text-[var(--color-text-primary)]">{row.date}</td>
                    <td className="p-2 align-top text-[13px] text-[var(--color-text-primary)]">{row.refNumber}</td>
                    <td className="p-2 align-top text-[13px] text-[var(--color-text-global)]">{row.payee}</td>
                    <td className="p-2 align-top text-[13px] font-medium text-[var(--color-negative)]">{CHANGE_LABEL[row.change]}</td>
                    <td className="p-2 text-right align-top text-[13px] text-[var(--color-text-global)]">
                      {formatMoney(row.reconciledAmount)}
                      {row.change === "DATE_CHANGED" && row.reconciledDate ? ` (${row.reconciledDate})` : ""}
                    </td>
                    <td className="p-2 text-right align-top text-[13px] text-[var(--color-text-global)]">{row.change === "DELETED" ? "—" : formatMoney(row.currentAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
