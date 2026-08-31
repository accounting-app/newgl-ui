import { ReconcileStatusCell } from "@/components/bank-register/reconcile-status";
import { RegisterTableColumnGroup } from "@/components/bank-register/register-table-column-group";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import type {
  DraftSplitLine,
  DraftTransactionErrors,
  DraftTransactionForm
} from "@hooks/use-bank-register";

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
  isSplitMode: boolean;
  draftSplits: DraftSplitLine[];
  onToggleSplitMode: () => void;
  onAddSplitLine: () => void;
  onRemoveSplitLine: (clientId: string) => void;
  onUpdateSplitLine: (clientId: string, patch: Partial<Omit<DraftSplitLine, "clientId">>) => void;
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
  onOpenPayeeModal,
  isSplitMode,
  draftSplits,
  onToggleSplitMode,
  onAddSplitLine,
  onRemoveSplitLine,
  onUpdateSplitLine
}: AddTransactionFormProps) {
  const splitTotal = draftSplits.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const targetAmount = Number(draftTransaction.payment || 0) + Number(draftTransaction.deposit || 0);
  const splitDifference = Math.round((targetAmount - splitTotal) * 100) / 100;
  const canSplit = !isDraftAccountFieldDisabled;
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
                  className="w-full placeholder:text-[var(--color-text-disabled)]"
                />
                {draftErrors.date ? <p className="mt-1 text-xs text-[var(--color-negative)]">{draftErrors.date}</p> : null}
              </td>
              <td className="form-control">
                <InputField
                  type="text"
                  value={draftTransaction.refNo}
                  onChange={(event) => onDraftFieldChange("refNo", event.target.value)}
                  placeholder="Ref No"
                  className="w-full placeholder:text-[var(--color-text-disabled)]"
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
                {isSplitMode ? (
                  <div className="mt-1 rounded border border-[var(--color-divider-tertiary)] px-2 py-1.5 text-xs text-[var(--color-text-primary)]">
                    Split across {draftSplits.length} accounts
                  </div>
                ) : (
                  <SelectField
                    value={draftTransaction.accountTypeId}
                    options={accountOptions}
                    placeholder="Account"
                    onChange={(value) => onDraftFieldChange("accountTypeId", value)}
                    disabled={isDraftAccountFieldDisabled}
                    allowCustomValue={false}
                  />
                )}
                {canSplit ? (
                  <button
                    type="button"
                    className="mt-1 text-[11px] text-[var(--color-link-text)] hover:underline"
                    onClick={onToggleSplitMode}
                  >
                    {isSplitMode ? "Use a single account instead" : "Split into multiple accounts"}
                  </button>
                ) : null}
                {draftErrors.payee ? <p className="mt-1 text-xs text-[var(--color-negative)]">{draftErrors.payee}</p> : null}
                {draftErrors.accountTypeId ? <p className="mt-1 text-xs text-[var(--color-negative)]">{draftErrors.accountTypeId}</p> : null}
              </td>
              <td className="form-control">
                <InputField
                  type="text"
                  value={draftTransaction.memo}
                  onChange={(event) => onDraftFieldChange("memo", event.target.value)}
                  placeholder="Memo"
                  className="w-full placeholder:text-[var(--color-text-disabled)]"
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
                  className="w-full text-right placeholder:text-[var(--color-text-disabled)]"
                />
                {draftErrors.payment ? <p className="mt-1 text-xs text-[var(--color-negative)]">{draftErrors.payment}</p> : null}
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
                  className="w-full text-right placeholder:text-[var(--color-text-disabled)]"
                />
                {draftErrors.deposit ? <p className="mt-1 text-xs text-[var(--color-negative)]">{draftErrors.deposit}</p> : null}
              </td>
              <ReconcileStatusCell status={draftTransaction.reconcileStatus} onCycle={onReconcileCycle} />
              <td className="form-control">
                <div className="rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-secondary)] px-2 py-1 text-right text-xs text-[var(--color-icon-secondary)]">-</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {isSplitMode ? (
        <div className="mx-3 mb-3 rounded border border-[var(--color-divider-tertiary)] p-3">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs text-[var(--color-icon-secondary)]">
                <th className="pb-1 pr-3 font-medium">Account</th>
                <th className="pb-1 pr-3 text-right font-medium">Amount</th>
                <th className="pb-1"> </th>
              </tr>
            </thead>
            <tbody>
              {draftSplits.map((line) => (
                <tr key={line.clientId}>
                  <td className="py-1 pr-3">
                    <SelectField
                      value={line.accountId}
                      options={accountOptions}
                      placeholder="Select account"
                      onChange={(value) => onUpdateSplitLine(line.clientId, { accountId: value })}
                      allowCustomValue={false}
                      optionSize="sm"
                    />
                  </td>
                  <td className="py-1 pr-3">
                    <InputField
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.amount}
                      onChange={(event) => onUpdateSplitLine(line.clientId, { amount: event.target.value })}
                      className="w-28 text-right"
                    />
                  </td>
                  <td className="py-1 text-center">
                    <button
                      type="button"
                      aria-label="Remove split line"
                      className="text-[var(--color-icon-secondary)] hover:text-[var(--color-negative)] disabled:opacity-30"
                      onClick={() => onRemoveSplitLine(line.clientId)}
                      disabled={draftSplits.length <= 2}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={onAddSplitLine}>
              Add split line
            </Button>
            <p
              className={`text-xs ${splitDifference === 0 && targetAmount > 0 ? "text-emerald-700" : "text-[var(--color-icon-secondary)]"}`}
            >
              {targetAmount <= 0
                ? "Enter a payment or deposit amount above."
                : splitDifference === 0
                  ? `Splits total ${splitTotal.toFixed(2)} — matches the transaction amount.`
                  : `Splits total ${splitTotal.toFixed(2)}, ${splitDifference > 0 ? "short" : "over"} by ${Math.abs(splitDifference).toFixed(2)}.`}
            </p>
          </div>
        </div>
      ) : null}

      <div className="form-transaction-row-bottom flex justify-end gap-2">
        <Button variant="secondary" onClick={onDraftCancel} disabled={isSavingDraft}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onDraftSave} disabled={isSavingDraft}>
          {isSavingDraft ? "Saving..." : "Save"}
        </Button>
      </div>
      {draftErrors.amount ? <p className="mb-1 text-xs text-[var(--color-negative)]">{draftErrors.amount}</p> : null}
      {draftErrors.form ? <p className="mb-1 text-xs text-[var(--color-negative)]">{draftErrors.form}</p> : null}
    </div>
  );
}
