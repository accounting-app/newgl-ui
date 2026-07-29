"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { CsvDropZone } from "@/components/csv-import/csv-drop-zone";
import { CsvImportSummary } from "@/components/csv-import/csv-import-summary";
import { CsvMappingStep } from "@/components/csv-import/csv-mapping-step";
import { CsvReviewTable, isRowSubmittable } from "@/components/csv-import/csv-review-table";
import { ImportConfirmDialog } from "@/components/csv-import/import-confirm-dialog";
import { ImportWizardSteps } from "@/components/csv-import/import-wizard-steps";
import type { WizardStepInfo } from "@/components/csv-import/import-wizard-steps";
import { SelectAccountStep } from "@/components/csv-import/select-account-step";
import { useBodyScrollLock } from "@/hooks/use-body-scroll-lock";
import { buildReviewRows, getColumnLabels, tokenizeCsvText } from "@/modules/accounting/domain/parse-csv";
import {
  clearCsvImportSession,
  loadCsvImportSession,
  saveCsvImportSession
} from "@/modules/accounting/domain/csv-import-session";
import {
  DEFAULT_FORMAT_OPTIONS,
  EMPTY_COLUMN_MAPPING,
  type ColumnMapping,
  type FormatOptions,
  type ReviewRow,
  type SignConvention,
  type WizardStep
} from "@/modules/accounting/domain/csv-import";
import type { ImportTransactionsInput, ImportTransactionsResult } from "@/modules/accounting/domain/models";

type ImportModalProps = {
  open: boolean;
  onClose: () => void;
  defaultMainAccountId: string;
  accountOptions: SelectFieldOption[];
  onImportTransactions: (input: ImportTransactionsInput) => Promise<ImportTransactionsResult>;
  onSessionChange?: (rowCount: number) => void;
};

const WIZARD_STEPS: WizardStepInfo[] = [
  { key: "UPLOAD" },
  { key: "ACCOUNT" },
  { key: "MAPPING" },
  { key: "VERIFY" }
];

export function ImportModal({
  open,
  onClose,
  defaultMainAccountId,
  accountOptions,
  onImportTransactions,
  onSessionChange
}: ImportModalProps) {
  const [step, setStep] = useState<WizardStep>("UPLOAD");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [mainAccountId, setMainAccountId] = useState(defaultMainAccountId);
  const [formatOptions, setFormatOptions] = useState<FormatOptions>(DEFAULT_FORMAT_OPTIONS);
  const [mapping, setMapping] = useState<ColumnMapping>(EMPTY_COLUMN_MAPPING);
  const [signConvention, setSignConvention] = useState<SignConvention>("ORIGINAL");

  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [resumedFromSession, setResumedFromSession] = useState(false);

  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<ImportTransactionsResult | null>(null);
  const [submittedRows, setSubmittedRows] = useState<ReviewRow[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setUploadError(null);
    if (reviewRows.length > 0) {
      // Already have an in-progress review in memory (modal reopened without a reload) — resume as-is.
      setStep("VERIFY");
      return;
    }
    const saved = loadCsvImportSession(defaultMainAccountId);
    if (saved) {
      setReviewRows(saved.rows);
      setSelectedRowIds(new Set(saved.selectedRowClientIds));
      setMainAccountId(saved.mainAccountId);
      setResumedFromSession(true);
      setStep("VERIFY");
    } else {
      setFile(null);
      setRawRows([]);
      setMainAccountId(defaultMainAccountId);
      setFormatOptions(DEFAULT_FORMAT_OPTIONS);
      setMapping(EMPTY_COLUMN_MAPPING);
      setSignConvention("ORIGINAL");
      setResumedFromSession(false);
      setStep("UPLOAD");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (reviewRows.length === 0) return;
    saveCsvImportSession(defaultMainAccountId, {
      mainAccountId,
      rows: reviewRows,
      selectedRowClientIds: [...selectedRowIds]
    });
    onSessionChange?.(reviewRows.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewRows, mainAccountId, selectedRowIds]);

  if (!open) return null;

  function handleFileSelected(selectedFile: File) {
    setUploadError(null);
    selectedFile
      .text()
      .then((text) => {
        const tokenized = tokenizeCsvText(text);
        if (tokenized.length === 0) {
          setUploadError("The file is empty.");
          return;
        }
        setFile(selectedFile);
        setRawRows(tokenized);
        setStep("ACCOUNT");
      })
      .catch(() => setUploadError("Could not read that file. Please try again."));
  }

  function handleMappingContinue() {
    const dataRows = formatOptions.hasHeaderRow ? rawRows.slice(1) : rawRows;
    const built = buildReviewRows(dataRows, mapping, formatOptions, signConvention);
    setReviewRows(built);
    setSelectedRowIds(new Set(built.filter((row) => row.parseErrors.length === 0).map((row) => row.clientRowId)));
    setResumedFromSession(false);
    setStep("VERIFY");
  }

  function handleSignConventionChange(next: SignConvention) {
    setSignConvention(next);
    setReviewRows((current) => current.map((row) => (row.amount === null ? row : { ...row, amount: -row.amount })));
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
    setSelectedRowIds((current) => {
      const next = new Set(current);
      next.delete(clientRowId);
      return next;
    });
  }

  function handleStartOver() {
    setReviewRows([]);
    setSelectedRowIds(new Set());
    clearCsvImportSession(defaultMainAccountId);
    onSessionChange?.(0);
    setFile(null);
    setRawRows([]);
    setMainAccountId(defaultMainAccountId);
    setFormatOptions(DEFAULT_FORMAT_OPTIONS);
    setMapping(EMPTY_COLUMN_MAPPING);
    setSignConvention("ORIGINAL");
    setResumedFromSession(false);
    setStep("UPLOAD");
  }

  async function handleConfirmedSubmit() {
    const submittable = reviewRows.filter(
      (row) => selectedRowIds.has(row.clientRowId) && isRowSubmittable(row, mainAccountId)
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
      setSelectedRowIds(new Set());
      clearCsvImportSession(defaultMainAccountId);
      onSessionChange?.(0);
      setIsConfirmDialogOpen(false);
      setStep("RESULT");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Import failed. Please try again.");
      setIsConfirmDialogOpen(false);
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

  const selectedSubmittableCount = reviewRows.filter(
    (row) => selectedRowIds.has(row.clientRowId) && isRowSubmittable(row, mainAccountId)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-container-background-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-6 py-4">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Import bank transactions</p>
        <button
          type="button"
          aria-label="Close import"
          className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-primary)]"
          onClick={handleClose}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-1 items-start gap-10 overflow-auto px-6 py-10">
        {step !== "RESULT" ? <ImportWizardSteps steps={WIZARD_STEPS} currentStep={step} /> : null}

        <div className="w-full min-w-0 flex-1">
          {step === "UPLOAD" ? <CsvDropZone onFileSelected={handleFileSelected} error={uploadError} /> : null}

          {step === "ACCOUNT" && file ? (
            <SelectAccountStep
              fileName={file.name}
              accountOptions={accountOptions}
              mainAccountId={mainAccountId}
              onMainAccountChange={setMainAccountId}
              onBack={() => setStep("UPLOAD")}
              onContinue={() => setStep("MAPPING")}
            />
          ) : null}

          {step === "MAPPING" && file ? (
            <CsvMappingStep
              fileName={file.name}
              columnLabels={getColumnLabels(rawRows, formatOptions.hasHeaderRow)}
              formatOptions={formatOptions}
              onFormatOptionsChange={(patch) => setFormatOptions((current) => ({ ...current, ...patch }))}
              mapping={mapping}
              onMappingChange={(patch) => setMapping((current) => ({ ...current, ...patch }))}
              onBack={() => setStep("ACCOUNT")}
              onContinue={handleMappingContinue}
            />
          ) : null}

          {step === "VERIFY" ? (
            <>
              <CsvReviewTable
                rows={reviewRows}
                accountOptions={accountOptions}
                mainAccountId={mainAccountId}
                selectedRowIds={selectedRowIds}
                onSelectedRowIdsChange={setSelectedRowIds}
                signConvention={signConvention}
                onSignConventionChange={handleSignConventionChange}
                onRowChange={handleRowChange}
                onRowDelete={handleRowDelete}
                onBack={() => setStep("MAPPING")}
                onContinue={() => setIsConfirmDialogOpen(true)}
                isSubmitting={isSubmitting}
                submitError={uploadError}
                backDisabled={resumedFromSession}
              />
              {resumedFromSession ? (
                <button
                  type="button"
                  className="mt-3 text-xs text-[var(--color-link-text)] hover:underline"
                  onClick={handleStartOver}
                >
                  Start a new import instead
                </button>
              ) : null}
            </>
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

      <ImportConfirmDialog
        open={isConfirmDialogOpen}
        transactionCount={selectedSubmittableCount}
        isSubmitting={isSubmitting}
        onCancel={() => setIsConfirmDialogOpen(false)}
        onConfirm={handleConfirmedSubmit}
      />
    </div>
  );
}
