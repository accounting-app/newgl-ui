"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type CsvDropZoneProps = {
  onFileSelected: (file: File) => void;
  error: string | null;
};

export function CsvDropZone({ onFileSelected, error }: CsvDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <div>
        <h2 className="text-xl font-medium text-[var(--color-text-primary)]">Import transactions</h2>
        <p className="mt-1 text-sm text-[var(--color-icon-secondary)]">
          Add transactions from a CSV export. Supports CSV files up to 10 MB.
        </p>
      </div>

      <div
        className={`flex flex-col items-center justify-center gap-3 rounded border-2 border-dashed p-12 text-center transition-colors ${
          isDragOver
            ? "border-[var(--color-ui-primary)] bg-[var(--color-container-background-accent)]"
            : "border-[var(--color-container-border-secondary)]"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <Upload className="h-8 w-8 text-[var(--color-icon-secondary)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Drop your file here</p>
        <p className="text-xs text-[var(--color-icon-secondary)]">Supports CSV files up to 10 MB</p>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          Browse files
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-secondary)] p-4">
        <p className="mb-1 text-sm font-medium text-[var(--color-text-primary)]">CSV format reference</p>
        <p className="mb-3 text-xs text-[var(--color-icon-secondary)]">
          Use columns for Date (YYYY-MM-DD), Payee, Description, and Amount. Negative values represent
          expenses.
        </p>
        <pre className="overflow-x-auto rounded bg-[var(--color-container-background-primary)] p-3 text-xs text-[var(--color-text-primary)]">
{`Date,Payee,Description,Amount
2025-12-01,Starbucks,Coffee Shop Purchase,-4.50
2025-12-02,Walmart,Grocery Store,-45.67
2025-12-03,Employer Inc,Salary Deposit,2500.00`}
        </pre>
      </div>
    </div>
  );
}
