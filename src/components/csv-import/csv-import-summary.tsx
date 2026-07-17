"use client";

import { Button } from "@/components/ui/button";
import type { ImportTransactionsResult } from "@/modules/accounting/domain/models";
import type { ReviewRow } from "@/modules/accounting/domain/csv-import";

type CsvImportSummaryProps = {
  result: ImportTransactionsResult;
  rows: ReviewRow[];
  skippedCount: number;
  onClose: () => void;
};

export function CsvImportSummary({ result, rows, skippedCount, onClose }: CsvImportSummaryProps) {
  const rowsById = new Map(rows.map((row) => [row.clientRowId, row]));
  const failedRows = result.results.filter((row) => row.status === "FAILED");

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6">
      <div>
        <h2 className="text-xl font-medium text-[var(--color-text-primary)]">Import complete</h2>
        <p className="mt-1 text-sm text-[var(--color-icon-secondary)]">
          {result.succeeded} succeeded / {result.failed} failed
          {skippedCount > 0 ? ` / ${skippedCount} skipped` : ""}.
        </p>
      </div>

      {result.succeeded > 0 ? (
        <p className="rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-secondary)] p-3 text-sm text-[var(--color-text-primary)]">
          Imported transactions have been added to your register.
        </p>
      ) : null}

      {failedRows.length > 0 ? (
        <div className="rounded border border-[var(--color-divider-tertiary)]">
          <p className="border-b border-[var(--color-divider-tertiary)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)]">
            Failed rows
          </p>
          <ul className="divide-y divide-[var(--color-container-background-secondary)]">
            {failedRows.map((row) => {
              const source = rowsById.get(row.clientRowId);
              return (
                <li key={row.clientRowId} className="px-3 py-2 text-sm">
                  <span className="text-[var(--color-text-primary)]">
                    {source?.rawDate || "—"} · {source?.payee || "—"} · {source?.rawAmount || "—"}
                  </span>
                  <p className="text-xs text-red-600">{row.error}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="primary" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
