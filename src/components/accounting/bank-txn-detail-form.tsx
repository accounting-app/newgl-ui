"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { INPUT_BASE_CLASSES } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import type { PendingBankTxn } from "@/lib/local-store/accounting-types";

export const PURPOSE_OPTIONS: SelectOption[] = [
  { value: "BUSINESS", label: "Business" },
  { value: "PERSONAL", label: "Personal" }
];

type DetailTxn = {
  id: string;
  description: string;
  spent?: number;
  received?: number;
  payee?: string;
  categoryAccountId?: string;
  purpose?: PendingBankTxn["purpose"];
  memo?: string;
  txnType?: PendingBankTxn["txnType"];
};

type BankTxnDetailFormProps = {
  txn: DetailTxn;
  payeeOptions: SelectOption[];
  accountOptions: SelectOption[];
  onChange: (patch: Partial<PendingBankTxn>) => void;
  onAddPayee: () => void;
  onPost: () => void;
  onExclude: () => void;
  onClose: () => void;
};

const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";

// The panel that opens under a pending row (QBO's "Categorize" form): every
// field here edits the same staged row the table cells do, so the two stay in
// step. Match, Split, Product/Service and Files are shown but disabled until
// those features exist.
export function BankTxnDetailForm({ txn, payeeOptions, accountOptions, onChange, onAddPayee, onPost, onExclude, onClose }: BankTxnDetailFormProps) {
  const direction = txn.received ? "in" : "out";
  const txnTypeOptions: SelectOption[] =
    direction === "in"
      ? [{ value: "Deposit", label: "Deposit" }, { value: "Transfer", label: "Transfer" }]
      : [{ value: "Expense", label: "Expense" }, { value: "Transfer", label: "Transfer" }];
  const txnType = txn.txnType ?? (direction === "in" ? "Deposit" : "Expense");

  return (
    <div className="border-t border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] px-4 pb-5 pt-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="inline-flex gap-0.5 rounded-md bg-[var(--color-segmented-background)] p-0.5 text-sm">
          <button type="button" disabled title="Matching to existing transactions isn't available yet" className="h-7 cursor-not-allowed rounded-[5px] px-3 text-[var(--color-text-disabled)]">
            Match
          </button>
          <button type="button" aria-pressed className="h-7 rounded-[5px] bg-[var(--color-container-background-primary)] px-3 text-[var(--color-text-global)] shadow-sm">
            Categorize
          </button>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex cursor-not-allowed items-center gap-2 text-sm text-[var(--color-text-disabled)]" title="Suggestions aren't available yet">
            Show suggestions
            <input type="checkbox" disabled role="switch" aria-label="Show suggestions" />
          </label>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-primary)]">Full Bank Description</p>
      <p className="mb-4 text-sm font-medium text-[var(--color-text-global)] underline">{txn.description}</p>

      <div className="mb-4 grid max-w-[760px] grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <span className={LABEL}>Transaction type</span>
          <Select value={txnType} onChange={(v) => onChange({ txnType: v as PendingBankTxn["txnType"] })} options={txnTypeOptions} placeholder="Type" allowCustomValue={false} />
        </div>
        <div>
          <span className={LABEL}>Purpose</span>
          <Select value={txn.purpose ?? "BUSINESS"} onChange={(v) => onChange({ purpose: v as PendingBankTxn["purpose"] })} options={PURPOSE_OPTIONS} placeholder="Purpose" allowCustomValue={false} />
        </div>
      </div>

      <div className="mb-4 grid max-w-[1140px] grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <span className={LABEL}>From/To</span>
          <Select
            value={txn.payee ?? ""}
            onChange={(v) => onChange({ payee: v || undefined })}
            options={payeeOptions}
            placeholder={direction === "in" ? "Select customer" : "Select vendor"}
            allowCustomValue={false}
            onAddNew={onAddPayee}
            addNewLabel="+ Add new"
          />
        </div>
        <div>
          <span className={LABEL}>Account</span>
          <Select value={txn.categoryAccountId ?? ""} onChange={(v) => onChange({ categoryAccountId: v || undefined })} options={accountOptions} placeholder="Select category" allowCustomValue={false} />
        </div>
        <div>
          <span className={LABEL}>Product/Service</span>
          <Select value="" onChange={() => undefined} options={[]} placeholder="Select product/service" allowCustomValue={false} disabled />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-start gap-8">
        <div className="min-w-[320px] max-w-[760px] flex-1">
          <label className={LABEL} htmlFor={`memo-${txn.id}`}>Memo</label>
          <textarea
            id={`memo-${txn.id}`}
            rows={4}
            value={txn.memo ?? ""}
            placeholder={txn.description}
            onChange={(event) => onChange({ memo: event.target.value })}
            className={`${INPUT_BASE_CLASSES} resize-y rounded p-3 text-sm`}
          />
        </div>
        <div>
          <span className={LABEL}>Files</span>
          <Button variant="secondary" size="sm" disabled title="Attachments aren't available yet">
            Upload
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={onPost}>Post</Button>
        <Button variant="secondary" disabled title="Splitting one transaction across several categories isn't available yet">
          Split
        </Button>
        <Link href="/all-apps/bank-rules" className="px-1 text-base text-[var(--color-text-global)] hover:underline">
          Create rule
        </Link>
        <button type="button" onClick={onExclude} className="px-1 text-base text-[var(--color-text-global)] hover:underline">
          Exclude
        </button>
      </div>
    </div>
  );
}
