"use client";

import { Sparkles } from "lucide-react";
import { SelectField } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";
import {
  DATE_FORMAT_OPTIONS,
  type AmountColumnsMode,
  type ColumnMapping,
  type DateFormatOption,
  type FormatOptions
} from "@/modules/accounting/domain/csv-import";

type CsvMappingStepProps = {
  fileName: string;
  columnLabels: string[];
  formatOptions: FormatOptions;
  onFormatOptionsChange: (patch: Partial<FormatOptions>) => void;
  mapping: ColumnMapping;
  onMappingChange: (patch: Partial<ColumnMapping>) => void;
  onBack: () => void;
  onContinue: () => void;
  onSuggestMapping: () => void;
  isSuggestingMapping: boolean;
  suggestMappingError: string | null;
  aiEnabled: boolean;
};

const NATIVE_SELECT_CLASS =
  "input-field h-9 w-full rounded px-3 font-normal leading-[1.2] transition-[background-color,border-color,box-shadow] duration-200 focus:outline-none";

function columnOptions(columnLabels: string[]) {
  return columnLabels.map((label, index) => ({
    value: String(index),
    label: label ? `Column ${index + 1}: ${label}` : `Column ${index + 1}`
  }));
}

function MappingRow({
  label,
  required,
  value,
  onChange,
  options
}: {
  label: string;
  required?: boolean;
  value: number | null;
  onChange: (value: number | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-4 border-b border-[var(--color-container-background-secondary)] py-3">
      <p className="text-sm text-[var(--color-text-primary)]">
        {label}
        {required ? null : <span className="text-[var(--color-icon-secondary)]"> (optional)</span>}
      </p>
      <SelectField
        value={value === null ? "" : String(value)}
        onChange={(next) => onChange(next === "" ? null : Number(next))}
        options={options}
        placeholder={`Select a ${label.toLowerCase()} field`}
        allowCustomValue={false}
        optionSize="sm"
      />
    </div>
  );
}

export function CsvMappingStep({
  fileName,
  columnLabels,
  formatOptions,
  onFormatOptionsChange,
  mapping,
  onMappingChange,
  onBack,
  onContinue,
  onSuggestMapping,
  isSuggestingMapping,
  suggestMappingError,
  aiEnabled
}: CsvMappingStepProps) {
  const options = columnOptions(columnLabels);
  const isContinueDisabled =
    mapping.dateColumn === null ||
    (formatOptions.amountColumnsMode === "SINGLE"
      ? mapping.amountColumn === null
      : mapping.debitColumn === null && mapping.creditColumn === null);

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <div>
        <h2 className="text-xl font-medium text-[var(--color-text-primary)]">Let&apos;s set up your file</h2>
        <p className="mt-1 text-sm text-[var(--color-icon-secondary)]">Selected File: {fileName}</p>
      </div>

      <section>
        <p className="mb-3 border-b border-[var(--color-divider-tertiary)] pb-2 text-sm font-medium text-[var(--color-text-primary)]">
          Step 1: Tell us about the format of your data
        </p>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[var(--color-text-primary)]">Is the first row in your file a header?</span>
            <select
              className={NATIVE_SELECT_CLASS}
              value={formatOptions.hasHeaderRow ? "yes" : "no"}
              onChange={(event) => onFormatOptionsChange({ hasHeaderRow: event.target.value === "yes" })}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-[var(--color-text-primary)]">How many columns show amounts?</span>
            <select
              className={NATIVE_SELECT_CLASS}
              value={formatOptions.amountColumnsMode}
              onChange={(event) =>
                onFormatOptionsChange({ amountColumnsMode: event.target.value as AmountColumnsMode })
              }
            >
              <option value="SINGLE">One column</option>
              <option value="DEBIT_CREDIT">Two columns (Debit &amp; Credit)</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-[var(--color-text-primary)]">What&apos;s the date format used in your file?</span>
            <select
              className={NATIVE_SELECT_CLASS}
              value={formatOptions.dateFormat}
              onChange={(event) => onFormatOptionsChange({ dateFormat: event.target.value as DateFormatOption })}
            >
              {DATE_FORMAT_OPTIONS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between border-b border-[var(--color-divider-tertiary)] pb-2">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Step 2: Select the fields that correspond to your file
          </p>
          {aiEnabled ? (
            <Button
              variant="secondary"
              onClick={onSuggestMapping}
              disabled={isSuggestingMapping || !formatOptions.hasHeaderRow}
              title={formatOptions.hasHeaderRow ? undefined : "Needs a header row to suggest fields"}
            >
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {isSuggestingMapping ? "Suggesting…" : "Suggest with AI"}
              </span>
            </Button>
          ) : null}
        </div>
        {suggestMappingError ? <p className="mb-3 text-sm text-red-600">{suggestMappingError}</p> : null}
        <div>
          <MappingRow
            label="Date"
            required
            value={mapping.dateColumn}
            onChange={(value) => onMappingChange({ dateColumn: value })}
            options={options}
          />
          <MappingRow
            label="Description"
            value={mapping.descriptionColumn}
            onChange={(value) => onMappingChange({ descriptionColumn: value })}
            options={options}
          />
          {formatOptions.amountColumnsMode === "SINGLE" ? (
            <MappingRow
              label="Amount"
              required
              value={mapping.amountColumn}
              onChange={(value) => onMappingChange({ amountColumn: value })}
              options={options}
            />
          ) : (
            <>
              <MappingRow
                label="Debit"
                value={mapping.debitColumn}
                onChange={(value) => onMappingChange({ debitColumn: value })}
                options={options}
              />
              <MappingRow
                label="Credit"
                value={mapping.creditColumn}
                onChange={(value) => onMappingChange({ creditColumn: value })}
                options={options}
              />
            </>
          )}
          <MappingRow
            label="Payee"
            value={mapping.payeeColumn}
            onChange={(value) => onMappingChange({ payeeColumn: value })}
            options={options}
          />
          <MappingRow
            label="Check number"
            value={mapping.referenceColumn}
            onChange={(value) => onMappingChange({ referenceColumn: value })}
            options={options}
          />
        </div>
      </section>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={isContinueDisabled}>
          Continue
        </Button>
      </div>
    </div>
  );
}
