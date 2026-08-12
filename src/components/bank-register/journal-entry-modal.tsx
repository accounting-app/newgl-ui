"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { parseAmount, splitCsvLine } from "@/modules/accounting/domain/parse-csv";

export type JournalEntryLine = {
  clientId: string;
  accountId: string;
  memo: string;
  debit: string;
  credit: string;
};

type JournalEntryModalProps = {
  open: boolean;
  accountOptions: SelectFieldOption[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: {
    date: string;
    referenceNumber: string;
    payee: string;
    memo: string;
    lines: { accountId: string; type: "DEBIT" | "CREDIT"; amount: number }[];
  }) => Promise<void>;
};

let lineIdCounter = 0;
function newLine(): JournalEntryLine {
  lineIdCounter += 1;
  return { clientId: `je-line-${lineIdCounter}`, accountId: "", memo: "", debit: "", credit: "" };
}

// Excel copy/paste is tab-separated; plain CSV falls back to comma-separated
// (reusing the same quoted-field splitter the CSV import wizard already has).
function splitPastedRows(text: string): string[][] {
  const rows = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");
  const useTab = rows.length > 0 && rows[0].includes("\t");
  return rows.map((row) => (useTab ? row.split("\t").map((cell) => cell.trim()) : splitCsvLine(row)));
}

const KNOWN_HEADERS: Record<string, "account" | "debit" | "credit" | "memo" | "date" | "payee" | "ref"> = {
  account: "account",
  debit: "debit",
  credit: "credit",
  memo: "memo",
  description: "memo",
  date: "date",
  payee: "payee",
  ref: "ref",
  "ref#": "ref",
  "reference": "ref",
  "reference number": "ref"
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function JournalEntryModal({ open, accountOptions, isSaving, onClose, onSave }: JournalEntryModalProps) {
  const [date, setDate] = useState(todayIso);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [payee, setPayee] = useState("");
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<JournalEntryLine[]>(() => [newLine(), newLine()]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const accountLabelById = useMemo(() => new Map(accountOptions.map((o) => [o.value, o.label])), [accountOptions]);
  const accountIdByLabel = useMemo(
    () => new Map(accountOptions.map((o) => [o.label.toLowerCase(), o.value])),
    [accountOptions]
  );

  const totalDebit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
  const difference = Math.round((totalDebit - totalCredit) * 100) / 100;
  const nonZeroLines = lines.filter((line) => (Number(line.debit) || 0) > 0 || (Number(line.credit) || 0) > 0);
  const linesReady = nonZeroLines.length >= 2 && nonZeroLines.every((line) => line.accountId);
  const balanced = difference === 0 && totalDebit > 0;
  const canSave = date !== "" && linesReady && balanced && !isSaving;

  function resetAndClose() {
    setDate(todayIso());
    setReferenceNumber("");
    setPayee("");
    setMemo("");
    setLines([newLine(), newLine()]);
    setPasteOpen(false);
    setPasteText("");
    setSaveError(null);
    onClose();
  }

  function updateLine(clientId: string, patch: Partial<JournalEntryLine>) {
    setLines((current) => current.map((line) => (line.clientId === clientId ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((current) => [...current, newLine()]);
  }

  function removeLine(clientId: string) {
    setLines((current) => (current.length <= 2 ? current : current.filter((line) => line.clientId !== clientId)));
  }

  function applyPaste() {
    const rows = splitPastedRows(pasteText);
    if (rows.length === 0) return;

    const headerCandidate = rows[0].map((cell) => cell.trim().toLowerCase());
    const headerMap = new Map<number, string>();
    headerCandidate.forEach((cell, index) => {
      if (KNOWN_HEADERS[cell]) headerMap.set(index, KNOWN_HEADERS[cell]);
    });
    const hasHeader = headerMap.size > 0;
    const dataRows = hasHeader ? rows.slice(1) : rows;

    // No recognized header: fall back to a fixed Account, Debit, Credit layout.
    const columnFor = (index: number): string | undefined =>
      hasHeader ? headerMap.get(index) : (["account", "debit", "credit"] as const)[index];

    let pastedDate = "";
    let pastedRef = "";
    let pastedPayee = "";
    const parsedLines: JournalEntryLine[] = [];

    dataRows.forEach((row) => {
      const line = newLine();
      row.forEach((cell, index) => {
        const column = columnFor(index);
        const value = cell.trim();
        if (!value) return;
        if (column === "account") {
          line.accountId = accountIdByLabel.get(value.toLowerCase()) ?? "";
          if (!line.accountId) line.memo = line.memo || `Unmatched account: ${value}`;
        } else if (column === "debit") {
          const parsed = parseAmount(value);
          if (parsed !== null && parsed !== 0) line.debit = String(Math.abs(parsed));
        } else if (column === "credit") {
          const parsed = parseAmount(value);
          if (parsed !== null && parsed !== 0) line.credit = String(Math.abs(parsed));
        } else if (column === "memo") {
          line.memo = value;
        } else if (column === "date" && !pastedDate) {
          pastedDate = value;
        } else if (column === "ref" && !pastedRef) {
          pastedRef = value;
        } else if (column === "payee" && !pastedPayee) {
          pastedPayee = value;
        }
      });
      if (line.accountId || line.debit || line.credit || line.memo) parsedLines.push(line);
    });

    if (parsedLines.length === 0) return;
    setLines(parsedLines.length >= 2 ? parsedLines : [...parsedLines, newLine()]);
    if (pastedDate) setDate(pastedDate);
    if (pastedRef) setReferenceNumber(pastedRef);
    if (pastedPayee) setPayee(pastedPayee);
    setPasteText("");
    setPasteOpen(false);
  }

  async function handleSave() {
    if (!canSave) return;
    setSaveError(null);
    const postingLines = nonZeroLines.map((line) => {
      const debit = Number(line.debit) || 0;
      return {
        accountId: line.accountId,
        type: (debit > 0 ? "DEBIT" : "CREDIT") as "DEBIT" | "CREDIT",
        amount: debit > 0 ? debit : Number(line.credit) || 0
      };
    });
    try {
      await onSave({ date, referenceNumber, payee, memo, lines: postingLines });
      resetAndClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save journal entry.");
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-container-background-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-6 py-4">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">New Journal Entry</p>
        <button
          type="button"
          aria-label="Close journal entry"
          className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-primary)]"
          onClick={resetAndClose}
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
              Date
              <InputField type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
              Ref No
              <InputField type="text" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
              Payee
              <InputField type="text" value={payee} onChange={(e) => setPayee(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
              Memo
              <InputField type="text" value={memo} onChange={(e) => setMemo(e.target.value)} />
            </label>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Lines</h2>
            <Button type="button" variant="secondary" onClick={() => setPasteOpen((open) => !open)}>
              {pasteOpen ? "Cancel paste" : "Paste from Excel/CSV"}
            </Button>
          </div>

          {pasteOpen ? (
            <div className="flex flex-col gap-2 rounded border border-[var(--color-divider-tertiary)] p-3">
              <p className="text-xs text-[var(--color-icon-secondary)]">
                Paste rows with Account, Debit, Credit columns (a header row is optional but recommended so
                columns don&apos;t need to be in that exact order).
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={5}
                placeholder={"Account\tDebit\tCredit\nOffice Supplies\t60.00\t\nSoftware & Apps\t40.00\t\nCash\t\t100.00"}
                className="rounded border border-[var(--color-input-border-primary)] bg-[var(--color-container-background-primary)] px-3 py-2 font-mono text-xs text-[var(--color-text-primary)]"
              />
              <div>
                <Button type="button" onClick={applyPaste} disabled={pasteText.trim() === ""}>
                  Apply
                </Button>
              </div>
            </div>
          ) : null}

          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-divider-tertiary)] text-left text-xs text-[var(--color-icon-secondary)]">
                <th className="py-1 pr-3 font-medium">Account</th>
                <th className="py-1 pr-3 font-medium">Memo</th>
                <th className="py-1 pr-3 text-right font-medium">Debit</th>
                <th className="py-1 pr-3 text-right font-medium">Credit</th>
                <th className="py-1"> </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.clientId} className="border-b border-[var(--color-container-background-secondary)]">
                  <td className="py-1.5 pr-3">
                    <SelectField
                      value={line.accountId}
                      onChange={(value) => updateLine(line.clientId, { accountId: value })}
                      options={accountOptions}
                      placeholder="Select account"
                      allowCustomValue={false}
                      optionSize="sm"
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <InputField
                      type="text"
                      value={line.memo}
                      onChange={(e) => updateLine(line.clientId, { memo: e.target.value })}
                      className="w-full"
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <InputField
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debit}
                      onChange={(e) => updateLine(line.clientId, { debit: e.target.value, credit: "" })}
                      className="w-28 text-right"
                    />
                  </td>
                  <td className="py-1.5 pr-3">
                    <InputField
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.credit}
                      onChange={(e) => updateLine(line.clientId, { credit: e.target.value, debit: "" })}
                      className="w-28 text-right"
                    />
                  </td>
                  <td className="py-1.5 text-center">
                    <button
                      type="button"
                      aria-label="Remove line"
                      className="text-[var(--color-icon-secondary)] hover:text-red-600 disabled:opacity-30"
                      onClick={() => removeLine(line.clientId)}
                      disabled={lines.length <= 2}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-[var(--color-text-primary)]">
                <td className="py-2 pr-3" colSpan={2}>
                  Totals
                </td>
                <td className="py-2 pr-3 text-right">{totalDebit.toFixed(2)}</td>
                <td className="py-2 pr-3 text-right">{totalCredit.toFixed(2)}</td>
                <td />
              </tr>
            </tfoot>
          </table>

          <div>
            <Button type="button" variant="secondary" onClick={addLine}>
              Add line
            </Button>
          </div>

          <div
            className={`rounded border px-3 py-2 text-sm ${
              balanced
                ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
                : "border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] text-[var(--color-text-primary)]"
            }`}
          >
            {balanced
              ? "Balanced — debits equal credits."
              : totalDebit === 0 && totalCredit === 0
                ? "Enter debit and credit amounts that net to zero."
                : `Out of balance by ${Math.abs(difference).toFixed(2)} (debits ${totalDebit.toFixed(2)}, credits ${totalCredit.toFixed(2)}).`}
          </div>

          {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-[var(--color-divider-tertiary)] px-6 py-4">
        <Button variant="secondary" onClick={resetAndClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSave}>
          {isSaving ? "Saving…" : "Save journal entry"}
        </Button>
      </div>
    </div>
  );
}
