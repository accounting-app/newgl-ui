"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { ReceiptRecord, Vendor } from "@/lib/local-store/expenses-bills-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isReviewed(receipt: ReceiptRecord): boolean {
  return Boolean(receipt.vendorId && receipt.categoryAccountId && receipt.amount);
}

// Phase 1: records that a receipt exists (filename, size, when) plus
// review fields (vendor/category/amount) filled in manually -- doesn't
// store the file itself yet, and there's no OCR auto-fill (a real backend
// + AI feature, Phase 1.5+). See
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function ReceiptsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  const categoryOptions = useMemo(
    () => accounts.filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );

  const vendorsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const { items: vendors } = useLocalCollection<Vendor>(vendorsKey ?? "newgl:phase1:pending:vendors");
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v.id, label: v.name })), [vendors]);

  const storageKey = activeCompany ? companyScopedKey(activeCompany.name, "receipts") : null;
  const { items: receipts, hydrated, add, update, remove } = useLocalCollection<ReceiptRecord>(storageKey ?? "newgl:phase1:pending:receipts");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [tab, setTab] = useState<"review" | "reviewed">("review");

  const forReview = useMemo(() => receipts.filter((r) => !isReviewed(r)), [receipts]);
  const reviewed = useMemo(() => receipts.filter(isReviewed), [receipts]);
  const visible = tab === "review" ? forReview : reviewed;

  function handleFileSelected(file: File) {
    add({ id: localId(), fileName: file.name, fileSizeBytes: file.size, uploadedAt: new Date().toISOString() });
    toast({
      variant: "success",
      title: "Receipt added",
      description: "File storage isn't connected yet -- fill in the details below to move it to Reviewed."
    });
  }

  return activeCompany ? (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--color-text-global)]">Receipts</h1>
        <Button onClick={() => inputRef.current?.click()}>Upload receipts</Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) handleFileSelected(file);
          }}
        />
      </div>

      <Card className="mb-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFileSelected(file);
          }}
          className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed py-10 text-center transition-colors ${
            isDragOver ? "border-[var(--color-ui-primary)]" : "border-[var(--color-divider-tertiary)]"
          }`}
        >
          <p className="text-sm text-[var(--color-text-primary)]">Drag and drop a receipt anywhere here, or</p>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Upload from this device
          </Button>
          <p className="text-xs text-[var(--color-icon-secondary)]">Supported formats: PDF, PNG, JPEG</p>
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex gap-1">
          <button
            type="button"
            onClick={() => setTab("review")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "review" ? "bg-[var(--color-action-passive-subtle-active)] text-[var(--color-text-global)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]"
            }`}
          >
            For review {forReview.length > 0 ? `(${forReview.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setTab("reviewed")}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "reviewed" ? "bg-[var(--color-action-passive-subtle-active)] text-[var(--color-text-global)]" : "text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]"
            }`}
          >
            Reviewed {reviewed.length > 0 ? `(${reviewed.length})` : ""}
          </button>
        </div>

        {!hydrated ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-base font-semibold text-[var(--color-text-global)]">
              {tab === "review" ? "Add new receipts to get started" : "No reviewed receipts yet"}
            </p>
          </div>
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Receipt</Table.HeaderCell>
                <Table.HeaderCell>Vendor</Table.HeaderCell>
                <Table.HeaderCell>Category</Table.HeaderCell>
                <Table.HeaderCell align="right">Amount</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {visible.map((receipt) => (
                <Table.Row key={receipt.id}>
                  <Table.Cell>
                    <p className="text-[var(--color-text-global)]">{receipt.fileName}</p>
                    <p className="text-xs text-[var(--color-icon-secondary)]">
                      {formatBytes(receipt.fileSizeBytes)} · {new Date(receipt.uploadedAt).toLocaleDateString()}
                    </p>
                  </Table.Cell>
                  <Table.Cell className="w-44">
                    <Select value={receipt.vendorId ?? ""} onChange={(v) => update(receipt.id, { vendorId: v || undefined })} options={vendorOptions} placeholder="Select vendor" allowCustomValue={false} optionSize="sm" />
                  </Table.Cell>
                  <Table.Cell className="w-44">
                    <Select value={receipt.categoryAccountId ?? ""} onChange={(v) => update(receipt.id, { categoryAccountId: v || undefined })} options={categoryOptions} placeholder="Select category" allowCustomValue={false} optionSize="sm" />
                  </Table.Cell>
                  <Table.Cell align="right" className="w-32">
                    <NumberField currency placeholder="0.00" value={receipt.amount != null ? String(receipt.amount) : ""} onChange={(e) => update(receipt.id, { amount: Number(e.target.value) || undefined })} size="sm" />
                  </Table.Cell>
                  <Table.Cell align="right">
                    <Button variant="destructive" size="sm" onClick={() => remove(receipt.id)}>
                      Delete
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </>
  ) : (
    <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
  );
}
