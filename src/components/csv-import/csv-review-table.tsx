"use client";

import Link from "next/link";
import { Sparkles, Trash2 } from "lucide-react";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { RadioGroup } from "@/components/ui/radio-group";
import type { CategorySplitLine, ReviewRow, SignConvention } from "@/modules/accounting/domain/csv-import";
import type { BankRule, ExcludedFeedRow, Transaction } from "@/modules/accounting/domain/models";

let splitLineIdCounter = 0;
function newSplitLine(accountId = "", amount = ""): CategorySplitLine {
  splitLineIdCounter += 1;
  return { clientSplitId: `split-${splitLineIdCounter}`, accountId, amount };
}

/** Sum of a row's split-line amounts, tolerant of blank/invalid entries (treated as 0). */
function splitTotal(splits: CategorySplitLine[]): number {
  return splits.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

function isSplitBalanced(row: ReviewRow): boolean {
  if (!row.categorySplits || row.amount === null) return false;
  return Math.abs(splitTotal(row.categorySplits) - Math.abs(row.amount)) < 0.005;
}

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
  onSuggestCategories: () => void;
  isSuggestingCategories: boolean;
  suggestCategoriesError: string | null;
  aiEnabled: boolean;
  /** Deterministic bank-rule match per row (PLAINGL_FEATURES_TO_IMPLEMENT.md #7), keyed by clientRowId. AI/learned-rule suggestions win by default -- this is surfaced as an override, not applied automatically. */
  bankRuleMatches?: Map<string, BankRule>;
  /** Rows that look like a re-import of an existing POSTED transaction (date+payee+amount), keyed by clientRowId (PLAINGL_FEATURES_TO_IMPLEMENT.md #11). Pre-unchecked by the caller, not by this component. */
  duplicateMatches?: Map<string, Transaction>;
  /** Rows matching a user's persisted "always exclude" pattern (payee+amount), keyed by clientRowId. */
  exclusionMatches?: Map<string, ExcludedFeedRow>;
  /** Marks a row's payee+amount as permanently excluded from future imports on this account. */
  onExcludeRow?: (row: ReviewRow) => void;
};

function hasValidCategory(row: ReviewRow, mainAccountId: string): boolean {
  if (row.categorySplits) {
    return (
      row.categorySplits.length >= 2 &&
      row.categorySplits.every((line) => line.accountId && line.accountId !== mainAccountId) &&
      isSplitBalanced(row)
    );
  }
  return row.categoryAccountId !== null && row.categoryAccountId !== mainAccountId;
}

export function isRowSubmittable(row: ReviewRow, mainAccountId: string): boolean {
  return row.transactionDate !== null && row.amount !== null && hasValidCategory(row, mainAccountId);
}

function rowErrorMessage(row: ReviewRow, mainAccountId: string): string | null {
  if (row.parseErrors.length > 0) return row.parseErrors.join(" ");
  if (row.categorySplits) {
    if (row.categorySplits.some((line) => !line.accountId)) return "Select an account for every split line.";
    if (row.categorySplits.some((line) => line.accountId === mainAccountId))
      return "Target account must differ from the main account.";
    if (!isSplitBalanced(row)) {
      const remaining = row.amount === null ? 0 : Math.abs(row.amount) - splitTotal(row.categorySplits);
      return `Splits must add up to the row amount (${remaining > 0 ? "short" : "over"} by ${formatMoney(Math.abs(remaining))}).`;
    }
    return null;
  }
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
  backDisabled,
  onSuggestCategories,
  isSuggestingCategories,
  suggestCategoriesError,
  aiEnabled,
  bankRuleMatches,
  duplicateMatches,
  exclusionMatches,
  onExcludeRow
}: CsvReviewTableProps) {
  const accountLabelById = new Map(accountOptions.map((option) => [option.value, option.label]));
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
        <RadioGroup
          name="sign-convention"
          value={signConvention}
          onChange={(value) => onSignConventionChange(value as SignConvention)}
          options={[
            { value: "ORIGINAL", label: "Keep original values" },
            { value: "REVERSED", label: "Reverse all values" }
          ]}
        />
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-[var(--color-text-primary)]">
          <strong>Select:</strong> Choose the transactions you want to import, and assign a target account to
          each.
        </p>
        {aiEnabled ? (
          <Button variant="secondary" onClick={onSuggestCategories} disabled={isSuggestingCategories}>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {isSuggestingCategories ? "Suggesting…" : "Suggest categories with AI"}
            </span>
          </Button>
        ) : null}
      </div>
      {suggestCategoriesError ? <p className="text-sm text-red-600">{suggestCategoriesError}</p> : null}

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
                <Checkbox checked={allChecked} onChange={(event) => toggleAll(event.target.checked)} />
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
                    <Checkbox checked={isChecked} onChange={(event) => toggleRow(row.clientRowId, event.target.checked)} />
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
                    {exclusionMatches?.has(row.clientRowId) ? (
                      <p className="mt-0.5 text-[11px] text-[var(--color-icon-secondary)]">Previously excluded</p>
                    ) : duplicateMatches?.has(row.clientRowId) ? (
                      <p className="mt-0.5 text-[11px] text-[var(--color-icon-secondary)]">
                        Looks like a duplicate ·{" "}
                        <Link
                          href={`/register?account=${mainAccountId}&tx=${duplicateMatches.get(row.clientRowId)?.id}`}
                          target="_blank"
                          className="text-[var(--color-link-text)] hover:underline"
                        >
                          View transaction
                        </Link>
                      </p>
                    ) : null}
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
                    {row.categorySplits ? (
                      <div className="flex flex-col gap-1.5">
                        {row.categorySplits.map((line) => (
                          <div key={line.clientSplitId} className="flex items-center gap-1">
                            <div className="min-w-0 flex-1">
                              <SelectField
                                value={line.accountId}
                                onChange={(value) =>
                                  onRowChange(row.clientRowId, {
                                    categorySplits: row.categorySplits!.map((l) =>
                                      l.clientSplitId === line.clientSplitId ? { ...l, accountId: value } : l
                                    )
                                  })
                                }
                                options={accountOptions}
                                placeholder="Account"
                                allowCustomValue={false}
                                optionSize="sm"
                              />
                            </div>
                            <div className="w-20">
                              <InputField
                                type="number"
                                step="0.01"
                                value={line.amount}
                                onChange={(event) =>
                                  onRowChange(row.clientRowId, {
                                    categorySplits: row.categorySplits!.map((l) =>
                                      l.clientSplitId === line.clientSplitId ? { ...l, amount: event.target.value } : l
                                    )
                                  })
                                }
                                className="text-right"
                              />
                            </div>
                            <button
                              type="button"
                              aria-label="Remove split line"
                              className="text-[var(--color-icon-secondary)] hover:text-red-600 disabled:opacity-30"
                              onClick={() =>
                                onRowChange(row.clientRowId, {
                                  categorySplits:
                                    row.categorySplits!.length <= 2
                                      ? null
                                      : row.categorySplits!.filter((l) => l.clientSplitId !== line.clientSplitId)
                                })
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className="text-[11px] text-[var(--color-link-text)] hover:underline"
                            onClick={() =>
                              onRowChange(row.clientRowId, { categorySplits: [...row.categorySplits!, newSplitLine()] })
                            }
                          >
                            + Add split
                          </button>
                          <span
                            className={`text-[11px] ${isSplitBalanced(row) ? "text-emerald-600" : "text-[var(--color-icon-secondary)]"}`}
                          >
                            {isSplitBalanced(row)
                              ? "Balanced"
                              : `Remaining ${formatMoney(Math.abs((row.amount === null ? 0 : Math.abs(row.amount)) - splitTotal(row.categorySplits)))}`}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="text-[11px] text-[var(--color-icon-secondary)] hover:underline"
                          onClick={() => onRowChange(row.clientRowId, { categorySplits: null })}
                        >
                          Use a single account instead
                        </button>
                      </div>
                    ) : (
                      <>
                        <SelectField
                          value={row.categoryAccountId ?? ""}
                          onChange={(value) =>
                            onRowChange(row.clientRowId, {
                              categoryAccountId: value || null,
                              categoryConfidence: null,
                              categorySource: value ? "manual" : null
                            })
                          }
                          options={accountOptions}
                          placeholder="Select"
                          allowCustomValue={false}
                          optionSize="sm"
                        />
                        <button
                          type="button"
                          className="mt-1 text-[11px] text-[var(--color-link-text)] hover:underline"
                          onClick={() =>
                            onRowChange(row.clientRowId, {
                              categorySplits: [
                                newSplitLine(row.categoryAccountId ?? "", ""),
                                newSplitLine()
                              ],
                              categoryAccountId: null,
                              categoryConfidence: null,
                              categorySource: null
                            })
                          }
                        >
                          + Split into multiple accounts
                        </button>
                      </>
                    )}
                    {row.categorySource === "ai" || row.categorySource === "rule" || row.categorySource === "bank-rule" ? (
                      <p className="mt-0.5 text-[11px] text-[var(--color-icon-secondary)]">
                        {row.categorySource === "rule"
                          ? "Remembered from a previous import"
                          : row.categorySource === "bank-rule"
                            ? "Set by a bank rule"
                            : row.categoryConfidence !== null
                              ? `AI suggested · ${Math.round(row.categoryConfidence * 100)}% confident`
                              : "AI suggested"}
                      </p>
                    ) : null}
                    {(() => {
                      if (row.categorySplits) return null;
                      const match = bankRuleMatches?.get(row.clientRowId);
                      if (!match || match.targetAccountId === row.categoryAccountId) return null;
                      const accountLabel = accountLabelById.get(match.targetAccountId) ?? match.targetAccountId;
                      return (
                        <p className="mt-0.5 text-[11px] text-[var(--color-icon-secondary)]">
                          Rule &ldquo;{match.name}&rdquo; suggests {accountLabel} ·{" "}
                          <button
                            type="button"
                            className="text-[var(--color-link-text)] hover:underline"
                            onClick={() =>
                              onRowChange(row.clientRowId, {
                                categoryAccountId: match.targetAccountId,
                                categoryConfidence: null,
                                categorySource: "bank-rule"
                              })
                            }
                          >
                            Use instead
                          </button>
                        </p>
                      );
                    })()}
                  </td>
                  <td className="p-2 align-top text-center">
                    <IconButton
                      icon={Trash2}
                      label="Delete row"
                      size="sm"
                      onClick={() => onRowDelete(row.clientRowId)}
                    />
                    {onExcludeRow && !exclusionMatches?.has(row.clientRowId) && row.payee.trim() !== "" ? (
                      <button
                        type="button"
                        className="mt-1 block w-full text-[11px] text-[var(--color-link-text)] hover:underline"
                        onClick={() => onExcludeRow(row)}
                      >
                        Exclude
                      </button>
                    ) : null}
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
