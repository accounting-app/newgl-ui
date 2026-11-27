import { DateField } from "@/components/ui/date-field";
import { ReconcileStatusCell } from "@/components/bank-register/reconcile-status";
import { RegisterTableColumnGroup } from "@/components/bank-register/register-table-column-group";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { isEntryLocked } from "@/modules/accounting/domain/accounting-reports";
import type { RegisterEntry } from "@/modules/accounting/domain/models";
import type { InlineEntryEditorInput } from "@hooks/use-bank-register";

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
  onOpenAccountModal: () => void;
  onDelete: () => void;
  /** Opens the transaction in its full form. */
  onEdit: () => void;
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
  onOpenAccountModal,
  onDelete,
  onEdit,
  onCancel,
  onSave
}: EditTransactionFormProps) {
  const locked = isEntryLocked(entry.reconcileStatus ?? "");
  const lockedLabel = entry.reconcileStatus === "R" ? "reconciled" : "cleared";
  // A sales receipt's account comes from its products and a received payment's is
  // always Accounts Receivable, so neither can be changed from the row.
  const accountLocked = locked || entry.transactionType === "SALES_RECEIPT" || entry.transactionType === "RECEIVE_PAYMENT";
  return (
    <div className="form-transaction-row">
      <div className="form-transaction-row-top">
        <table className="w-full min-w-[1025px] table-fixed border-collapse text-sm">
          <RegisterTableColumnGroup />
          <tbody>
            <tr className="align-top">
              <td className="form-control">
                <DateField value={editor.date} onChange={(date) => onEditorChange("date", date)} />
              </td>
              <td className="form-control">
                <InputField
                  type="text"
                  value={editor.refNo}
                  disabled={entry.transactionType === "DEPOSIT"}
                  placeholder="Ref No."
                  onChange={(event) => onEditorChange("refNo", event.target.value)}
                  className="w-full placeholder:text-[var(--color-text-disabled)]"
                />
                <InputField type="text" value={entry.transactionType.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")} disabled className="mt-1 w-full" />
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
                  disabled={accountLocked}
                  onAddNew={accountLocked ? undefined : onOpenAccountModal}
                />
              </td>
              <td className="form-control">
                <InputField
                  type="text"
                  value={editor.memo}
                  onChange={(event) => onEditorChange("memo", event.target.value)}
                  placeholder="Memo"
                  className="w-full placeholder:text-[var(--color-text-disabled)]"
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
                  placeholder="Payment"
                  className="w-full text-right placeholder:text-[var(--color-text-disabled)]"
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
                  placeholder="Deposit"
                  className="w-full text-right placeholder:text-[var(--color-text-disabled)]"
                />
              </td>
              <ReconcileStatusCell status={editor.reconcileStatus} onCycle={onReconcileCycle} />
              <td className="form-control">&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="form-transaction-row-bottom flex items-center justify-end gap-2">
        {locked ? (
          <p className="mb-1 mr-auto text-xs text-amber-600">
            This transaction is {lockedLabel} and is locked: only the ✓ mark can be changed here. Set it to
            blank and save to edit the rest, or create a reversal.
          </p>
        ) : null}
        {rowError ? <p className="mb-1 text-xs text-[var(--color-negative)]">{rowError}</p> : null}
        <Button
          variant="secondary"
          disabled={isDeletingRow || isSavingRow || locked}
          onClick={onDelete}
        >
          Delete
        </Button>
        <Button variant="secondary" disabled={isDeletingRow || isSavingRow} onClick={onEdit}>
          Edit
        </Button>
        <Button variant="secondary" disabled={isDeletingRow || isSavingRow} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          disabled={isDeletingRow || isSavingRow || (locked && editor.reconcileStatus === (entry.reconcileStatus ?? ""))}
          onClick={onSave}
        >
          {isSavingRow ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
