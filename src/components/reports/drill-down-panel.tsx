"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { getTransactionsForAccount } from "@/lib/accounting/drill-down";
import type { DrillTransaction } from "@/lib/accounting/drill-down";
import type {
  Account,
  LedgerPosting,
  Transaction,
} from "@/modules/accounting/domain/models";

// ─── Public types (consumed by reports-page.tsx) ─────────────────────────────

export type AccountDrillLevel = {
  kind: "account";
  accountName: string;  // matches Account.name for lookup
  label: string;        // display label (leaf segment of the name)
  totalAmount: number;  // signed total in the date range
};

export type TransactionDrillLevel = {
  kind: "transaction";
  transactionId: string;
  label: string; // ref number, memo, or date — used for breadcrumb
};

export type DrillLevel = AccountDrillLevel | TransactionDrillLevel;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function formatMoney(value: number): string {
  return Math.abs(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

// ─── Level 2: transaction list for a single account ──────────────────────────

type AccountViewProps = {
  level: AccountDrillLevel;
  accounts: Account[];
  postings: LedgerPosting[];
  fromDate: string;
  toDate: string;
  onDrillTransaction: (txn: DrillTransaction) => void;
};

function AccountView({
  level,
  accounts,
  postings,
  fromDate,
  toDate,
  onDrillTransaction,
}: AccountViewProps) {
  const transactions = getTransactionsForAccount(
    level.accountName,
    postings,
    accounts,
    fromDate,
    toDate
  );

  if (transactions.length === 0) {
    return (
      <p className="mt-10 text-center text-sm text-[var(--color-text-disabled)]">
        No transactions found for this account in the selected period.
      </p>
    );
  }

  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <thead>
        <tr className="border-y border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
          <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-primary)]">
            Date
          </th>
          <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-primary)]">
            Description
          </th>
          <th className="px-3 py-1.5 text-left font-medium text-[var(--color-text-primary)]">
            Ref
          </th>
          <th className="px-3 py-1.5 text-right font-medium text-[var(--color-text-primary)]">
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((txn) => (
          <tr
            key={txn.transactionId}
            className="cursor-pointer border-b border-[var(--color-container-background-secondary)] hover:bg-[var(--color-table-row-hover)]"
            onClick={() => onDrillTransaction(txn)}
          >
            <td className="px-3 py-1.5 text-[var(--color-text-primary)]">
              {formatDate(txn.date)}
            </td>
            <td className="px-3 py-1.5 text-[var(--color-text-primary)]">
              {txn.memo || "—"}
            </td>
            <td className="px-3 py-1.5 text-[var(--color-text-disabled)]">
              {txn.referenceNumber || "—"}
            </td>
            <td className="px-3 py-1.5 text-right font-medium text-[var(--color-text-primary)]">
              {formatMoney(txn.amount)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Level 3: full journal entry for one transaction ─────────────────────────

type TransactionDetail = {
  transaction: Transaction;
  postings: LedgerPosting[];
};

function TransactionView({ level }: { level: TransactionDrillLevel }) {
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const services = getServiceContainer();
    setLoading(true);
    setError(null);
    services.registerService
      .getTransactionDetail(level.transactionId)
      .then(({ transaction, postings }) => {
        setDetail({ transaction, postings });
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to load transaction."
        );
      })
      .finally(() => setLoading(false));
  }, [level.transactionId]);

  if (loading) {
    return (
      <p className="mt-10 text-center text-sm text-[var(--color-text-disabled)]">
        Loading…
      </p>
    );
  }
  if (error || !detail) {
    return (
      <p className="mt-10 text-center text-sm text-red-600">
        {error ?? "Transaction not found."}
      </p>
    );
  }

  const { transaction, postings } = detail;

  return (
    <div className="mt-4 space-y-5 text-sm">
      {/* Header fields */}
      <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-1.5">
        <dt className="font-medium text-[var(--color-text-primary)]">Date</dt>
        <dd className="text-[var(--color-text-primary)]">
          {formatDate(transaction.transactionDate)}
        </dd>

        {transaction.payee ? (
          <>
            <dt className="font-medium text-[var(--color-text-primary)]">Payee</dt>
            <dd className="text-[var(--color-text-primary)]">{transaction.payee}</dd>
          </>
        ) : null}

        {transaction.memo ? (
          <>
            <dt className="font-medium text-[var(--color-text-primary)]">Memo</dt>
            <dd className="text-[var(--color-text-primary)]">{transaction.memo}</dd>
          </>
        ) : null}

        {transaction.referenceNumber ? (
          <>
            <dt className="font-medium text-[var(--color-text-primary)]">Reference</dt>
            <dd className="text-[var(--color-text-primary)]">
              {transaction.referenceNumber}
            </dd>
          </>
        ) : null}

        <dt className="font-medium text-[var(--color-text-primary)]">Type</dt>
        <dd className="text-[var(--color-text-primary)]">
          {transaction.type.replace(/_/g, " ")}
        </dd>

        <dt className="font-medium text-[var(--color-text-primary)]">Status</dt>
        <dd className="text-[var(--color-text-primary)]">{transaction.status}</dd>
      </dl>

      {/* Journal entry table */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
          Journal Entry
        </p>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-y border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)]">
              <th className="px-2 py-1.5 text-left font-medium text-[var(--color-text-primary)]">
                Account
              </th>
              <th className="px-2 py-1.5 text-right font-medium text-[var(--color-text-primary)]">
                Debit
              </th>
              <th className="px-2 py-1.5 text-right font-medium text-[var(--color-text-primary)]">
                Credit
              </th>
            </tr>
          </thead>
          <tbody>
            {postings.map((posting) => (
              <tr
                key={posting.id}
                className="border-b border-[var(--color-container-background-secondary)]"
              >
                <td className="px-2 py-1.5 text-[var(--color-text-primary)]">
                  {posting.accountName ?? posting.accountCode ?? posting.accountId}
                </td>
                <td className="px-2 py-1.5 text-right text-[var(--color-text-primary)]">
                  {posting.entryType === "DEBIT" ? formatMoney(posting.amount) : ""}
                </td>
                <td className="px-2 py-1.5 text-right text-[var(--color-text-primary)]">
                  {posting.entryType === "CREDIT" ? formatMoney(posting.amount) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

type DrillDownPanelProps = {
  stack: DrillLevel[];
  /** First breadcrumb segment, e.g. "Profit & Loss". */
  reportLabel: string;
  /** Second breadcrumb segment, e.g. "Income" or "Expenses". */
  sectionLabel: string;
  accounts: Account[];
  postings: LedgerPosting[];
  fromDate: string;
  toDate: string;
  onClose: () => void;
  onBack: () => void;
  onDrillTransaction: (level: TransactionDrillLevel) => void;
};

export function DrillDownPanel({
  stack,
  reportLabel,
  sectionLabel,
  accounts,
  postings,
  fromDate,
  toDate,
  onClose,
  onBack,
  onDrillTransaction,
}: DrillDownPanelProps) {
  const current = stack[stack.length - 1];
  if (!current) return null;

  const breadcrumb = [
    reportLabel,
    sectionLabel,
    ...stack.map((l) => l.label),
  ];

  return (
    <>
      {/* Translucent backdrop — clicking it closes the panel */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col border-l border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] shadow-2xl"
        aria-label="Report detail"
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-2 border-b border-[var(--color-divider-tertiary)] px-4 py-3">
          <div className="min-w-0 flex-1">
            {/* Breadcrumb */}
            <nav
              aria-label="Drill-down breadcrumb"
              className="mb-1 flex flex-wrap items-center gap-0.5 text-xs text-[var(--color-icon-secondary)]"
            >
              {breadcrumb.map((crumb, i) => (
                <span key={i} className="flex items-center gap-0.5">
                  {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                  <span
                    className={
                      i === breadcrumb.length - 1
                        ? "font-semibold text-[var(--color-text-primary)]"
                        : ""
                    }
                  >
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>

            {/* Title + amount (account level only) */}
            <div className="flex items-baseline gap-3">
              <h2 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                {current.label}
              </h2>
              {current.kind === "account" && (
                <span className="shrink-0 text-sm text-[var(--color-text-primary)]">
                  {formatMoney(current.totalAmount)}
                </span>
              )}
            </div>
          </div>

          {/* Nav buttons */}
          <div className="flex shrink-0 items-center gap-0.5">
            {stack.length > 1 && <IconButton icon={ArrowLeft} label="Go back" size="sm" onClick={onBack} />}
            <IconButton icon={X} label="Close panel" size="sm" onClick={onClose} />
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {current.kind === "account" ? (
            <AccountView
              level={current}
              accounts={accounts}
              postings={postings}
              fromDate={fromDate}
              toDate={toDate}
              onDrillTransaction={(txn) =>
                onDrillTransaction({
                  kind: "transaction",
                  transactionId: txn.transactionId,
                  label:
                    txn.referenceNumber || txn.memo || formatDate(txn.date),
                })
              }
            />
          ) : (
            <TransactionView level={current} />
          )}
        </div>
      </aside>
    </>
  );
}
