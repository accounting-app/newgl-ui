"use client";

import { RegisterTableColumnGroup } from "@/components/bank-register/register-table-column-group";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import type { BatchEditFields, BatchEditValues } from "@/lib/accounting/register-batch";

type BatchEditRowProps = {
  fields: BatchEditFields;
  values: BatchEditValues;
  selectedCount: number;
  payeeOptions: SelectFieldOption[];
  accountOptions: SelectFieldOption[];
  error: string | null;
  isApplying: boolean;
  onChange: (patch: Partial<BatchEditValues>) => void;
  onChooseFields: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

// The pink row that takes the place of the "new transaction" form while a
// batch edit is in progress. Same column grid as every register row; only
// the fields chosen in the field chooser are live, the rest are disabled so
// it's obvious what the batch will and won't touch.
export function BatchEditRow({
  fields,
  values,
  selectedCount,
  payeeOptions,
  accountOptions,
  error,
  isApplying,
  onChange,
  onChooseFields,
  onConfirm,
  onCancel
}: BatchEditRowProps) {
  const dateHint = fields.dateYearOnly ? "Year used for every row" : undefined;
  const refHint = fields.refSequential ? "First number; counts up oldest to newest" : undefined;
  return (
    <div
      className="border-b border-[var(--color-negative)] bg-[color-mix(in_srgb,var(--color-negative)_12%,var(--color-container-background-primary))]"
      data-testid="batch-edit-row"
    >
      <div className="border-t-[3px] border-[var(--color-negative)] px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-negative)]">
        Batch edit -- {selectedCount} transaction{selectedCount === 1 ? "" : "s"} selected
      </div>
      <table className="w-full min-w-[1025px] table-fixed border-collapse text-sm">
        <RegisterTableColumnGroup />
        <tbody>
          <tr className="align-top">
            <td className="form-control">
              <InputField
                type="date"
                value={values.date}
                disabled={!fields.date}
                onChange={(event) => onChange({ date: event.target.value })}
                aria-label="New date"
                title={dateHint}
                className="w-full"
              />
            </td>
            <td className="form-control">
              <InputField
                type="text"
                value={values.refNo}
                disabled={!fields.refNo}
                onChange={(event) => onChange({ refNo: event.target.value })}
                placeholder={fields.refSequential ? "e.g. 1001" : "Ref No"}
                aria-label="New ref no."
                title={refHint}
                className="w-full"
              />
            </td>
            <td className="form-control">
              <SelectField
                value={values.payee}
                options={payeeOptions}
                placeholder="Payee"
                disabled={!fields.payee}
                onChange={(value) => onChange({ payee: value })}
              />
              <div className="mt-1">
                <SelectField
                  value={values.accountId}
                  options={accountOptions}
                  placeholder="Account"
                  disabled={!fields.account}
                  allowCustomValue={false}
                  onChange={(value) => onChange({ accountId: value })}
                />
              </div>
            </td>
            <td className="form-control">
              <InputField
                type="text"
                value={values.memo}
                disabled={!fields.memo}
                onChange={(event) => onChange({ memo: event.target.value })}
                placeholder={fields.memoMode === "replace" ? "Memo" : fields.memoMode === "append" ? "Text to append" : "Text to prepend"}
                aria-label="New memo"
                className="w-full"
              />
            </td>
            <td className="form-control">
              <InputField type="text" disabled value="" placeholder="--" aria-label="Payment (not editable in a batch)" className="w-full text-right" />
            </td>
            <td className="form-control">
              <InputField type="text" disabled value="" placeholder="--" aria-label="Deposit (not editable in a batch)" className="w-full text-right" />
            </td>
            <td className="form-control text-center">
              <button
                type="button"
                disabled={!fields.reconcileStatus}
                onClick={() => onChange({ reconcileStatus: values.reconcileStatus === "C" ? "" : "C" })}
                aria-label="Toggle cleared"
                className="h-9 w-full rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] font-semibold disabled:cursor-not-allowed disabled:bg-[var(--color-input-disabled-background)]"
              >
                {values.reconcileStatus || " "}
              </button>
            </td>
            <td className="form-control">&nbsp;</td>
          </tr>
        </tbody>
      </table>
      <div className="flex items-center justify-between gap-3 px-3 pb-3 pt-1">
        <p className="text-xs text-[var(--color-negative)]" role={error ? "alert" : undefined}>
          {error ?? ""}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onChooseFields} disabled={isApplying}>
            Fields
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={isApplying}>
            {isApplying ? "Applying..." : "Confirm Batch"}
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={isApplying}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
