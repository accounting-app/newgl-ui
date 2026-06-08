import { ReconcileStatusCell } from "@/components/bank-register/reconcile-status";
import { RegisterTableColumnGroup } from "@/components/bank-register/register-table-column-group";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import type {
  DraftTransactionErrors,
  DraftTransactionForm
} from "@/modules/accounting/presentation/hooks/use-bank-register";

type AddTransactionFormProps = {
  draftTransaction: DraftTransactionForm;
  draftErrors: DraftTransactionErrors;
  payeeOptions: SelectFieldOption[];
  accountOptions: SelectFieldOption[];
  isDraftAccountFieldDisabled: boolean;
  isDraftInflowType: boolean;
  isDraftOutflowType: boolean;
  isSavingDraft: boolean;
  onDraftFieldChange: (
    field: keyof Omit<DraftTransactionForm, "transactionTypeId" | "transactionTypeLabel">,
    value: string
  ) => void;
  onDraftSave: () => void;
  onDraftCancel: () => void;
  onReconcileCycle: () => void;
  onOpenPayeeModal: () => void;
};

export function AddTransactionForm({
  draftTransaction,
  draftErrors,
  payeeOptions,
  accountOptions,
  isDraftAccountFieldDisabled,
  isDraftInflowType,
  isDraftOutflowType,
  isSavingDraft,
  onDraftFieldChange,
  onDraftSave,
  onDraftCancel,
  onReconcileCycle,
  onOpenPayeeModal
}: AddTransactionFormProps) {
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
                  value={draftTransaction.date}
                  onChange={(event) => onDraftFieldChange("date", event.target.value)}
                  className="w-full placeholder:text-gray-400"
                />
                {draftErrors.date ? <p className="mt-1 text-xs text-red-600">{draftErrors.date}</p> : null}
              </td>
              <td className="form-control">
                <InputField
                  type="text"
                  value={draftTransaction.refNo}
                  onChange={(event) => onDraftFieldChange("refNo", event.target.value)}
                  placeholder="Ref No"
                  className="w-full placeholder:text-gray-400"
                />
                <InputField type="text" value={draftTransaction.transactionTypeLabel} disabled className="mt-1 w-full" />
              </td>
              <td className="form-control">
                <SelectField
                  value={draftTransaction.payee}
                  options={payeeOptions}
                  placeholder="Payee"
                  onChange={(value) => onDraftFieldChange("payee", value)}
                  onAddNew={onOpenPayeeModal}
                />
                <SelectField
                  value={draftTransaction.accountTypeId}
                  options={accountOptions}
                  placeholder="Account"
                  onChange={(value) => onDraftFieldChange("accountTypeId", value)}
                  disabled={isDraftAccountFieldDisabled}
                  allowCustomValue={false}
                />
                {draftErrors.payee ? <p className="mt-1 text-xs text-red-600">{draftErrors.payee}</p> : null}
                {draftErrors.accountTypeId ? <p className="mt-1 text-xs text-red-600">{draftErrors.accountTypeId}</p> : null}
              </td>
              <td className="form-control">
                <InputField
                  type="text"
                  value={draftTransaction.memo}
                  onChange={(event) => onDraftFieldChange("memo", event.target.value)}
                  placeholder="Memo"
                  className="w-full placeholder:text-gray-400"
                />
              </td>
              <td className="form-control">
                <InputField
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftTransaction.payment}
                  disabled={isDraftInflowType}
                  onChange={(event) => onDraftFieldChange("payment", event.target.value)}
                  placeholder="0.00"
                  className="w-full text-right placeholder:text-gray-400"
                />
                {draftErrors.payment ? <p className="mt-1 text-xs text-red-600">{draftErrors.payment}</p> : null}
              </td>
              <td className="form-control">
                <InputField
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftTransaction.deposit}
                  disabled={isDraftOutflowType}
                  onChange={(event) => onDraftFieldChange("deposit", event.target.value)}
                  placeholder="0.00"
                  className="w-full text-right placeholder:text-gray-400"
                />
                {draftErrors.deposit ? <p className="mt-1 text-xs text-red-600">{draftErrors.deposit}</p> : null}
              </td>
              <ReconcileStatusCell status={draftTransaction.reconcileStatus} onCycle={onReconcileCycle} />
              <td className="form-control">
                <div className="rounded border border-gray-200 bg-gray-100 px-2 py-1 text-right text-xs text-gray-500">-</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="form-transaction-row-bottom flex justify-end gap-2">
        <Button variant="secondary" onClick={onDraftCancel} disabled={isSavingDraft}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onDraftSave} disabled={isSavingDraft}>
          {isSavingDraft ? "Saving..." : "Save"}
        </Button>
      </div>
      {draftErrors.amount ? <p className="mb-1 text-xs text-red-600">{draftErrors.amount}</p> : null}
      {draftErrors.form ? <p className="mb-1 text-xs text-red-600">{draftErrors.form}</p> : null}
    </div>
  );
}
