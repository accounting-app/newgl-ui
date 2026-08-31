"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InputField } from "@/components/ui/input-field";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { parseAmount, splitPastedRows } from "@/modules/accounting/domain/parse-csv";
import type { Account } from "@/modules/accounting/domain/models";

// Generic multi-account paste import (PLAINGL_FEATURES_TO_IMPLEMENT.md #18):
// unlike the CSV import wizard (one shared main account for the whole file)
// or Journal Entry (one balanced multi-leg entry), each pasted row here is
// its own independent two-account transaction -- meant for one-time bulk
// loads of historical data from a spreadsheet, not day-to-day bank activity.
type BulkImportRow = {
  clientRowId: string;
  date: string;
  accountId: string;
  offsetAccountId: string;
  amount: string;
  memo: string;
  unmatchedAccount: string | null;
  unmatchedOffsetAccount: string | null;
};

type KnownColumn = "date" | "account" | "offsetAccount" | "amount" | "memo";

const KNOWN_HEADERS: Record<string, KnownColumn> = {
  date: "date",
  account: "account",
  "offset account": "offsetAccount",
  "offset-account": "offsetAccount",
  offsetaccount: "offsetAccount",
  "to account": "offsetAccount",
  amount: "amount",
  memo: "memo",
  description: "memo"
};

const FIXED_COLUMN_ORDER: KnownColumn[] = ["date", "account", "offsetAccount", "amount", "memo"];

let rowIdCounter = 0;
function newRow(): BulkImportRow {
  rowIdCounter += 1;
  return {
    clientRowId: `bulk-row-${rowIdCounter}`,
    date: "",
    accountId: "",
    offsetAccountId: "",
    amount: "",
    memo: "",
    unmatchedAccount: null,
    unmatchedOffsetAccount: null
  };
}

function isRowReady(row: BulkImportRow): boolean {
  return (
    row.date !== "" &&
    row.accountId !== "" &&
    row.offsetAccountId !== "" &&
    row.accountId !== row.offsetAccountId &&
    Number(row.amount) !== 0 &&
    row.amount !== ""
  );
}

export function BulkPasteImport() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [rows, setRows] = useState<BulkImportRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ succeeded: number; failed: number; errors: string[] } | null>(null);

  useEffect(() => {
    getServiceContainer()
      .accountService.listAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const accountOptions = useMemo<SelectFieldOption[]>(
    () =>
      accounts
        .filter((account) => account.status === "ACTIVE")
        .map((account) => ({
          value: account.id,
          label: account.name,
          rightLabel: ACCOUNT_CATEGORY_LABELS[account.category]
        })),
    [accounts]
  );
  const accountLabelById = useMemo(() => new Map(accountOptions.map((o) => [o.value, o.label])), [accountOptions]);
  const accountIdByLabel = useMemo(
    () => new Map(accountOptions.map((o) => [o.label.toLowerCase(), o.value])),
    [accountOptions]
  );

  function updateRow(clientRowId: string, patch: Partial<BulkImportRow>) {
    setRows((current) => current.map((row) => (row.clientRowId === clientRowId ? { ...row, ...patch } : row)));
  }

  function applyPaste() {
    const parsedRows = splitPastedRows(pasteText);
    if (parsedRows.length === 0) return;

    const headerCandidate = parsedRows[0].map((cell) => cell.trim().toLowerCase());
    const headerMap = new Map<number, KnownColumn>();
    headerCandidate.forEach((cell, index) => {
      const known = KNOWN_HEADERS[cell];
      if (known) headerMap.set(index, known);
    });
    const hasHeader = headerMap.size > 0;
    const dataRows = hasHeader ? parsedRows.slice(1) : parsedRows;
    const columnFor = (index: number): KnownColumn | undefined =>
      hasHeader ? headerMap.get(index) : FIXED_COLUMN_ORDER[index];

    const built: BulkImportRow[] = dataRows.map((cells) => {
      const row = newRow();
      cells.forEach((cell, index) => {
        const column = columnFor(index);
        const value = cell.trim();
        if (!value || !column) return;
        if (column === "date") {
          row.date = value;
        } else if (column === "account") {
          const matchId = accountIdByLabel.get(value.toLowerCase());
          if (matchId) row.accountId = matchId;
          else row.unmatchedAccount = value;
        } else if (column === "offsetAccount") {
          const matchId = accountIdByLabel.get(value.toLowerCase());
          if (matchId) row.offsetAccountId = matchId;
          else row.unmatchedOffsetAccount = value;
        } else if (column === "amount") {
          const parsed = parseAmount(value);
          if (parsed !== null) row.amount = String(parsed);
        } else if (column === "memo") {
          row.memo = value;
        }
      });
      return row;
    });

    setRows(built);
    setSelectedRowIds(new Set(built.filter(isRowReady).map((row) => row.clientRowId)));
    setResult(null);
    setPasteText("");
  }

  function handleStartOver() {
    setRows([]);
    setSelectedRowIds(new Set());
    setResult(null);
  }

  function toggleRow(clientRowId: string, checked: boolean) {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (checked) next.add(clientRowId);
      else next.delete(clientRowId);
      return next;
    });
  }

  async function handleSubmit() {
    const submittable = rows.filter((row) => selectedRowIds.has(row.clientRowId) && isRowReady(row));
    if (submittable.length === 0) return;

    setIsSubmitting(true);
    setResult(null);
    const services = getServiceContainer();
    let succeeded = 0;
    const errors: string[] = [];
    const failedRowIds = new Set<string>();

    for (const row of submittable) {
      try {
        const amount = Number(row.amount);
        // Explicit convention (this feature's own, not inherited from any
        // backend rule -- createTransaction just takes DEBIT/CREDIT per
        // posting): a positive Amount debits Account and credits Offset
        // Account; negative reverses it.
        const postings =
          amount > 0
            ? [
                { accountId: row.accountId, type: "DEBIT" as const, amount },
                { accountId: row.offsetAccountId, type: "CREDIT" as const, amount }
              ]
            : [
                { accountId: row.accountId, type: "CREDIT" as const, amount: Math.abs(amount) },
                { accountId: row.offsetAccountId, type: "DEBIT" as const, amount: Math.abs(amount) }
              ];
        const transaction = await services.transactionService.createTransaction({
          type: "JOURNAL_ENTRY",
          transactionDate: row.date,
          memo: row.memo.trim() || undefined,
          postings
        });
        await services.transactionService.postTransaction(transaction.id);
        succeeded += 1;
      } catch (err) {
        const label = accountLabelById.get(row.accountId) ?? row.accountId;
        errors.push(`${row.date} ${label}: ${err instanceof Error ? err.message : "failed"}`);
        failedRowIds.add(row.clientRowId);
      }
    }

    setResult({ succeeded, failed: submittable.length - succeeded, errors });
    // Drop only the rows that were submitted and actually succeeded --
    // failed rows stay in the table (still selected) so they can be fixed
    // and retried without re-pasting everything.
    setRows((current) =>
      current.filter((row) => !selectedRowIds.has(row.clientRowId) || failedRowIds.has(row.clientRowId))
    );
    setSelectedRowIds(new Set(failedRowIds));
    setIsSubmitting(false);
  }

  return (
    <Card
      title="Bulk paste import"
      description="Paste rows with Date, Account, Offset Account, Amount, and Memo columns. Each row becomes its own two-account transaction -- useful for one-time bulk loads of historical data, unlike the CSV import wizard (one shared account per file)."
      className="mb-6"
    >
      <div className="flex flex-col gap-3">
        <Textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={5}
          placeholder={
            "Date\tAccount\tOffset Account\tAmount\tMemo\n2024-01-15\tChecking\tOffice Supplies\t-42.50\tStaples\n2024-01-16\tChecking\tConsulting Income\t1200.00\tInvoice #1"
          }
          className="font-mono text-xs"
        />
        <div>
          <Button type="button" onClick={applyPaste} disabled={pasteText.trim() === ""}>
            Parse rows
          </Button>
        </div>

        {rows.length > 0 ? (
          <>
            <div className="overflow-auto rounded border border-[var(--color-divider-tertiary)]">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-[var(--color-container-background-accent)]">
                  <tr className="border-b border-[var(--color-divider-tertiary)] text-left text-xs text-[var(--color-icon-secondary)]">
                    <th className="px-2 py-2"> </th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Account</th>
                    <th className="px-2 py-2 font-medium">Offset account</th>
                    <th className="px-2 py-2 text-right font-medium">Amount</th>
                    <th className="px-2 py-2 font-medium">Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const ready = isRowReady(row);
                    return (
                      <tr key={row.clientRowId} className="border-b border-[var(--color-container-background-secondary)]">
                        <td className="px-2 py-1.5 align-top">
                          <Checkbox
                            checked={selectedRowIds.has(row.clientRowId)}
                            onChange={(e) => toggleRow(row.clientRowId, e.target.checked)}
                          />
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <InputField
                            type="date"
                            value={row.date}
                            onChange={(e) => updateRow(row.clientRowId, { date: e.target.value })}
                            className="w-full"
                          />
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <SelectField
                            value={row.accountId}
                            onChange={(value) => updateRow(row.clientRowId, { accountId: value, unmatchedAccount: null })}
                            options={accountOptions}
                            placeholder="Select account"
                            allowCustomValue={false}
                            optionSize="sm"
                          />
                          {row.unmatchedAccount ? (
                            <p className="mt-0.5 text-[11px] text-[var(--color-negative)]">Unmatched: {row.unmatchedAccount}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <SelectField
                            value={row.offsetAccountId}
                            onChange={(value) =>
                              updateRow(row.clientRowId, { offsetAccountId: value, unmatchedOffsetAccount: null })
                            }
                            options={accountOptions}
                            placeholder="Select account"
                            allowCustomValue={false}
                            optionSize="sm"
                          />
                          {row.unmatchedOffsetAccount ? (
                            <p className="mt-0.5 text-[11px] text-[var(--color-negative)]">Unmatched: {row.unmatchedOffsetAccount}</p>
                          ) : null}
                          {row.accountId && row.accountId === row.offsetAccountId ? (
                            <p className="mt-0.5 text-[11px] text-[var(--color-negative)]">Must differ from Account.</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <InputField
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) => updateRow(row.clientRowId, { amount: e.target.value })}
                            className="w-28 text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5 align-top">
                          <InputField
                            type="text"
                            value={row.memo}
                            onChange={(e) => updateRow(row.clientRowId, { memo: e.target.value })}
                            className="w-full"
                          />
                          {!ready ? <p className="mt-0.5 text-[11px] text-[var(--color-negative)]">Incomplete.</p> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || rows.filter((row) => selectedRowIds.has(row.clientRowId) && isRowReady(row)).length === 0}
              >
                {isSubmitting
                  ? "Importing…"
                  : `Import ${rows.filter((row) => selectedRowIds.has(row.clientRowId) && isRowReady(row)).length} transaction(s)`}
              </Button>
              <Button type="button" variant="secondary" onClick={handleStartOver} disabled={isSubmitting}>
                Start over
              </Button>
            </div>

            {result ? (
              <div className="text-sm">
                <p className="text-[var(--color-text-primary)]">
                  Imported {result.succeeded} of {result.succeeded + result.failed} transaction
                  {result.succeeded + result.failed === 1 ? "" : "s"}.
                </p>
                {result.errors.length > 0 ? (
                  <p className="mt-1 whitespace-pre-line text-[var(--color-negative)]">{result.errors.join("\n")}</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}
