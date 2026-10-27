"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { BatchEditFields, BatchMemoMode } from "@/lib/accounting/register-batch";
import { hasBatchFieldSelected } from "@/lib/accounting/register-batch";

type BatchFieldsModalProps = {
  open: boolean;
  selectedCount: number;
  fields: BatchEditFields;
  onChange: (fields: BatchEditFields) => void;
  onClose: () => void;
  onContinue: () => void;
};

type FieldRowProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onToggle: (checked: boolean) => void;
  children?: React.ReactNode;
};

function FieldRow({ label, checked, disabled, hint, onToggle, children }: FieldRowProps) {
  return (
    <li className="py-2">
      <label className={`flex items-center gap-2 text-sm ${disabled ? "cursor-not-allowed text-[var(--color-text-disabled)]" : "cursor-pointer text-[var(--color-text-global)]"}`}>
        <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onToggle(event.target.checked)} />
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-xs font-normal">({hint})</span> : null}
      </label>
      {checked && children ? <div className="ml-6 mt-1.5 space-y-1 text-[13px] text-[var(--color-text-primary)]">{children}</div> : null}
    </li>
  );
}

// "Edit" in the Batch menu: pick which fields the batch will overwrite. The
// values themselves are typed in the pink row afterwards -- this only decides
// which of that row's cells are live. Source Account, Class and Location are
// listed (they exist in RightTool) but disabled: the ledger has no class or
// location, and moving an entry to another register isn't supported by the
// API yet.
export function BatchFieldsModal({ open, selectedCount, fields, onChange, onClose, onContinue }: BatchFieldsModalProps) {
  const set = (patch: Partial<BatchEditFields>) => onChange({ ...fields, ...patch });
  const setMemoMode = (mode: BatchMemoMode, on: boolean) => set({ memoMode: on ? mode : "replace" });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Batch edit"
      description={`Choose the fields to change on the ${selectedCount} selected transaction${selectedCount === 1 ? "" : "s"}.`}
      size="sm"
    >
      <ul className="divide-y divide-[var(--color-divider-tertiary)]">
        <FieldRow label="Source Account" checked={false} disabled hint="Move To Another Register -- not available yet" onToggle={() => undefined} />
        <FieldRow label="Date" checked={fields.date} onToggle={(date) => set({ date, dateYearOnly: date && fields.dateYearOnly })}>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={fields.dateYearOnly} onChange={(event) => set({ dateYearOnly: event.target.checked })} />
            Change Year Only
          </label>
        </FieldRow>
        <FieldRow label="Ref No." checked={fields.refNo} onToggle={(refNo) => set({ refNo, refSequential: refNo && fields.refSequential })}>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={fields.refSequential} onChange={(event) => set({ refSequential: event.target.checked })} />
            Change Sequentially
          </label>
        </FieldRow>
        <FieldRow label="Payee" checked={fields.payee} onToggle={(payee) => set({ payee })} />
        <FieldRow label="Account" checked={fields.account} onToggle={(account) => set({ account })} />
        <FieldRow label="Memo" checked={fields.memo} onToggle={(memo) => set({ memo, memoMode: memo ? fields.memoMode : "replace" })}>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={fields.memoMode === "append"} onChange={(event) => setMemoMode("append", event.target.checked)} />
            Append To Current Memo
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={fields.memoMode === "prepend"} onChange={(event) => setMemoMode("prepend", event.target.checked)} />
            Prepend To Current Memo
          </label>
        </FieldRow>
        <FieldRow label="Class" checked={false} disabled hint="not available yet" onToggle={() => undefined} />
        <FieldRow label="Location" checked={false} disabled hint="not available yet" onToggle={() => undefined} />
        <FieldRow label="Reconcile Status" checked={fields.reconcileStatus} onToggle={(reconcileStatus) => set({ reconcileStatus })} />
      </ul>
      <div className="mt-5 flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onContinue} disabled={!hasBatchFieldSelected(fields)}>
          Continue
        </Button>
      </div>
    </Modal>
  );
}
