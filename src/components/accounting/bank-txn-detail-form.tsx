"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { X } from "lucide-react";
import { BankTxnSuggestions } from "@/components/accounting/bank-txn-suggestions";
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
  productServiceId?: string;
};

type BankTxnDetailFormProps = {
  txn: DetailTxn;
  payeeOptions: SelectOption[];
  accountOptions: SelectOption[];
  onChange: (patch: Partial<PendingBankTxn>) => void;
  onAddPayee: () => void;
  productOptions: SelectOption[];
  onAddProduct: () => void;
  onAddSuggestedPayee: (prefill: { name: string; website: string | null }) => void;
  onPost: () => void;
  onExclude: () => void;
  onClose: () => void;
};

const LABEL = "mb-1 block text-sm leading-[21px] text-[var(--color-text-primary)]";
// QBO's form controls are 32px tall and ~215px wide (memo ~545px); the shared
// Select renders at 36px, so its input is trimmed inside these wrappers.
const FIELD = "w-[215px] [&_input]:h-8";

// A pill switch (role=switch) -- QBO's "Show suggestions" control.
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--color-ui-primary)]" : "bg-[var(--color-icon-muted)]"}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}

// The panel that opens under a pending row (QBO's "Categorize" form): every
// field here edits the same staged row the table cells do, so the two stay in
// step. Match, Split and Files are shown but disabled until
// those features exist.
export function BankTxnDetailForm({ txn, payeeOptions, accountOptions, onChange, onAddPayee, onAddSuggestedPayee, productOptions, onAddProduct, onPost, onExclude, onClose }: BankTxnDetailFormProps) {
  const memoRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const direction = txn.received ? "in" : "out";
  const txnTypeOptions: SelectOption[] =
    direction === "in"
      ? [{ value: "Deposit", label: "Deposit" }, { value: "Transfer", label: "Transfer" }]
      : [{ value: "Expense", label: "Expense" }, { value: "Transfer", label: "Transfer" }];
  const txnType = txn.txnType ?? (direction === "in" ? "Deposit" : "Expense");

  return (
    <div className="border-t border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] px-7 pb-5 pt-4">
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
          {!showSuggestions ? (
            <span className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
              Show suggestions
              <Switch checked={showSuggestions} onChange={setShowSuggestions} label="Show suggestions" />
            </span>
          ) : null}
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={showSuggestions ? "grid gap-0 lg:grid-cols-2" : ""}>
        <div className={showSuggestions ? "pr-8" : ""}>
      <p className="text-sm text-[var(--color-text-primary)]">Full Bank Description</p>
      <button
        type="button"
        onClick={() => memoRef.current?.focus()}
        className="mb-4 text-left text-sm font-medium leading-[21px] text-[var(--color-text-global)] underline"
      >
        {txn.description}
      </button>

      <div className="mb-5 flex flex-wrap gap-4">
        <div>
          <span className={LABEL}>Transaction type</span>
          <div className={FIELD}>
            <Select value={txnType} onChange={(v) => onChange({ txnType: v as PendingBankTxn["txnType"] })} options={txnTypeOptions} placeholder="Type" allowCustomValue={false} />
          </div>
        </div>
        <div>
          <span className={LABEL}>Purpose</span>
          <div className={FIELD}>
            <Select value={txn.purpose ?? "BUSINESS"} onChange={(v) => onChange({ purpose: v as PendingBankTxn["purpose"] })} options={PURPOSE_OPTIONS} placeholder="Purpose" allowCustomValue={false} />
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-4">
        <div>
          <span className={LABEL}>From/To</span>
          <div className={`${FIELD} [&_svg]:hidden`}>
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
        </div>
        <div>
          <span className={LABEL}>Account</span>
          <div className={FIELD}>
            <Select value={txn.categoryAccountId ?? ""} onChange={(v) => onChange({ categoryAccountId: v || undefined })} options={accountOptions} placeholder="Select category" allowCustomValue={false} />
          </div>
        </div>
      </div>
      {/* QBO offers Product/Service only for a Deposit (a sale); expenses and transfers don't have it. */}
      {txnType === "Deposit" ? (
        <div className="mb-5">
          <span className={LABEL}>Product/Service</span>
          <div className={FIELD}>
            <Select
              value={txn.productServiceId ?? ""}
              onChange={(v) => onChange({ productServiceId: v || undefined })}
              options={productOptions}
              placeholder="Select product/service"
              allowCustomValue={false}
              onAddNew={onAddProduct}
              addNewLabel="+ Add new"
            />
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-start gap-8">
        <div className="w-[545px] max-w-full">
          <label className={LABEL} htmlFor={`memo-${txn.id}`}>Memo</label>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(txn.description)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-1 block text-sm font-semibold leading-[21px] text-[var(--color-negative)] hover:underline"
          >
            Google Memo
          </a>
          <textarea
            ref={memoRef}
            id={`memo-${txn.id}`}
            rows={3}
            value={txn.memo ?? ""}
            placeholder={txn.description}
            onChange={(event) => onChange({ memo: event.target.value })}
            className={`${INPUT_BASE_CLASSES} h-20 resize-y rounded px-3 py-2 text-sm`}
          />
        </div>
        <div>
          <span className={LABEL}>Files</span>
          <Button variant="secondary" size="sm" className="!rounded-md" disabled title="Attachments aren't available yet">
            Upload
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button size="sm" className="!rounded-md px-5" onClick={onPost}>Post</Button>
        <Button size="sm" variant="secondary" className="!rounded-md px-5" disabled title="Splitting one transaction across several categories isn't available yet">
          Split
        </Button>
        <Link href="/all-apps/bank-rules" className="px-1 text-sm text-[var(--color-text-global)] hover:underline">
          Create rule
        </Link>
        <button type="button" onClick={onExclude} className="px-1 text-sm text-[var(--color-text-global)] hover:underline">
          Exclude
        </button>
      </div>
        </div>
        {showSuggestions ? (
          <div className="border-l border-[var(--color-divider-tertiary)] pl-8">
            <div className="mb-4 flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
              Show suggestions
              <Switch checked={showSuggestions} onChange={setShowSuggestions} label="Show suggestions" />
            </div>
            <BankTxnSuggestions
              txn={txn}
              accountOptions={accountOptions}
              payeeOptions={payeeOptions}
              onApplyAccount={(accountId) => onChange({ categoryAccountId: accountId })}
              onApplyPayee={(name) => onChange({ payee: name })}
              onAddSuggestedPayee={onAddSuggestedPayee}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
