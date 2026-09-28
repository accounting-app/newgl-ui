"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast/toast-context";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { finishReconciliation } from "@/lib/services/reconciliation-service";
import type { Account, RegisterEntry } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type EntryTab = "payments" | "deposits" | "all";

const TAB_LABEL: Record<EntryTab, string> = {
  payments: "Payments",
  deposits: "Deposits",
  all: "All"
};

/**
 * The real matching workspace, reached from the setup form in
 * reconcile-page.tsx. Checking/unchecking a transaction here never calls
 * the API by itself -- it only updates local state and the live math bar.
 * The only write is "Finish now", which sends the whole checked set to
 * POST /accounts/{accountId}/reconciliations/finish in one call (Save for
 * later is out of scope for this pass -- see the plan).
 */
export function ReconciliationSessionPage({ accountId }: { accountId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);

  const statementStartDate = searchParams.get("statementStartDate") ?? "";
  const statementEndingDate = searchParams.get("statementEndingDate") ?? "";
  const statementEndingBalance = Number(searchParams.get("statementEndingBalance") ?? "0");
  const beginningBalance = Number(searchParams.get("statementBeginningBalance") ?? "0");
  const serviceChargeAmount = searchParams.get("serviceChargeAmount");
  const serviceChargeDate = searchParams.get("serviceChargeDate");
  const serviceChargeExpenseAccountId = searchParams.get("serviceChargeExpenseAccountId");
  const interestEarnedAmount = searchParams.get("interestEarnedAmount");
  const interestEarnedDate = searchParams.get("interestEarnedDate");
  const interestEarnedIncomeAccountId = searchParams.get("interestEarnedIncomeAccountId");

  const [account, setAccount] = useState<Account | null>(null);
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<EntryTab>("all");
  const [pendingCleared, setPendingCleared] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([services.accountService.getAccountById(accountId), services.registerService.listRegisterEntries(accountId)])
      .then(([loadedAccount, allEntries]) => {
        if (cancelled) return;
        const inRange = allEntries.filter((entry) => entry.status === "POSTED" && (!statementEndingDate || entry.date <= statementEndingDate));
        setAccount(loadedAccount);
        setEntries(inRange);
        setPendingCleared(new Set(inRange.filter((entry) => entry.reconcileStatus === "C" || entry.reconcileStatus === "R").map((entry) => entry.transactionId)));
      })
      .catch(() => {
        if (!cancelled) toast({ variant: "error", title: "Couldn't load this account's register" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, services, statementEndingDate, toast]);

  const visibleEntries = useMemo(() => {
    if (tab === "payments") return entries.filter((entry) => (entry.payment ?? 0) > 0);
    if (tab === "deposits") return entries.filter((entry) => (entry.deposit ?? 0) > 0);
    return entries;
  }, [entries, tab]);

  const { paymentsTotal, depositsTotal } = useMemo(() => {
    let payments = 0;
    let deposits = 0;
    for (const entry of entries) {
      if (!pendingCleared.has(entry.transactionId)) continue;
      payments += entry.payment ?? 0;
      deposits += entry.deposit ?? 0;
    }
    return { paymentsTotal: payments, depositsTotal: deposits };
  }, [entries, pendingCleared]);

  const clearedBalance = beginningBalance - paymentsTotal + depositsTotal;
  const difference = statementEndingBalance - clearedBalance;
  const isBalanced = Math.abs(difference) < 0.005;

  function toggleEntry(transactionId: string) {
    setPendingCleared((current) => {
      const next = new Set(current);
      if (next.has(transactionId)) next.delete(transactionId);
      else next.add(transactionId);
      return next;
    });
  }

  async function handleFinish() {
    if (!isBalanced || submitting) return;
    setSubmitting(true);
    try {
      await finishReconciliation(accountId, {
        statementStartDate,
        statementEndingDate,
        statementEndingBalance,
        clearedTransactionIds: [...pendingCleared],
        ...(serviceChargeAmount && serviceChargeDate && serviceChargeExpenseAccountId
          ? { serviceCharge: { amount: Number(serviceChargeAmount), date: serviceChargeDate, expenseAccountId: serviceChargeExpenseAccountId } }
          : {}),
        ...(interestEarnedAmount && interestEarnedDate && interestEarnedIncomeAccountId
          ? { interestEarned: { amount: Number(interestEarnedAmount), date: interestEarnedDate, incomeAccountId: interestEarnedIncomeAccountId } }
          : {})
      });
      toast({ variant: "success", title: "Reconciliation complete" });
      router.push("/all-apps/reconcile");
    } catch (error) {
      toast({ variant: "error", title: error instanceof Error ? error.message : "Couldn't finish this reconciliation" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || !account) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">{account.name}</h1>
          <p className="text-sm text-[var(--color-text-primary)]">Statement ending date: {statementEndingDate}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => router.back()}>
            Edit info
          </Button>
          <Link href="/all-apps/reconcile">
            <Button variant="secondary">Save for later</Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-8 rounded-lg border border-[var(--color-divider-tertiary)] p-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xl font-semibold text-[var(--color-text-global)]">{formatMoney(statementEndingBalance)}</p>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Statement ending balance</p>
          </div>
          <span className="text-[var(--color-text-primary)]">-</span>
          <div>
            <p className="text-xl font-semibold text-[var(--color-text-global)]">{formatMoney(clearedBalance)}</p>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Cleared balance</p>
          </div>
        </div>

        <div className="flex items-center gap-4 border-l border-[var(--color-divider-tertiary)] pl-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Beginning balance</p>
            <p className="text-sm text-[var(--color-text-global)]">{formatMoney(beginningBalance)}</p>
          </div>
          <span className="text-[var(--color-text-primary)]">-</span>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Payments</p>
            <p className="text-sm text-[var(--color-text-global)]">{formatMoney(paymentsTotal)}</p>
          </div>
          <span className="text-[var(--color-text-primary)]">+</span>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Deposits</p>
            <p className="text-sm text-[var(--color-text-global)]">{formatMoney(depositsTotal)}</p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 border-l border-[var(--color-divider-tertiary)] pl-8">
          {!isBalanced ? <AlertTriangle className="h-5 w-5 text-[var(--color-warning-text)]" aria-hidden="true" /> : null}
          <div>
            <p className={`text-xl font-semibold ${isBalanced ? "text-[var(--color-positive)]" : "text-[var(--color-text-global)]"}`}>{formatMoney(difference)}</p>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-primary)]">Difference</p>
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-[var(--color-container-background-secondary)] p-1">
          {(["payments", "deposits", "all"] as EntryTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                tab === t ? "bg-[var(--color-container-background-primary)] text-[var(--color-text-global)] shadow-sm" : "text-[var(--color-text-primary)]"
              }`}
            >
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <Button onClick={handleFinish} disabled={!isBalanced || submitting}>
          {submitting ? "Finishing…" : "Finish now"}
        </Button>
      </div>

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">Date</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Type</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Ref No.</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Account</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Payee</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Memo</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Payment</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Deposit</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-center align-middle">Cleared</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {visibleEntries.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-sm text-[var(--color-text-primary)]">
                  There are no transactions showing for this account in this time period.
                </td>
              </tr>
            ) : (
              visibleEntries.map((entry) => (
                <tr key={entry.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top text-[13px] text-[var(--color-text-primary)]">{entry.date}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{entry.transactionType}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{entry.refNumber ?? ""}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{entry.accountLabel ?? ""}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-global)]">{entry.payee ?? ""}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{entry.memo ?? ""}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">
                    {entry.payment ? formatMoney(entry.payment) : ""}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">
                    {entry.deposit ? formatMoney(entry.deposit) : ""}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 text-center align-top">
                    <Checkbox checked={pendingCleared.has(entry.transactionId)} onChange={() => toggleEntry(entry.transactionId)} aria-label="Cleared" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
