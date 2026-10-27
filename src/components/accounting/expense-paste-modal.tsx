"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClipboardEvent, DragEvent } from "react";

export type PastedLine = { categoryAccountId: string; description: string; amount: string };

type PasteRow = { category: string; description: string; amount: string };
type Match = { kind: "exact" | "partial" | "none"; accountId: string; accountName: string };

type ExpensePasteModalProps = {
  open: boolean;
  accounts: { id: string; name: string }[];
  onClose: () => void;
  onApply: (lines: PastedLine[]) => void;
  onExportList: () => void;
};

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

const words = (value: string) => norm(value).split(/[^a-z0-9]+/).filter(Boolean);

// Exact (green): same name ignoring case/spacing. Partial (yellow): the typed
// words all appear as whole words in an account name (or the reverse), so
// "Office" finds "Office Expenses" but not "Officer Wages"; plain substring
// containment is only a last resort. The shortest candidate wins. None (red):
// nothing close.
export function matchCategory(text: string, accounts: { id: string; name: string }[]): Match {
  const key = norm(text);
  if (!key) return { kind: "none", accountId: "", accountName: "" };
  const exact = accounts.find((a) => norm(a.name) === key);
  if (exact) return { kind: "exact", accountId: exact.id, accountName: exact.name };
  const keyWords = words(text);
  const byLength = (a: { name: string }, b: { name: string }) => a.name.length - b.name.length;
  const wholeWord = accounts
    .filter((a) => {
      const nameWords = words(a.name);
      return keyWords.every((w) => nameWords.includes(w)) || nameWords.every((w) => keyWords.includes(w));
    })
    .sort(byLength)[0];
  const candidate = wholeWord ?? accounts.filter((a) => norm(a.name).includes(key) || key.includes(norm(a.name))).sort(byLength)[0];
  return candidate ? { kind: "partial", accountId: candidate.id, accountName: candidate.name } : { kind: "none", accountId: "", accountName: "" };
}

export function parsePastedRows(text: string): PasteRow[] {
  return text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const [category = "", description = "", amount = ""] = row.split(row.includes("\t") ? "\t" : ",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
      return { category, description, amount: amount.replace(/[$,]/g, "") };
    });
}

const TONE: Record<Match["kind"], string> = {
  exact: "bg-[#c9f5e0] text-[#173d2d]",
  partial: "bg-[#f3ee2e] text-[#3d3a00]",
  none: "bg-[#f8a69b] text-[#4a1710]"
};

// RightTool's "Paste Into Category Details": paste (or drop) rows from a
// spreadsheet, see how each category lines up with the chart of accounts
// (green = exact, yellow = close match, red = no match), fix cells in place,
// then add the lines to the expense.
export function ExpensePasteModal({ open, accounts, onClose, onApply, onExportList }: ExpensePasteModalProps) {
  const [rows, setRows] = useState<PasteRow[]>([]);

  useEffect(() => {
    if (open) setRows([]);
  }, [open]);

  const matches = useMemo(() => rows.map((row) => matchCategory(row.category, accounts)), [rows, accounts]);
  if (!open) return null;

  const load = (text: string) => setRows(parsePastedRows(text));
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    load(event.clipboardData.getData("text"));
  };
  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) load(await file.text());
  };
  const setCell = (index: number, patch: Partial<PasteRow>) => setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onDragOver={(event) => event.preventDefault()} onDrop={onDrop}>
      <div role="dialog" aria-modal="true" aria-label="Paste Into Category Details" className="flex max-h-[90vh] w-full max-w-[1100px] flex-col bg-[var(--color-container-background-primary)] p-5 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-global)]">Paste Into Category Details</h2>
            <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-[var(--color-text-global)]">
              <span className="flex items-center gap-2"><span className="h-6 w-6 bg-[#9ef0c8]" />Match</span>
              <span className="flex items-center gap-2"><span className="h-6 w-6 bg-[#e8e820]" />No Exact Match</span>
              <span className="flex items-center gap-2"><span className="h-6 w-6 bg-[#f48f84]" />No Match</span>
              <label className="flex items-center gap-2 font-semibold">
                Paste or Drop CSV:
                <input
                  type="text"
                  autoFocus
                  onPaste={onPaste}
                  aria-label="Paste or drop CSV"
                  className="h-9 w-[210px] border-2 border-[#2ca01c] px-2 text-sm font-normal outline-none"
                />
              </label>
            </div>
          </div>
          <button type="button" onClick={onExportList} className="text-sm font-semibold text-[var(--color-negative)] hover:underline">
            Export All List Data
          </button>
        </div>

        <div className="mt-4 min-h-[220px] flex-1 overflow-auto border-t border-[var(--color-divider-tertiary)] pt-4">
          <table className="mx-auto w-full max-w-[640px] table-fixed border-collapse text-sm">
            <thead>
              <tr className="text-left text-sm font-semibold uppercase text-[var(--color-text-global)]">
                <th className="border border-[var(--color-text-global)] p-3">Category</th>
                <th className="border border-[var(--color-text-global)] p-3">Description</th>
                <th className="border border-[var(--color-text-global)] p-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className={`border border-[var(--color-text-global)] p-0 ${TONE[matches[index].kind]}`}>
                    <input
                      value={row.category}
                      onChange={(event) => setCell(index, { category: event.target.value })}
                      title={matches[index].kind === "partial" ? `Will use "${matches[index].accountName}"` : matches[index].kind === "none" ? "No matching account -- the line will need a category" : undefined}
                      aria-label={`Row ${index + 1} category`}
                      className="w-full bg-transparent p-3 outline-none"
                    />
                    {matches[index].kind === "partial" ? <span className="block px-3 pb-2 text-xs">→ {matches[index].accountName}</span> : null}
                  </td>
                  <td className="border border-[var(--color-text-global)] p-0">
                    <input value={row.description} onChange={(event) => setCell(index, { description: event.target.value })} aria-label={`Row ${index + 1} description`} className="w-full bg-transparent p-3 outline-none" />
                  </td>
                  <td className="border border-[var(--color-text-global)] p-0">
                    <input value={row.amount} onChange={(event) => setCell(index, { amount: event.target.value })} aria-label={`Row ${index + 1} amount`} className="w-full bg-transparent p-3 outline-none" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="mt-3 text-center text-sm text-[var(--color-icon-secondary)]">Paste rows of Category, Description, Amount, or drop a CSV file here.</p> : null}
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() => {
              onApply(rows.map((row, index) => ({ categoryAccountId: matches[index].accountId, description: row.description, amount: row.amount })));
              onClose();
            }}
            className="bg-[#2ca01c] px-4 py-2 text-lg text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Paste Into QuickBooks
          </button>
          <button type="button" onClick={onClose} className="bg-[#a31515] px-4 py-2 text-lg text-white hover:opacity-90">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
