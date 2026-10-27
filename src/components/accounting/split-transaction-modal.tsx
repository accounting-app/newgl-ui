"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { LinkedFiles } from "@/components/accounting/linked-files";
import { Button } from "@/components/ui/button";
import { INPUT_BASE_CLASSES } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { PURPOSE_OPTIONS } from "@/components/accounting/bank-txn-detail-form";
import type { PendingBankTxn } from "@/lib/local-store/accounting-types";

export type SplitLine = {
  id: string;
  payee: string;
  purpose: NonNullable<PendingBankTxn["purpose"]>;
  categoryAccountId: string;
  description: string;
  amount: string;
};

type SplitTxn = {
  id: string;
  date: string;
  description: string;
  spent?: number;
  received?: number;
  payee?: string;
  memo?: string;
  categoryAccountId?: string;
  purpose?: PendingBankTxn["purpose"];
};

type SplitTransactionModalProps = {
  open: boolean;
  txn: SplitTxn | null;
  bankAccountName: string;
  payeeOptions: SelectOption[];
  accountOptions: SelectOption[];
  formatDate: (isoDate: string) => string;
  formatMoney: (value: number) => string;
  onClose: () => void;
  /** Posts the split; the modal closes when it resolves, and shows the error if it rejects. */
  onConfirm: (lines: SplitLine[], memo: string) => Promise<void>;
};

let lineCounter = 0;
function newLine(seed: Partial<SplitLine> = {}): SplitLine {
  lineCounter += 1;
  return { id: `split-${lineCounter}`, payee: "", purpose: "BUSINESS", categoryAccountId: "", description: "", amount: "", ...seed };
}

const toCents = (value: string) => Math.round((Number(value) || 0) * 100);
const HEAD = "px-3 py-3 text-left text-sm font-semibold uppercase text-[var(--color-text-global)]";

// QBO's "Split transaction": one bank line divided across several categories
// (and contacts), each with its own amount. It can only be posted when the
// parts add up exactly to the bank amount.
export function SplitTransactionModal({ open, txn, bankAccountName, payeeOptions, accountOptions, formatDate, formatMoney, onClose, onConfirm }: SplitTransactionModalProps) {
  const [lines, setLines] = useState<SplitLine[]>([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialLines = (source: SplitTxn): SplitLine[] => [
    newLine({ payee: source.payee ?? "", purpose: source.purpose ?? "BUSINESS", categoryAccountId: source.categoryAccountId ?? "" }),
    newLine({ purpose: source.purpose ?? "BUSINESS" })
  ];

  useEffect(() => {
    if (!open || !txn) return;
    setLines(initialLines(txn));
    setMemo(txn.memo ?? txn.description);
    setSaving(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when it opens
  }, [open]);

  const originalCents = Math.round(((txn?.received ?? txn?.spent) ?? 0) * 100);
  const splitCents = useMemo(() => lines.reduce((sum, line) => sum + toCents(line.amount), 0), [lines]);
  const differenceCents = originalCents - splitCents;
  const canPost = differenceCents === 0 && lines.length >= 2 && lines.every((l) => l.categoryAccountId && toCents(l.amount) > 0);

  if (!open || !txn) return null;
  const isReceived = Boolean(txn.received);
  const money = (cents: number) => formatMoney(cents / 100);

  const update = (id: string, patch: Partial<SplitLine>) => setLines((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  async function confirm() {
    if (!canPost || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(lines, memo);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post this split.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="Split transaction" className="flex w-full max-w-[1280px] flex-col overflow-hidden rounded-lg bg-[var(--color-container-background-primary)] shadow-2xl">
        <header className="flex items-center justify-between bg-[var(--color-container-background-accent)] px-8 py-5">
          <h2 className="text-2xl text-[var(--color-text-global)]">Split transaction</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-[var(--color-divider-tertiary)] py-6">
            <div>
              <p className="text-xs font-medium uppercase text-[var(--color-text-primary)]">Bank account</p>
              <p className="mt-1 text-2xl text-[var(--color-text-global)]">{bankAccountName}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-[var(--color-text-primary)]">Date</p>
              <p className="mt-1 text-2xl text-[var(--color-text-global)]">{formatDate(txn.date)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-[var(--color-text-primary)]">Full bank description</p>
              <p className="mt-1 text-2xl text-[var(--color-text-global)]">{txn.description}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase text-[var(--color-text-primary)]">{isReceived ? "Received" : "Spent"}</p>
              <p className="mt-1 text-5xl text-[var(--color-text-global)]">{money(originalCents)}</p>
            </div>
          </div>

          <table className="mt-6 w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[20%]" />
              <col className="w-[27%]" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[3%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[var(--color-divider-tertiary)]">
                <th className={HEAD}>From/To</th>
                <th className={`${HEAD} border-l border-[var(--color-divider-tertiary)]`}>Purpose</th>
                <th className={`${HEAD} border-l border-[var(--color-divider-tertiary)]`}>Category</th>
                <th className={`${HEAD} border-l border-[var(--color-divider-tertiary)]`}>Description</th>
                <th className={`${HEAD} border-l border-[var(--color-divider-tertiary)] text-right`}>Amount</th>
                <th aria-label="Remove line" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-[var(--color-divider-tertiary)] align-middle">
                  <td className="px-2 py-2">
                    <Select value={line.payee} onChange={(v) => update(line.id, { payee: v })} options={payeeOptions} placeholder="(Recommended)" allowCustomValue={false} />
                  </td>
                  <td className="px-2 py-2">
                    <Select value={line.purpose} onChange={(v) => update(line.id, { purpose: v as SplitLine["purpose"] })} options={PURPOSE_OPTIONS} placeholder="Purpose" allowCustomValue={false} />
                  </td>
                  <td className="px-2 py-2">
                    <Select value={line.categoryAccountId} onChange={(v) => update(line.id, { categoryAccountId: v })} options={accountOptions} placeholder="Select category" allowCustomValue={false} />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(event) => update(line.id, { description: event.target.value })}
                      aria-label="Line description"
                      className={`${INPUT_BASE_CLASSES} h-9 rounded px-3 text-sm`}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.amount}
                      onChange={(event) => update(line.id, { amount: event.target.value })}
                      aria-label="Line amount"
                      className={`${INPUT_BASE_CLASSES} h-9 rounded px-3 text-right text-sm`}
                    />
                  </td>
                  <td className="px-1 text-center">
                    <button
                      type="button"
                      aria-label="Remove line"
                      disabled={lines.length <= 2}
                      onClick={() => setLines((current) => current.filter((l) => l.id !== line.id))}
                      className="text-[var(--color-text-global)] hover:text-[var(--color-negative)] disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <Button variant="secondary" onClick={() => setLines((current) => [...current, newLine({ purpose: txn.purpose ?? "BUSINESS" })])} className="!rounded-md" iconLeft={Plus}>
                Add lines
              </Button>
              <button type="button" onClick={() => setLines(initialLines(txn))} className="font-medium text-[var(--color-link-action)] hover:underline">
                Reset
              </button>
            </div>
            <dl className="grid min-w-[360px] grid-cols-[1fr_auto] gap-x-12 gap-y-1 text-base font-medium text-[var(--color-text-global)]">
              <dt>Split amount</dt>
              <dd className="text-right">{money(splitCents)}</dd>
              <dt>Original amount</dt>
              <dd className="text-right">{money(originalCents)}</dd>
              <dt>Difference</dt>
              <dd className={`text-right ${differenceCents === 0 ? "" : "text-[var(--color-negative)]"}`}>{money(differenceCents)}</dd>
            </dl>
          </div>

          <div className="mt-6 border-b-2 border-[var(--color-divider-tertiary)] pb-6">
            <label htmlFor="split-memo" className="mb-1 block text-sm text-[var(--color-text-primary)]">Memo</label>
            <input id="split-memo" type="text" value={memo} onChange={(event) => setMemo(event.target.value)} className={`${INPUT_BASE_CLASSES} h-11 rounded px-3 text-base`} />
          </div>

          <div className="mt-5">
            <span className="mb-1 block text-sm text-[var(--color-text-primary)]">Files</span>
            {txn ? <LinkedFiles zone="bank" linkedId={txn.id} /> : null}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-[var(--color-divider-tertiary)] px-8 py-4">
          <button type="button" onClick={onClose} className="px-3 text-base font-medium text-[var(--color-text-global)] hover:underline">
            Cancel
          </button>
          <div className="flex items-center gap-4">
            {error ? <p className="text-sm text-[var(--color-negative)]" role="alert">{error}</p> : null}
            <Button onClick={() => void confirm()} disabled={!canPost || saving} className="!rounded-md">
              {saving ? "Posting..." : "Split and post"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
