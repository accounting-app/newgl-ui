"use client";

import { Trash2 } from "lucide-react";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import type { ReviewRow, SignConvention } from "@/modules/accounting/domain/csv-import";

type CsvReviewTableProps = {
  rows: ReviewRow[];
  accountOptions: SelectFieldOption[];
  mainAccountId: string;
  selectedRowIds: Set<string>;
  onSelectedRowIdsChange: (next: Set<string>) => void;
  signConvention: SignConvention;
  onSignConventionChange: (next: SignConvention) => void;
  onRowChange: (clientRowId: string, patch: Partial<ReviewRow>) => void;
  onRowDelete: (clientRowId: string) => void;
  onBack: () => void;
  onContinue: () => void;
  isSubmitting: boolean;
  submitError?: string | null;
  backDisabled?: boolean;
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
  if (!row.categoryAccountId) return "Select a target account.";
  if (row.categoryAccountId === mainAccountId) return "Target account must differ from the main account.";
  return null;
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export function CsvReviewTable({
  rows,
  accountOptions,
  mainAccountId,
  selectedRowIds,
  onSelectedRowIdsChange,
  signConvention,
  onSignConventionChange,
  onRowChange,
  onRowDelete,
  onBack,
  onContinue,
  isSubmitting,
  submitError,
  backDisabled
}: CsvReviewTableProps) {
  const selectedRows = rows.filter((row) => selectedRowIds.has(row.clientRowId));
  const selectedSubmittableCount = selectedRows.filter((row) => isRowSubmittable(row, mainAccountId)).length;
  const allSelectedAreReady = selectedRows.length > 0 && selectedSubmittableCount === selectedRows.length;
  const allChecked = rows.length > 0 && selectedRowIds.size === rows.length;

  function toggleRow(clientRowId: string, checked: boolean) {
    const next = new Set(selectedRowIds);
    if (checked) next.add(clientRowId);
    else next.delete(clientRowId);
    onSelectedRowIdsChange(next);
  }

  function toggleAll(checked: boolean) {
    onSelectedRowIdsChange(checked ? new Set(rows.map((row) => row.clientRowId)) : new Set());
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h2 className="text-xl font-medium text-[var(--color-text-primary)]">
        Let&apos;s verify and import your transactions
      </h2>

      <div className="rounded border border-[var(--color-divider-tertiary)] p-4">
        <p className="mb-3 text-sm text-[var(--color-text-primary)]">
          <strong>Check:</strong> Generally, income transactions post as <strong>positive</strong> numbers and
          expense transactions post as <strong>negative</strong> ones. Occasionally, some banks send files with
          this reversed. Do the transactions below correctly indicate income and expenses?
        </p>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <input
              type="radio"
              name="sign-convention"
              checked={signConvention === "ORIGINAL"}
              onChange={() => onSignConventionChange("ORIGINAL")}
            />
            Keep original values
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
            <input
              type="radio"
              name="sign-convention"
              checked={signConvention === "REVERSED"}
              onChange={() => onSignConventionChange("REVERSED")}
            />
            Reverse all values
          </label>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-primary)]">
        <strong>Select:</strong> Choose the transactions you want to import, and assign a target account to
        each.
      </p>

      <div className="flex-1 overflow-auto rounded border border-[var(--color-divider-tertiary)]">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-10" />
            <col className="w-[12%]" />
            <col className="w-[24%]" />
            <col className="w-[12%]" />
            <col className="w-[26%]" />
            <col className="w-10" />
          </colgroup>
          <thead className="sticky top-0 bg-[var(--color-container-background-accent)]">
            <tr className="border-b border-[var(--color-divider-tertiary)]">
              <th className="px-3 py-2">
                <input type="checkbox" checked={allChecked} onChange={(event) => toggleAll(event.target.checked)} />
              </th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Date</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Description</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--color-text-primary)]">Amount</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Target account</th>
              <th className="px-3 py-2"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const error = rowErrorMessage(row, mainAccountId);
              const isChecked = selectedRowIds.has(row.clientRowId);
              return (
                <tr
                  key={row.clientRowId}
                  className={`border-b border-[var(--color-container-background-secondary)] ${
                    error ? "bg-[var(--color-container-background-accent)]" : ""
                  }`}
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(event) => toggleRow(row.clientRowId, event.target.checked)}
                    />
                  </td>
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
                          parseErrors: row.parseErrors.filter((message) => !message.toLowerCase().includes("amount"))
                        });
                      }}
                      className="w-full text-right"
                    />
                    {row.amount !== null ? (
                      <p className="mt-0.5 text-right text-[11px] text-[var(--color-icon-secondary)]">
                        {formatMoney(row.amount)}
                      </p>
                    ) : null}
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

      <div className="flex items-center justify-between">
        {submitError ? <p className="mr-auto text-sm text-red-600">{submitError}</p> : null}
        <Button variant="secondary" onClick={onBack} disabled={isSubmitting || backDisabled}>
          Back
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={isSubmitting || !allSelectedAreReady}>
          Continue
        </Button>
      </div>
    </div>
  );
}
