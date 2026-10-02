"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import {
  getReconciliation,
  listReconciliationsForAccount,
  type Reconciliation,
  type ReconciliationDetail,
  type ReconciliationEntry
} from "@/lib/services/reconciliation-service";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { groupAccountsByCategory, isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import type { Account } from "@/modules/accounting/domain/models";

function formatMoney(value: number | null): string {
  if (value === null) return "";
  // Negating a zero total yields -0, which would print as "-0.00".
  return (value === 0 ? 0 : value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Type</th>
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Ref No.</th>
            <th className="px-3 py-1 text-left font-medium text-[var(--color-text-primary)]">Payee</th>
            <th className="px-3 py-1 text-right font-medium text-[var(--color-text-primary)]">Amount</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.transactionId} className="border-b border-[var(--color-divider-tertiary)]">
              <td className="px-3 py-1 text-[var(--color-text-primary)]">{entry.date}</td>
              <td className="px-3 py-1 text-[var(--color-text-primary)]">{(entry.transactionType ?? "").toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</td>
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

// Same breadcrumb shell as reconcile-page.tsx's own Breadcrumb, just with
// "History by account" (where you came from) added as a real link and
// "Report" as the current page -- matches QBO's own path finder for this
// screen exactly.
function Breadcrumb() {
  return (
    <nav className="mb-1 flex items-center gap-1.5 text-sm text-[var(--color-text-primary)]">
      <Link href="/all-apps/chart-of-accounts" className="hover:text-[var(--color-link-action)] hover:underline">
        Chart of accounts
      </Link>
      <span aria-hidden="true">/</span>
      <Link href="/register" className="hover:text-[var(--color-link-action)] hover:underline">
        Bank register
      </Link>
      <span aria-hidden="true">/</span>
      <Link href="/all-apps/reconcile?view=history" className="hover:text-[var(--color-link-action)] hover:underline">
        History by account
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-[var(--color-text-primary)]">Report</span>
    </nav>
  );
}

/**
 * The printable per-session Reconciliation Report, behind History-by-
 * account's "View report" link (and the setup form's "Last statement
 * ending date" link). The Account/Statement-ending-date selectors above
 * the print card let you jump to a different session's report without
 * leaving this screen, same as QBO's own report viewer.
 */
export function ReconciliationReportPage({ reconciliationId }: { reconciliationId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shouldPrint = searchParams.get("print") === "1";
  const services = useMemo(() => getServiceContainer(), []);
  const [userName, setUserName] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReconciliationDetail | null>(null);
  const [error, setError] = useState(false);
  const [hideAdditionalInfo, setHideAdditionalInfo] = useState(false);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountHistory, setAccountHistory] = useState<Reconciliation[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserName(data.user?.email ?? null));
  }, []);

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);

  useEffect(() => {
    setDetail(null);
    setError(false);
    getReconciliation(reconciliationId)
      .then((loaded) => {
        setDetail(loaded);
        services.accountService.getAccountById(loaded.accountId).then((account) => setAccountName(account.name));
        listReconciliationsForAccount(loaded.accountId).then(setAccountHistory);
      })
      .catch(() => setError(true));
  }, [reconciliationId, services]);

  // "Print report" in History by account opens this page with ?print=1.
  useEffect(() => {
    if (!shouldPrint || !detail || !accountName) return;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [shouldPrint, detail, accountName]);

  const reconcilableAccounts = useMemo(() => accounts.filter((a) => isRegisterAccountCategory(a.category)), [accounts]);
  const groupedAccountOptions = useMemo(
    () =>
      groupAccountsByCategory(reconcilableAccounts).flatMap(({ category, accounts: categoryAccounts }) =>
        categoryAccounts.map((account) => ({ value: account.id, label: account.name, rightLabel: ACCOUNT_CATEGORY_LABELS[category] }))
      ),
    [reconcilableAccounts]
  );
  const statementDateOptions = useMemo(
    () => accountHistory.map((r) => ({ value: r.id, label: r.statementEndingDate })),
    [accountHistory]
  );

  function handleAccountChange(accountId: string) {
    listReconciliationsForAccount(accountId).then((history) => {
      if (history[0]) router.push(`/all-apps/reconcile/report/${history[0].id}`);
    });
  }

  if (error) {
    return <p className="text-sm text-[var(--color-negative)]">This reconciliation report couldn&apos;t be found.</p>;
  }
  if (!detail) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  const payments = detail.entries.filter((entry) => (entry.payment ?? 0) > 0);
  const deposits = detail.entries.filter((entry) => (entry.deposit ?? 0) > 0);

  // Everything below is in the account's NATURAL balance terms. For a bank
  // account the "payment" column lowers the balance; for a credit card or
  // liability it is a charge that raises it, and "deposit" lowers it.
  const creditNormal = detail.normalBalance === "CREDIT";
  const naturalOf = (entry: ReconciliationEntry) => (creditNormal ? (entry.payment ?? 0) - (entry.deposit ?? 0) : (entry.deposit ?? 0) - (entry.payment ?? 0));
  const increasesCleared = creditNormal ? detail.paymentsTotal : detail.depositsTotal;
  const increasesClearedCount = creditNormal ? detail.paymentsCount : detail.depositsCount;
  const decreasesCleared = creditNormal ? detail.depositsTotal : detail.paymentsTotal;
  const decreasesClearedCount = creditNormal ? detail.depositsCount : detail.paymentsCount;
  const increasesLabel = creditNormal ? "Charges and cash advances" : "Deposits and other credits";
  const decreasesLabel = creditNormal ? "Payments and other credits" : "Checks and payments";
  const unclearedIncreases = detail.unclearedEntries.reduce((sum, entry) => sum + Math.max(naturalOf(entry), 0), 0);
  const unclearedDecreases = detail.unclearedEntries.reduce((sum, entry) => sum + Math.max(-naturalOf(entry), 0), 0);
  const proofDifference = detail.adjustedBankBalance - detail.bookBalance;
  const unclearedDeposits = detail.unclearedEntries.filter((entry) => (entry.deposit ?? 0) > 0);
  const unclearedPayments = detail.unclearedEntries.filter((entry) => (entry.payment ?? 0) > 0);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumb />
          <h1 className="flex items-center gap-1.5 text-2xl font-semibold text-[var(--color-text-global)]">
            Reconciliation report
            <HelpCircle className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
          </h1>
        </div>
        <div className="flex gap-2">
          <Link href="/all-apps/reconcile?view=summary">
            <Button variant="secondary">Summary</Button>
          </Link>
          <Link href="/all-apps/reconcile">
            <Button variant="secondary">Reconcile</Button>
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-6">
        <div className="w-56">
          <Select label="Account" value={detail.accountId} onChange={handleAccountChange} options={groupedAccountOptions} placeholder="Select account" allowCustomValue={false} />
        </div>
        <div className="w-44">
          <Select
            label="Statement ending date"
            value={detail.id}
            onChange={(id) => router.push(`/all-apps/reconcile/report/${id}`)}
            options={statementDateOptions}
            placeholder="Statement ending date"
            allowCustomValue={false}
          />
        </div>
        <label className="mb-2.5 flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <Checkbox checked={hideAdditionalInfo} onChange={(e) => setHideAdditionalInfo(e.target.checked)} />
          Hide additional information
        </label>
      </div>

      <section className="report-print-card w-full rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5 shadow-sm">
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
            <p className="text-[var(--color-text-primary)]">
              {decreasesLabel} cleared ({decreasesClearedCount})
            </p>
            <p className="text-right text-[var(--color-text-global)]">{formatMoney(-decreasesCleared)}</p>
            <p className="text-[var(--color-text-primary)]">
              {increasesLabel} cleared ({increasesClearedCount})
            </p>
            <p className="text-right text-[var(--color-text-global)]">{formatMoney(increasesCleared)}</p>
            {detail.serviceChargeAmount !== null ? (
              <>
                <p className="text-[var(--color-text-primary)]">{creditNormal ? "Finance charge" : "Service charge"}</p>
                <p className="text-right text-[var(--color-text-global)]">{formatMoney(creditNormal ? detail.serviceChargeAmount : -detail.serviceChargeAmount)}</p>
              </>
            ) : null}
            {detail.interestEarnedAmount !== null ? (
              <>
                <p className="text-[var(--color-text-primary)]">Interest earned</p>
                <p className="text-right text-[var(--color-text-global)]">{formatMoney(creditNormal ? -detail.interestEarnedAmount : detail.interestEarnedAmount)}</p>
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
          <div className="mt-6 grid grid-cols-2 gap-y-1 text-sm">
            <p className="text-[var(--color-text-primary)]">Uncleared transactions as of {detail.statementEndingDate}</p>
            <p className="text-right text-[var(--color-text-global)]">{formatMoney(unclearedIncreases - unclearedDecreases)}</p>
            <p className="text-[var(--color-text-primary)]">Register balance as of {detail.statementEndingDate}</p>
            <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.registerBalance)}</p>
          </div>
          {hideAdditionalInfo ? null : (
            <>
          <p className="mb-2 mt-6 text-sm font-semibold text-[var(--color-text-global)]">Bank vs. book balance as of {detail.statementEndingDate}</p>
          <div className="grid grid-cols-2 gap-y-1 text-sm">
            <p className="text-[var(--color-text-primary)]">Balance per bank statement</p>
            <p className="text-right text-[var(--color-text-global)]">{formatMoney(detail.statementEndingBalance)}</p>
            <p className="text-[var(--color-text-primary)]">
              {creditNormal ? "Add: uncleared charges and cash advances" : "Add: deposits in transit (uncleared deposits and credits)"}
            </p>
            <p className="text-right text-[var(--color-text-global)]">{formatMoney(unclearedIncreases)}</p>
            <p className="text-[var(--color-text-primary)]">
              {creditNormal ? "Less: uncleared payments and credits" : "Less: outstanding checks (uncleared checks and payments)"}
            </p>
            <p className="text-right text-[var(--color-text-global)]">{formatMoney(-unclearedDecreases)}</p>
            <p className="border-t border-[var(--color-divider-tertiary)] pt-1 font-medium text-[var(--color-text-global)]">Adjusted bank balance</p>
            <p className="border-t border-[var(--color-divider-tertiary)] pt-1 text-right font-medium text-[var(--color-text-global)]">{formatMoney(detail.adjustedBankBalance)}</p>
            <p className="mt-2 text-[var(--color-text-primary)]">Balance per books (register)</p>
            <p className="mt-2 text-right text-[var(--color-text-global)]">{formatMoney(detail.bookBalance)}</p>
            <p className="border-t border-[var(--color-divider-tertiary)] pt-1 font-medium text-[var(--color-text-global)]">Difference</p>
            <p className={`border-t border-[var(--color-divider-tertiary)] pt-1 text-right font-medium ${detail.isBalanced ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
              {formatMoney(proofDifference)}
            </p>
          </div>
          <p className={`mt-2 text-xs ${detail.isBalanced ? "text-[var(--color-positive)]" : "text-[var(--color-negative)]"}`}>
            {detail.isBalanced
              ? "The bank and the books agree once the uncleared items are accounted for."
              : "The bank and the books do NOT agree. A transaction that was already reconciled has likely been changed, voided, or un-reconciled since this statement."}
          </p>
            </>
          )}
        </div>

        <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Details</p>
        <EntryGroup title={`${creditNormal ? increasesLabel : decreasesLabel} cleared`} entries={payments} amountOf={(entry) => entry.payment} />
        <EntryGroup title={`${creditNormal ? decreasesLabel : increasesLabel} cleared`} entries={deposits} amountOf={(entry) => entry.deposit} />

        {!hideAdditionalInfo && detail.unclearedEntries.length > 0 ? (
          <div className="mt-6 border-t border-[var(--color-divider-tertiary)] pt-4">
            <p className="mb-2 text-sm font-semibold text-[var(--color-text-global)]">Additional Information</p>
            <EntryGroup title={`Uncleared ${creditNormal ? decreasesLabel : increasesLabel} as of ${detail.statementEndingDate}`.replace(/^Uncleared (.)/, (_m, c: string) => `Uncleared ${c.toLowerCase()}`)} entries={unclearedDeposits} amountOf={(entry) => entry.deposit} />
            <EntryGroup title={`Uncleared ${creditNormal ? increasesLabel : decreasesLabel} as of ${detail.statementEndingDate}`.replace(/^Uncleared (.)/, (_m, c: string) => `Uncleared ${c.toLowerCase()}`)} entries={unclearedPayments} amountOf={(entry) => entry.payment} />
          </div>
        ) : null}
      </section>
    </>
  );
}
