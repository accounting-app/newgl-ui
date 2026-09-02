"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { ReceiptRecord } from "@/lib/local-store/expenses-bills-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Transaction } from "@/modules/accounting/domain/models";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Phase 1: records that a receipt exists (filename, size, when, and an
// optional link to a real transaction) -- doesn't actually store the file
// yet. Real file storage (Supabase Storage) is Phase 1.5; see the plan
// doc. Recording metadata now means the workflow (upload -> optionally
// link to a transaction) is ready before storage lands.
export function ReceiptsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  useEffect(() => {
    services.transactionService.listTransactions({ status: "POSTED" }).then(setTransactions).catch(() => setTransactions([]));
  }, [services]);
  const transactionOptions = useMemo(
    () => [
      { value: "", label: "Not linked" },
      ...transactions.map((t) => ({ value: t.id, label: `${t.transactionDate} · ${t.payee || t.memo || "Transaction"}` }))
    ],
    [transactions]
  );

  const storageKey = activeCompany ? companyScopedKey(activeCompany.name, "receipts") : null;
  const { items: receipts, hydrated, add, update, remove } = useLocalCollection<ReceiptRecord>(storageKey ?? "newgl:phase1:pending:receipts");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(file: File) {
    add({ id: localId(), fileName: file.name, fileSizeBytes: file.size, uploadedAt: new Date().toISOString() });
    toast({
      variant: "success",
      title: "Receipt recorded",
      description: "File storage isn't connected yet -- this just tracks that the receipt exists."
    });
  }

  function handleDelete(receipt: ReceiptRecord) {
    remove(receipt.id);
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <Card title="Upload a receipt" description="Records that a receipt exists -- the file itself isn't stored yet, so this is metadata only for now." className="mb-6">
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Choose file
        </Button>
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
      </Card>

      <Card title="Receipts">
        {!hydrated ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : receipts.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">No receipts recorded yet.</p>
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>File</Table.HeaderCell>
                <Table.HeaderCell>Uploaded</Table.HeaderCell>
                <Table.HeaderCell>Linked transaction</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {receipts.map((receipt) => (
                <Table.Row key={receipt.id}>
                  <Table.Cell>
                    <p className="text-[var(--color-text-global)]">{receipt.fileName}</p>
                    <p className="text-xs text-[var(--color-icon-secondary)]">{formatBytes(receipt.fileSizeBytes)}</p>
                  </Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">
                    {new Date(receipt.uploadedAt).toLocaleDateString()}
                  </Table.Cell>
                  <Table.Cell className="w-56">
                    <Select
                      value={receipt.linkedTransactionId ?? ""}
                      onChange={(value) => update(receipt.id, { linkedTransactionId: value || undefined })}
                      options={transactionOptions}
                      placeholder="Not linked"
                      allowCustomValue={false}
                      optionSize="sm"
                    />
                  </Table.Cell>
                  <Table.Cell align="right">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(receipt)}>
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
  );
}
