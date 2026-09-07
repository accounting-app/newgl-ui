"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, MessageSquarePlus, Printer, Settings, Share } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account, RegisterEntry } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TRANSACTION_TYPE_LABELS: Record<RegisterEntry["transactionType"], string> = {
  CHECK: "Check",
  DEPOSIT: "Deposit",
  SALES_RECEIPT: "Sales receipt",
  RECEIVE_PAYMENT: "Payment",
  BILL_PAYMENT: "Bill payment",
  REFUND: "Refund",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  JOURNAL_ENTRY: "Journal entry"
};

const PAGE_SIZE = 25;

// A read-only ledger view scoped to one account, reached from Chart of
// Accounts' "View register" action -- NOT the real interactive /register
// (that stays untouched). Reuses the same registerService.listRegisterEntries
// read API /register itself is built on, so the numbers always agree with
// the real register, but renders through its own markup rather than
// importing anything from src/components/bank-register/.
export function AccountRegisterView({
  accountId,
  accounts,
  onBack,
  onChangeAccount
}: {
  accountId: string;
  accounts: Account[];
  onBack: () => void;
  onChangeAccount: (accountId: string) => void;
}) {
  const services = useMemo(() => getServiceContainer(), []);
  const [entries, setEntries] = useState<RegisterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const account = accounts.find((a) => a.id === accountId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    services.registerService
      .listRegisterEntries(accountId)
      .then((list) => {
        if (!cancelled) setEntries(list);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, services.registerService]);

  const sorted = useMemo(() => [...entries].sort((a, b) => b.date.localeCompare(a.date)), [entries]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = sorted.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, sorted.length);
  const pageRows = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <>
      <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 text-sm font-medium text-[var(--color-link-action)] hover:underline">
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        Back to Chart of Accounts
      </button>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Bank Register</h1>
          <div className="w-52">
            <Select
              value={accountId}
              onChange={onChangeAccount}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
              placeholder="Select account"
              allowCustomValue={false}
            />
          </div>
          <div className="text-sm text-[var(--color-text-primary)]">
            <p className="text-xs uppercase tracking-wide text-[var(--color-icon-secondary)]">Bank Balance</p>
            {/* No live bank feed yet (Phase 1.5) -- shown as $0.00 rather
                than implying a synced balance that doesn't exist, same
                convention as Bank Transactions' balance card. */}
            <p className="font-medium">{formatMoney(0)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div>
            <p className="text-right text-xs uppercase tracking-wide text-[var(--color-icon-secondary)]">Ending balance</p>
            <p className="text-right text-2xl font-semibold text-[var(--color-text-global)]">{formatMoney(account?.currentBalance ?? 0)}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/all-apps/bank-transactions" className="rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)]">
              Bank transactions
            </Link>
            <button type="button" disabled title="Not available yet" className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
              Feedback
            </button>
            <Link href="/all-apps/reconcile" className="rounded-full bg-[var(--color-action-standard)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-inverse)] hover:bg-[var(--color-ui-positive)]">
              Reconcile
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--color-text-primary)]">
          Go to: {currentPage} of {totalPages}
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage(1)} className="ml-3 disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)] hover:enabled:text-[var(--color-text-highlight)]">
            First
          </button>
          <button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="ml-3 disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)] hover:enabled:text-[var(--color-text-highlight)]">
            Previous
          </button>
          <span className="ml-3">{pageStart}-{pageEnd} of {sorted.length}</span>
          <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="ml-3 disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)] hover:enabled:text-[var(--color-text-highlight)]">
            Next
          </button>
          <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)} className="ml-3 disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)] hover:enabled:text-[var(--color-text-highlight)]">
            Last
          </button>
        </span>
      </div>

      <div className="tw-override overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)]">
        <div className="flex items-center justify-between bg-[var(--color-container-background-accent)] px-2 py-1.5">
          <div className="w-28">
            <Select
              value="all"
              onChange={() => {}}
              options={[{ value: "all", label: "All" }]}
              placeholder="All"
              allowCustomValue={false}
              optionSize="sm"
            />
          </div>
          <div className="flex items-center gap-1">
            <IconButton icon={Printer} label="Print" size="sm" />
            <IconButton icon={Share} label="Export" size="sm" />
            <IconButton icon={Settings} label="Settings" size="sm" />
          </div>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">Date</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Ref no. / Type</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Payee / Account</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Memo</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Payment</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Deposit</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-center align-middle">✓</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Balance</th>
            </tr>
          </thead>
          <tbody className="content-table">
            <tr
              className="cursor-not-allowed border-t border-[var(--color-divider-tertiary)] text-[var(--color-text-disabled)]"
              title="Adding journal entries here isn't available yet -- use /register for that"
            >
              <td colSpan={8} className="p-2 text-[13px]">
                Add journal entry
              </td>
            </tr>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-[var(--color-text-disabled)]">
                  There are no transactions in this register yet.
                </td>
              </tr>
            ) : (
              pageRows.map((entry) => (
                <tr key={entry.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top text-[13px] text-[var(--color-text-primary)]">{entry.date}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]">
                    <p className="text-[var(--color-text-primary)]">{entry.refNumber || "--"}</p>
                    <p className="text-xs text-[var(--color-icon-secondary)]">{TRANSACTION_TYPE_LABELS[entry.transactionType]}</p>
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]">
                    <p className="text-[var(--color-text-global)]">{entry.payee || "--"}</p>
                    <p className="text-xs text-[var(--color-icon-secondary)]">{entry.accountLabel || "--"}</p>
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{entry.memo || ""}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">
                    {entry.payment ? formatMoney(entry.payment) : ""}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">
                    {entry.deposit ? formatMoney(entry.deposit) : ""}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-center text-[13px] text-[var(--color-text-primary)]">{entry.reconcileStatus || ""}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] font-medium text-[var(--color-text-global)]">
                    {formatMoney(entry.runningBalance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
