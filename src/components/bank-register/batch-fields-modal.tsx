"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { BatchEditFields, BatchMemoMode } from "@/lib/accounting/register-batch";

type BatchFieldsModalProps = {
  open: boolean;
  selectedCount: number;
  fields: BatchEditFields;
  onChange: (fields: BatchEditFields) => void;
  onClose: () => void;
};

type FieldRowProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onToggle: (checked: boolean) => void;
  /** Sub-options, shown beside the field as in RightTool. */
  children?: React.ReactNode;
};

function FieldRow({ label, checked, disabled, hint, onToggle, children }: FieldRowProps) {
  return (
    <li className="flex min-h-[48px] flex-wrap items-center gap-x-6 gap-y-1 py-1.5">
      <label className={`flex min-w-[140px] items-center gap-3 text-base font-semibold ${disabled ? "cursor-not-allowed text-[var(--color-text-disabled)]" : "cursor-pointer text-[var(--color-text-global)]"}`}>
        <input type="checkbox" className="qbo-checkbox disabled:cursor-not-allowed disabled:opacity-50" checked={checked} disabled={disabled} onChange={(event) => onToggle(event.target.checked)} />
        <span>{label}</span>
      </label>
      {hint ? <span className="text-xs text-[var(--color-text-disabled)]">{hint}</span> : null}
      {children ? <div className="space-y-1.5 text-[13px] font-semibold text-[var(--color-text-primary)]">{children}</div> : null}
    </li>
  );
}

function SubOption({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <input type="checkbox" className="qbo-checkbox" checked={checked} onChange={(event) => onToggle(event.target.checked)} />
      {label}
    </label>
  );
}

// "Edit" in the Batch menu: pick which fields the batch will overwrite. Ticks
// apply at once -- the matching fields in the pink row behind light up -- so
// "Close" is all there is to do. The values themselves are typed in that row.
// Source Account, Class and Location are listed (they exist in RightTool) but
// disabled: the ledger has no class or location, and moving an entry to another
// register isn't supported by the API yet.
export function BatchFieldsModal({ open, selectedCount, fields, onChange, onClose }: BatchFieldsModalProps) {
  const set = (patch: Partial<BatchEditFields>) => onChange({ ...fields, ...patch });
  const setMemoMode = (mode: BatchMemoMode, on: boolean) => set({ memo: on || fields.memo, memoMode: on ? mode : "replace" });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Batch edit"
      description={`Choose the fields to change on the ${selectedCount} selected transaction${selectedCount === 1 ? "" : "s"}.`}
      size="md"
    >
      <ul>
        <FieldRow label="0. Source Account (Move To Another Register)" checked={false} disabled hint="not available yet" onToggle={() => undefined} />
        <FieldRow label="1. Date" checked={fields.date} onToggle={(date) => set({ date, dateYearOnly: date && fields.dateYearOnly })}>
          <SubOption label="Change Year Only" checked={fields.dateYearOnly} onToggle={(on) => set({ date: on || fields.date, dateYearOnly: on })} />
        </FieldRow>
        <FieldRow label="2. Ref No." checked={fields.refNo} onToggle={(refNo) => set({ refNo, refSequential: refNo && fields.refSequential })}>
          <SubOption label="Change Sequentially" checked={fields.refSequential} onToggle={(on) => set({ refNo: on || fields.refNo, refSequential: on })} />
        </FieldRow>
        <FieldRow label="3. Payee" checked={fields.payee} onToggle={(payee) => set({ payee })} />
        <FieldRow label="4. Account" checked={fields.account} onToggle={(account) => set({ account })} />
        <FieldRow label="5. Memo" checked={fields.memo} onToggle={(memo) => set({ memo, memoMode: memo ? fields.memoMode : "replace" })}>
          <SubOption label="Append To Current Memo" checked={fields.memoMode === "append"} onToggle={(on) => setMemoMode("append", on)} />
          <SubOption label="Prepend To Current Memo" checked={fields.memoMode === "prepend"} onToggle={(on) => setMemoMode("prepend", on)} />
        </FieldRow>
        <FieldRow label="6. Class" checked={false} disabled hint="not available yet" onToggle={() => undefined} />
        <FieldRow label="7. Location" checked={false} disabled hint="not available yet" onToggle={() => undefined} />
        <FieldRow label="8. Reconcile Status" checked={fields.reconcileStatus} onToggle={(reconcileStatus) => set({ reconcileStatus })} />
      </ul>
      <Button variant="secondary" onClick={onClose} className="mt-4 w-full">
        Close
      </Button>
    </Modal>
  );
}
