"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { CsvDropZone } from "@/components/csv-import/csv-drop-zone";
import { CsvImportSummary } from "@/components/csv-import/csv-import-summary";
import { CsvReviewTable } from "@/components/csv-import/csv-review-table";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { parseCsvText } from "@/modules/accounting/domain/parse-csv";
import {
  clearCsvImportSession,
  loadCsvImportSession,
  saveCsvImportSession
} from "@/modules/accounting/domain/csv-import-session";
import type { ReviewRow } from "@/modules/accounting/domain/csv-import";
import type { ImportTransactionsInput, ImportTransactionsResult } from "@/modules/accounting/domain/models";

type ImportStep = "UPLOAD" | "REVIEW" | "RESULT";

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  defaultMainAccountId: string;
  accountOptions: SelectFieldOption[];
  onImportTransactions: (input: ImportTransactionsInput) => Promise<ImportTransactionsResult>;
  onSessionChange?: (rowCount: number) => void;
};

export function ImportModal({
  open,
  onClose,
  defaultMainAccountId,
  accountOptions,
  onImportTransactions,
  onSessionChange
}: ImportModalProps) {
  const [step, setStep] = useState<ImportStep>("UPLOAD");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [mainAccountId, setMainAccountId] = useState(defaultMainAccountId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<ImportTransactionsResult | null>(null);
  const [submittedRows, setSubmittedRows] = useState<ReviewRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setUploadError(null);
    if (reviewRows.length > 0) {
      // Already have an in-progress review in memory (modal was reopened without a reload) — resume it as-is.
      setStep("REVIEW");
      return;
    }
    const saved = loadCsvImportSession(defaultMainAccountId);
    if (saved) {
      setReviewRows(saved.rows);
      setMainAccountId(saved.mainAccountId);
      setStep("REVIEW");
    } else {
      setMainAccountId(defaultMainAccountId);
      setStep("UPLOAD");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (reviewRows.length === 0) return;
    saveCsvImportSession(defaultMainAccountId, { mainAccountId, rows: reviewRows });
    onSessionChange?.(reviewRows.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewRows, mainAccountId]);

  if (!open) return null;

  function handleFileSelected(file: File) {
    setUploadError(null);
    file
      .text()
      .then((text) => {
        const { rows, headerError } = parseCsvText(text);
        if (headerError) {
          setUploadError(headerError);
          return;
        }
        setReviewRows(rows);
        setStep("REVIEW");
      })
      .catch(() => setUploadError("Could not read that file. Please try again."));
  }

  function handleRowChange(clientRowId: string, patch: Partial<ReviewRow>) {
    setReviewRows((current) =>
      current.map((row) => (row.clientRowId === clientRowId ? { ...row, ...patch } : row))
    );
  }

  function handleRowDelete(clientRowId: string) {
    setReviewRows((current) => {
      const next = current.filter((row) => row.clientRowId !== clientRowId);
      if (next.length === 0) {
        clearCsvImportSession(defaultMainAccountId);
        onSessionChange?.(0);
      }
      return next;
    });
  }

  function handleDiscardReview() {
    setReviewRows([]);
    clearCsvImportSession(defaultMainAccountId);
    onSessionChange?.(0);
    setStep("UPLOAD");
  }

  async function handleConfirmedSubmit() {
    const submittable = reviewRows.filter(
      (row) =>
        row.transactionDate !== null &&
        row.amount !== null &&
        row.categoryAccountId !== null &&
        row.categoryAccountId !== mainAccountId
    );
    if (submittable.length === 0 || !mainAccountId) return;

    setIsSubmitting(true);
    try {
      const result = await onImportTransactions({
        mainAccountId,
        rows: submittable.map((row) => ({
          clientRowId: row.clientRowId,
          transactionDate: row.transactionDate!,
          payee: row.payee || undefined,
          memo: row.memo || undefined,
          amount: row.amount!,
          categoryAccountId: row.categoryAccountId!
        }))
      });
      setImportResult(result);
      setSubmittedRows(submittable);
      setSkippedCount(reviewRows.length - submittable.length);
      setReviewRows([]);
      clearCsvImportSession(defaultMainAccountId);
      onSessionChange?.(0);
      setStep("RESULT");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Import failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClose() {
    // Intentionally does NOT clear reviewRows or the saved session — closing the modal
    // (or reloading the page) must not lose an in-progress review.
    setImportResult(null);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-container-background-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-6 py-4">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Smart Import</p>
        <button
          type="button"
          aria-label="Close import"
          className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-primary)]"
          onClick={handleClose}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-8">
        {step === "UPLOAD" ? <CsvDropZone onFileSelected={handleFileSelected} error={uploadError} /> : null}

        {step === "REVIEW" ? (
          <CsvReviewTable
            rows={reviewRows}
            accountOptions={accountOptions}
            mainAccountId={mainAccountId}
            onMainAccountChange={setMainAccountId}
            onRowChange={handleRowChange}
            onRowDelete={handleRowDelete}
            onSubmit={handleConfirmedSubmit}
            onCancel={handleDiscardReview}
            isSubmitting={isSubmitting}
            submitError={uploadError}
          />
        ) : null}

        {step === "RESULT" && importResult ? (
          <CsvImportSummary
            result={importResult}
            rows={submittedRows}
            skippedCount={skippedCount}
            onClose={handleClose}
          />
        ) : null}
      </div>
    </div>
  );
}
