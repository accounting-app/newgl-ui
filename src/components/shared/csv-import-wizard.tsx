"use client";

import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { getColumnLabels, tokenizeCsvText } from "@/modules/accounting/domain/parse-csv";

const STEPS = ["Upload", "Map data", "Import"];

export type ImportField = {
  /** Key this column's value lands under in the row object passed to onCreateRow. */
  key: string;
  label: string;
  required?: boolean;
  /** Lowercase header text this field auto-matches on the file's own header row, e.g. ["vendor name", "name"]. */
  aliases: string[];
};

type ImportOutcome = { rowNumber: number; label: string; error?: string };

/**
 * Generic 3-step "Import <entity>" wizard -- matches QBO's own Upload /
 * Map data / Import flow for Vendors and Customers. One shared
 * implementation (parsing, column-mapping, sequential create + results)
 * behind a thin per-entity config, rather than duplicating this logic
 * across ImportVendorsModal/ImportCustomersModal the way their UI-only
 * predecessors were -- the two call sites still stay separate components
 * (each with its own sample file/title/field list), same "one shared
 * modal, thin wrappers" shape as TransactionFormModal.
 */
export function CsvImportWizard<TCreated>({
  title,
  entityNamePlural,
  fields,
  sampleCsv,
  sampleFileName,
  onCreateRow,
  onClose
}: {
  title: string;
  entityNamePlural: string;
  fields: ImportField[];
  sampleCsv: string;
  sampleFileName: string;
  onCreateRow: (row: Record<string, string>) => Promise<TCreated>;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<string[][]>([]);
  const [readError, setReadError] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>(() => Object.fromEntries(fields.map((f) => [f.key, null])));
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportOutcome[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const columnLabels = useMemo(() => getColumnLabels(rows, true), [rows]);
  const dataRows = useMemo(() => rows.slice(1), [rows]);
  const columnOptions = useMemo(
    () => columnLabels.map((label, index) => ({ value: String(index), label: label ? `Column ${index + 1}: ${label}` : `Column ${index + 1}` })),
    [columnLabels]
  );

  function downloadSampleFile() {
    const blob = new Blob([sampleCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = sampleFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileSelected(file: File) {
    setReadError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      const parsed = tokenizeCsvText(text);
      if (parsed.length < 2) {
        setReadError("This file needs a header row plus at least one data row.");
        setRows([]);
        return;
      }
      setRows(parsed);
      // Auto-guess each field's column from the header row, same
      // convenience QBO's own import offers -- the user can still
      // override any guess on the Map data step.
      const header = parsed[0].map((cell) => cell.trim().toLowerCase());
      const guessed: Record<string, number | null> = {};
      fields.forEach((field) => {
        const index = header.findIndex((cell) => field.aliases.includes(cell));
        guessed[field.key] = index >= 0 ? index : null;
      });
      setMapping(guessed);
    } catch {
      setReadError("Could not read this file. Make sure it's a plain CSV file.");
      setRows([]);
    }
  }

  function cellAt(row: string[], columnIndex: number | null): string {
    if (columnIndex === null) return "";
    return row[columnIndex]?.trim() ?? "";
  }

  const requiredField = fields.find((f) => f.required);
  const canContinueFromMapping = !requiredField || mapping[requiredField.key] !== null;

  async function runImport() {
    setImporting(true);
    const outcomes: ImportOutcome[] = [];
    for (let i = 0; i < dataRows.length; i += 1) {
      const row = dataRows[i];
      const record: Record<string, string> = {};
      fields.forEach((field) => {
        record[field.key] = cellAt(row, mapping[field.key]);
      });
      const label = record[requiredField?.key ?? fields[0].key] || `Row ${i + 2}`;
      if (requiredField && !record[requiredField.key]) {
        outcomes.push({ rowNumber: i + 2, label, error: `${requiredField.label} is required -- row skipped.` });
        continue;
      }
      try {
        await onCreateRow(record);
        outcomes.push({ rowNumber: i + 2, label });
      } catch (err) {
        outcomes.push({ rowNumber: i + 2, label, error: err instanceof Error ? err.message : "Could not create this row." });
      }
    }
    setResults(outcomes);
    setImporting(false);
  }

  const succeededCount = results?.filter((r) => !r.error).length ?? 0;
  const failedCount = results?.filter((r) => r.error).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-container-background-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-6 py-3">
        <h2 className="text-xl font-semibold text-[var(--color-text-global)]">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 border-b border-[var(--color-divider-tertiary)] px-6 py-4">
        {STEPS.map((label, index) => (
          <div key={label} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  index === step
                    ? "bg-[var(--color-ui-primary)] text-white"
                    : index < step
                      ? "border border-[var(--color-positive)] text-[var(--color-positive)]"
                      : "border border-[var(--color-divider-tertiary)] text-[var(--color-text-disabled)]"
                }`}
              >
                {index + 1}
              </span>
              <span className={`text-xs uppercase tracking-wide ${index === step ? "text-[var(--color-text-global)]" : "text-[var(--color-text-disabled)]"}`}>{label}</span>
            </div>
            {index < STEPS.length - 1 ? <span className="h-px w-16 bg-[var(--color-divider-tertiary)]" /> : null}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        {step === 0 ? (
          <>
            <h3 className="mb-3 text-lg font-semibold text-[var(--color-text-global)]">First time importing {entityNamePlural}?</h3>
            <ul className="mb-6 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-primary)]">
              <li>All your {entityNamePlural} information must be in one file</li>
              <li>The top row of your file must contain a header title for each column of information</li>
              {requiredField ? (
                <li>
                  <span className="font-semibold">{requiredField.label}</span> is the only required field
                </li>
              ) : null}
            </ul>

            <div className="w-[340px] rounded-lg border border-[var(--color-divider-tertiary)] p-5">
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={fileName}
                  className="h-9 flex-1 rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-3 text-sm text-[var(--color-input-text)]"
                />
                <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                  Browse
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) handleFileSelected(file);
                  }}
                />
              </div>
              {readError ? <p className="mt-2 text-sm text-[var(--color-negative)]">{readError}</p> : null}
              <button type="button" onClick={downloadSampleFile} className="mt-2 text-sm text-[var(--color-link-action)] hover:underline">
                Download a sample file
              </button>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text-global)]">Map your columns</h3>
              <p className="mt-1 text-sm text-[var(--color-icon-secondary)]">
                Selected file: {fileName} ({dataRows.length} row{dataRows.length === 1 ? "" : "s"})
              </p>
            </div>
            <div className="flex flex-col divide-y divide-[var(--color-divider-tertiary)] rounded-lg border border-[var(--color-divider-tertiary)] px-4">
              {fields.map((field) => (
                <div key={field.key} className="grid grid-cols-2 items-center gap-4 py-3">
                  <p className="text-sm text-[var(--color-text-primary)]">
                    {field.label}
                    {field.required ? null : <span className="text-[var(--color-icon-secondary)]"> (optional)</span>}
                  </p>
                  <Select
                    value={mapping[field.key] === null ? "" : String(mapping[field.key])}
                    onChange={(v) => setMapping((current) => ({ ...current, [field.key]: v === "" ? null : Number(v) }))}
                    options={columnOptions}
                    placeholder="Don't import"
                    allowCustomValue={false}
                    optionSize="sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          results ? (
            <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-container-background-accent)] text-[var(--color-positive)]">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </span>
              <p className="text-lg font-semibold text-[var(--color-text-global)]">
                {succeededCount} {entityNamePlural} imported{failedCount > 0 ? `, ${failedCount} skipped` : ""}
              </p>
              {failedCount > 0 ? (
                <div className="w-full rounded-lg border border-[var(--color-divider-tertiary)] text-left">
                  {results
                    .filter((r) => r.error)
                    .map((r) => (
                      <div key={r.rowNumber} className="flex items-start gap-2 border-b border-[var(--color-divider-tertiary)] px-4 py-2 text-sm last:border-b-0">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-negative)]" aria-hidden="true" />
                        <span className="text-[var(--color-text-primary)]">
                          Row {r.rowNumber} ({r.label}): {r.error}
                        </span>
                      </div>
                    ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-[640px] flex-col gap-4">
              <h3 className="text-lg font-semibold text-[var(--color-text-global)]">Review and import</h3>
              <p className="text-sm text-[var(--color-text-primary)]">
                Ready to import {dataRows.length} row{dataRows.length === 1 ? "" : "s"} as {entityNamePlural}.
              </p>
              <div className="overflow-x-auto rounded-lg border border-[var(--color-divider-tertiary)]">
                <table className="w-full min-w-[500px] border-collapse text-sm">
                  <thead className="header-table text-left uppercase tracking-wide">
                    <tr>
                      {fields.map((field) => (
                        <th key={field.key} className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle first:border-l-0">
                          {field.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="content-table">
                    {dataRows.slice(0, 5).map((row, index) => (
                      <tr key={index} className="border-t border-[var(--color-divider-tertiary)]">
                        {fields.map((field) => (
                          <td key={field.key} className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)] first:border-l-0">
                            {cellAt(row, mapping[field.key]) || "--"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {dataRows.length > 5 ? <p className="text-xs text-[var(--color-icon-secondary)]">Showing the first 5 of {dataRows.length} rows.</p> : null}
            </div>
          )
        ) : null}
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-divider-tertiary)] px-6 py-3">
        <Button variant="secondary" onClick={step === 0 || results ? onClose : () => setStep((s) => s - 1)} disabled={importing}>
          {step === 0 || results ? "Cancel" : "Back"}
        </Button>
        {step === 0 ? (
          <Button onClick={() => setStep(1)} disabled={rows.length === 0}>
            Next
          </Button>
        ) : step === 1 ? (
          <Button onClick={() => setStep(2)} disabled={!canContinueFromMapping}>
            Next
          </Button>
        ) : results ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <Button onClick={runImport} disabled={importing}>
            {importing ? "Importing…" : `Import ${dataRows.length} row${dataRows.length === 1 ? "" : "s"}`}
          </Button>
        )}
      </div>
    </div>
  );
}
