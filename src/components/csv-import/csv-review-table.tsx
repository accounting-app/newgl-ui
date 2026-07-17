"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import type { ReviewRow } from "@/modules/accounting/domain/csv-import";

type CsvReviewTableProps = {
  rows: ReviewRow[];
  accountOptions: SelectFieldOption[];
  mainAccountId: string;
  onMainAccountChange: (accountId: string) => void;
  onRowChange: (clientRowId: string, patch: Partial<ReviewRow>) => void;
  onRowDelete: (clientRowId: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  submitError?: string | null;
};

export function isRowSubmittable(row: ReviewRow, mainAccountId: string): boolean {
  return (
    row.transactionDate !== null &&
    row.amount !== null &&
    row.categoryAccountId !== null &&
    row.categoryAccountId !== mainAccountId
  );
}

function rowErrorMessage(row: ReviewRow, mainAccountId: string): string | null {
  if (row.parseErrors.length > 0) return row.parseErrors.join(" ");
  if (!row.categoryAccountId) return "Select a category account.";
  if (row.categoryAccountId === mainAccountId) return "Category must differ from the main account.";
  return null;
}

export function CsvReviewTable({
  rows,
  accountOptions,
  mainAccountId,
  onMainAccountChange,
  onRowChange,
  onRowDelete,
  onSubmit,
  onCancel,
  isSubmitting,
  submitError
}: CsvReviewTableProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    setIsConfirming(false);
  }, [rows, mainAccountId]);

  const parsedCount = rows.filter((row) => row.parseErrors.length === 0).length;
  const parseFailedCount = rows.length - parsedCount;
  const submittableCount = rows.filter((row) => isRowSubmittable(row, mainAccountId)).length;
  const allRowsReady = rows.length > 0 && submittableCount === rows.length;

  function handleImportClick() {
    if (!allRowsReady) return;
    if (!isConfirming) {
      setIsConfirming(true);
      return;
    }
    onSubmit();
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <h2 className="text-xl font-medium text-[var(--color-text-primary)]">Review transactions</h2>
        <p className="mt-1 text-sm text-[var(--color-icon-secondary)]">
          {parsedCount} parsed successfully
          {parseFailedCount > 0 ? ` / ${parseFailedCount} need attention` : ""}. Assign a category to each
          row before importing.
        </p>
      </div>

      <div className="max-w-xs">
        <p className="mb-1 text-xs text-[var(--color-icon-secondary)]">Main account</p>
        <SelectField
          value={mainAccountId}
          onChange={onMainAccountChange}
          options={accountOptions}
          placeholder="Select account"
          allowCustomValue={false}
        />
      </div>

      <div className="flex-1 overflow-auto rounded border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="sticky top-0 bg-[var(--color-container-background-accent)]">
            <tr className="border-b border-[var(--color-divider-tertiary)]">
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Date</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Payee</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Description</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--color-text-primary)]">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Category</th>
              <th className="px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const error = rowErrorMessage(row, mainAccountId);
              return (
                <tr
                  key={row.clientRowId}
                  className={`border-b border-[var(--color-container-background-secondary)] ${
                    error ? "bg-[var(--color-container-background-accent)]" : ""
                  }`}
                >
                  <td className="p-2 align-top">
                    <InputField
                      type="date"
                      value={row.transactionDate ?? ""}
                      onChange={(event) =>
                        onRowChange(row.clientRowId, {
                          transactionDate: event.target.value || null,
                          rawDate: event.target.value,
                          parseErrors: row.parseErrors.filter((message) => !message.startsWith("Date"))
                        })
                      }
                      className="w-full"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <InputField
                      type="text"
                      value={row.payee}
                      onChange={(event) => onRowChange(row.clientRowId, { payee: event.target.value })}
                      className="w-full"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <InputField
                      type="text"
                      value={row.memo}
                      onChange={(event) => onRowChange(row.clientRowId, { memo: event.target.value })}
                      className="w-full"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <InputField
                      type="number"
                      step="0.01"
                      value={row.amount ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        const parsed = value === "" ? null : Number(value);
                        onRowChange(row.clientRowId, {
                          amount: Number.isFinite(parsed) ? parsed : null,
                          rawAmount: value,
                          parseErrors: row.parseErrors.filter((message) => !message.startsWith("Amount"))
                        });
                      }}
                      className="w-full text-right"
                    />
                  </td>
                  <td className="p-2 align-top">
                    <SelectField
                      value={row.categoryAccountId ?? ""}
                      onChange={(value) => onRowChange(row.clientRowId, { categoryAccountId: value || null })}
                      options={accountOptions}
                      placeholder="Select"
                      allowCustomValue={false}
                      optionSize="sm"
                    />
                  </td>
                  <td className="p-2 align-top text-center">
                    <button
                      type="button"
                      aria-label="Delete row"
                      className="text-[var(--color-icon-secondary)] hover:text-red-600"
                      onClick={() => onRowDelete(row.clientRowId)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        {submitError ? <p className="mr-auto text-sm text-red-600">{submitError}</p> : null}
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleImportClick}
          disabled={isSubmitting || !allRowsReady}
        >
          {isSubmitting
            ? "Importing..."
            : isConfirming
              ? "Are you sure you want to import?"
              : `Import ${submittableCount} transaction${submittableCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
