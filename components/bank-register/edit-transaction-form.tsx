import { ReconcileStatusCell } from "@/components/bank-register/reconcile-status";
import { RegisterTableColumnGroup } from "@/components/bank-register/register-table-column-group";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { isEntryLocked } from "@/modules/accounting/domain/accounting-reports";
import type { RegisterEntry } from "@/modules/accounting/domain/models";
import type { InlineEntryEditorInput } from "@/modules/accounting/presentation/hooks/use-bank-register";

type EditTransactionFormProps = {
  entry: RegisterEntry;
  editor: InlineEntryEditorInput;
  payeeOptions: SelectFieldOption[];
  accountOptions: SelectFieldOption[];
  rowError: string | null;
  isSavingRow: boolean;
  isDeletingRow: boolean;
  isPaymentDisabled: boolean;
  isDepositDisabled: boolean;
  onEditorChange: (field: keyof InlineEntryEditorInput, value: string) => void;
  onReconcileCycle: () => void;
  onOpenPayeeModal: () => void;
  onDelete: () => void;
  onCancel: () => void;
  onSave: () => void;
};

export function EditTransactionForm({
  entry,
  editor,
  payeeOptions,
  accountOptions,
  rowError,
  isSavingRow,
  isDeletingRow,
  isPaymentDisabled,
  isDepositDisabled,
  onEditorChange,
  onReconcileCycle,
  onOpenPayeeModal,
  onDelete,
  onCancel,
  onSave
}: EditTransactionFormProps) {
  const locked = isEntryLocked(entry.reconcileStatus ?? "");
  const lockedLabel = entry.reconcileStatus === "R" ? "reconciled" : "cleared";
  return (
    <div className="form-transaction-row">
      <div className="form-transaction-row-top">
        <table className="w-full min-w-[1025px] table-fixed border-collapse text-sm">
          <RegisterTableColumnGroup />
          <tbody>
            <tr className="align-top">
              <td className="form-control">
                <InputField
                  type="date"
                  value={editor.date}
                  onChange={(event) => onEditorChange("date", event.target.value)}
                  className="w-full placeholder:text-gray-400"
                />
              </td>
              <td className="form-control">
                <InputField
                  type="text"
                  value={editor.refNo}
                  onChange={(event) => onEditorChange("refNo", event.target.value)}
                  className="w-full placeholder:text-gray-400"
                />
                <InputField type="text" value={entry.transactionType} disabled className="mt-1 w-full" />
              </td>
              <td className="form-control">
                <SelectField
                  value={editor.payee}
                  options={payeeOptions}
                  placeholder="Payee"
                  onChange={(value) => onEditorChange("payee", value)}
                  onAddNew={onOpenPayeeModal}
                />
                <SelectField
                  value={editor.accountTypeId}
                  options={accountOptions}
                  placeholder="Account"
                  onChange={(value) => onEditorChange("accountTypeId", value)}
                  allowCustomValue={false}
                  disabled={locked}
                />
              </td>
              <td className="form-control">
                <InputField
                  type="text"
                  value={editor.memo}
                  onChange={(event) => onEditorChange("memo", event.target.value)}
                  placeholder="Memo"
                  className="w-full placeholder:text-gray-400"
                />
              </td>
              <td className="form-control">
                <InputField
                  type="number"
                  min="0"
                  step="0.01"
                  value={editor.payment}
                  disabled={isPaymentDisabled}
                  onChange={(event) => onEditorChange("payment", event.target.value)}
                  placeholder="0.00"
                  className="w-full text-right placeholder:text-gray-400"
                />
              </td>
              <td className="form-control">
                <InputField
                  type="number"
                  min="0"
                  step="0.01"
                  value={editor.deposit}
                  disabled={isDepositDisabled}
                  onChange={(event) => onEditorChange("deposit", event.target.value)}
                  placeholder="0.00"
                  className="w-full text-right placeholder:text-gray-400"
                />
              </td>
              <ReconcileStatusCell status={editor.reconcileStatus} onCycle={onReconcileCycle} />
              <td className="form-control">
                <div className="rounded border border-gray-200 bg-gray-100 px-2 py-1 text-right text-xs text-gray-500">-</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="form-transaction-row-bottom flex items-center justify-end gap-2">
        {locked ? (
          <p className="mb-1 mr-auto text-xs text-amber-600">
            This transaction is {lockedLabel} and is locked. Clear the reconcile mark on the row to
            edit it, or create a reversal.
          </p>
        ) : null}
        {rowError ? <p className="mb-1 text-xs text-red-600">{rowError}</p> : null}
        <Button
          variant="secondary"
          disabled={isDeletingRow || isSavingRow || locked}
          onClick={onDelete}
        >
          Delete
        </Button>
        <Button variant="secondary" disabled={isDeletingRow || isSavingRow} onClick={() => undefined}>
          Edit
        </Button>
        <Button variant="secondary" disabled={isDeletingRow || isSavingRow} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={isDeletingRow || isSavingRow || locked}
          onClick={onSave}
        >
          {isSavingRow ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
