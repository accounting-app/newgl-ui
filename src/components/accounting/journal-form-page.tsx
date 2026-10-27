"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Copy, GripVertical, Trash2 } from "lucide-react";
import { AttachmentsField } from "@/components/accounting/attachments-field";
import { FullScreenFormShell, RT_TOOLBAR_LINK, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { Button } from "@/components/ui/button";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFormAttachments } from "@/lib/hooks/use-form-attachments";
import { useVendors } from "@/lib/hooks/use-vendors";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

type Line = { id: string; accountId: string; debit: string; credit: string; description: string; name: string };

let lineCounter = 0;
const blankLine = (): Line => {
  lineCounter += 1;
  return { id: `journal-line-${lineCounter}`, accountId: "", debit: "", credit: "", description: "", name: "" };
};
const startingLines = () => Array.from({ length: 8 }, blankLine);

const NEXT_KEY = "newgl:journal-next:v1";
const COPY_KEY = "newgl:journal-copy:v1";
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const PLAIN_BUTTON = "rounded-md border border-[var(--color-button-border)] px-3 py-1.5 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const RT_BUTTON = "rounded-md border border-[var(--color-negative)] px-3 py-1.5 text-sm text-[var(--color-negative)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const RT_LINK = "text-left text-base font-medium text-[var(--color-negative)] hover:underline disabled:cursor-not-allowed disabled:opacity-50";
const CELL = "border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-2";
const CELL_INPUT = `${INPUT_BASE_CLASSES} h-9 rounded px-3 text-sm`;

const cents = (value: string) => Math.round((Number(value) || 0) * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

// QBO's full-screen Journal Entry (/journal?rtAccountId=...&rt=close).
// Save posts a real journal entry; debits must equal credits. "Save and
// Reverse" also posts the mirror-image entry on a date you choose.
export function JournalFormPage() {
  const router = useRouter();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: customers } = useCustomers();
  const { items: vendors } = useVendors();
  const attachments = useFormAttachments();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [number, setNumber] = useState("1");
  const [lines, setLines] = useState<Line[]>(startingLines);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseDate, setReverseDate] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(NEXT_KEY));
      if (Number.isInteger(stored) && stored > 0) setNumber(String(stored));
      // "Copy" in another tab leaves its lines here; take them once.
      if (new URLSearchParams(window.location.search).get("copy") === "1") {
        const draft = JSON.parse(window.localStorage.getItem(COPY_KEY) ?? "null");
        window.localStorage.removeItem(COPY_KEY);
        if (draft) {
          setMemo(draft.memo ?? "");
          const next = (draft.lines as Omit<Line, "id">[]).map((l) => ({ ...blankLine(), ...l }));
          while (next.length < 8) next.push(blankLine());
          setLines(next);
        }
      }
    } catch {
      // storage unavailable: defaults
    }
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const accountOptions = useMemo(() => accounts.filter((a) => a.status === "ACTIVE").sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name, rightLabel: ACCOUNT_CATEGORY_LABELS[a.category] })), [accounts]);
  const nameOptions = useMemo(() => [...customers.map((c) => ({ value: c.name, label: c.name, rightLabel: "Customer" })), ...vendors.map((v) => ({ value: v.name, label: v.name, rightLabel: "Vendor" }))].sort((a, b) => a.label.localeCompare(b.label)), [customers, vendors]);
  const debitCents = lines.reduce((sum, l) => sum + cents(l.debit), 0);
  const creditCents = lines.reduce((sum, l) => sum + cents(l.credit), 0);

  const closePage = () => leaveFormPage(router);
  const updateLine = (id: string, patch: Partial<Line>) => setLines((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  function resetForm(nextNumber?: string) {
    setLines(startingLines());
    setMemo("");
    attachments.reset();
    setError(null);
    if (nextNumber) setNumber(nextNumber);
  }

  async function save(after: "stay" | "close", reverseOn?: string) {
    setMenuOpen(false);
    if (!date) return setError("Enter the journal date.");
    const used = lines.filter((l) => l.accountId || cents(l.debit) > 0 || cents(l.credit) > 0);
    if (used.length < 2) return setError("A journal entry needs at least two lines.");
    if (used.some((l) => !l.accountId)) return setError("Every line with an amount needs an account.");
    if (used.some((l) => cents(l.debit) > 0 && cents(l.credit) > 0)) return setError("A line can have a debit or a credit, not both.");
    if (used.some((l) => cents(l.debit) <= 0 && cents(l.credit) <= 0)) return setError("Every line needs a debit or a credit amount.");
    if (debitCents !== creditCents) return setError(`Debits and credits must be equal (difference ${money(Math.abs(debitCents - creditCents) / 100)}).`);
    const names = [...new Set(used.map((l) => l.name).filter(Boolean))];
    const postings = used.map((l) => (cents(l.debit) > 0 ? { accountId: l.accountId, type: "DEBIT" as const, amount: cents(l.debit) / 100 } : { accountId: l.accountId, type: "CREDIT" as const, amount: cents(l.credit) / 100 }));
    const label = used.length > 2 ? "Split" : accounts.find((a) => a.id === used[0].accountId)?.name ?? "";
    setSaving(true);
    setError(null);
    try {
      const created = await services.transactionService.createTransaction({
        type: "JOURNAL_ENTRY",
        transactionDate: date,
        referenceNumber: number,
        memo: memo.trim() || undefined,
        payee: names.length === 1 ? names[0] : undefined,
        accountLabel: label,
        sourceAccountId: used[0].accountId,
        postings
      });
      await services.transactionService.postTransaction(created.id);
      await attachments.linkTo(created.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      if (reverseOn) {
        const reversal = await services.transactionService.createTransaction({
          type: "JOURNAL_ENTRY",
          transactionDate: reverseOn,
          referenceNumber: `${number}-R`,
          memo: `Reversal of journal entry ${number}`,
          payee: names.length === 1 ? names[0] : undefined,
          accountLabel: label,
          sourceAccountId: used[0].accountId,
          postings: postings.map((p) => ({ ...p, type: p.type === "DEBIT" ? ("CREDIT" as const) : ("DEBIT" as const) }))
        });
        await services.transactionService.postTransaction(reversal.id);
      }
      const following = String((Number(number) || 0) + 1);
      try {
        window.localStorage.setItem(NEXT_KEY, following);
      } catch {
        // not persisted
      }
      toast({ variant: "success", title: reverseOn ? "Journal entry saved and reversed" : "Journal entry saved" });
      if (after === "close") closePage();
      else {
        resetForm(following);
        services.accountService.listAccounts().then(setAccounts).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this journal entry.");
    } finally {
      setSaving(false);
    }
  }

  function openReverse() {
    const base = new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00`);
    setReverseDate(new Date(base.getFullYear(), base.getMonth() + 1, 1).toLocaleDateString("en-CA"));
    setReverseOpen(true);
  }
  const clearZeroLines = () => setLines((current) => { const kept = current.filter((l) => cents(l.debit) > 0 || cents(l.credit) > 0 || l.accountId || l.description); return kept.length >= 2 ? kept : [...kept, ...Array.from({ length: 2 - kept.length }, blankLine)]; });
  function exportCsv() {
    const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";
    const rows = [["Account", "Debits", "Credits", "Description", "Name"], ...lines.filter((l) => l.accountId || l.debit || l.credit).map((l) => [name(l.accountId), l.debit, l.credit, l.description, l.name])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(escape).join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "journal-lines.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  // Paste Excel: Account, Debits, Credits, Description, Name (tab or comma separated).
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split(/\r?\n/).filter((r) => r.trim()).map((r) => r.split(r.includes("\t") ? "\t" : ","));
      if (rows.length === 0) return toast({ variant: "info", title: "The clipboard is empty" });
      const num = (v = "") => v.replace(/[$,]/g, "").trim();
      const next = rows.map(([account = "", debit = "", credit = "", description = "", name = ""]) => ({
        ...blankLine(),
        accountId: accounts.find((a) => a.name.toLowerCase() === account.trim().toLowerCase())?.id ?? "",
        debit: num(debit),
        credit: num(credit),
        description: description.trim(),
        name: name.trim()
      }));
      while (next.length < 8) next.push(blankLine());
      setLines(next);
    } catch {
      toast({ variant: "error", title: "Couldn't read the clipboard", description: "Allow clipboard access and try again." });
    }
  }
  function copyEntry() {
    try {
      window.localStorage.setItem(COPY_KEY, JSON.stringify({ memo, lines: lines.map(({ accountId, debit, credit, description, name }) => ({ accountId, debit, credit, description, name })) }));
    } catch {
      return toast({ variant: "error", title: "Could not copy this entry" });
    }
    window.open("/journal?rt=close&copy=1", "_blank");
  }

  const toolbar = (
    <>
      <button type="button" disabled aria-label="Sort lines" title="Sorting lines isn't available yet" className="flex h-9 items-center px-2 text-[var(--color-negative)] disabled:opacity-60"><span aria-hidden="true" className="text-lg leading-none">↑↓</span></button>
      <button type="button" onClick={exportCsv} className={RT_TOOLBAR_LINK}>Export CSV</button>
      <button type="button" onClick={() => void pasteFromClipboard()} className={RT_TOOLBAR_LINK}>Paste Excel</button>
      <button type="button" onClick={copyEntry} className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"><Copy className="h-5 w-5" aria-hidden="true" />Copy</button>
    </>
  );

  const footer = (
    <>
      <div className="flex items-center gap-3">
        <Button variant="secondary" className="!rounded-md" onClick={closePage}>Cancel</Button>
        <Button variant="secondary" className="!rounded-md" onClick={() => resetForm()}>Clear</Button>
      </div>
      <div className="flex items-center gap-6 text-base text-[var(--color-text-global)]">
        <button type="button" onClick={() => window.print()} className="hover:underline">Print</button>
        <button type="button" disabled title="Recurring transactions aren't available yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">Make recurring</button>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" className="!rounded-md" disabled={saving} onClick={() => void save("stay")}>Save</Button>
        <div ref={menuRef} className="relative inline-flex">
          <Button className="!rounded-l-md !rounded-r-none" disabled={saving} onClick={() => void save("stay")}>{saving ? "Saving..." : "Save and new"}</Button>
          <Button className="!rounded-l-none !rounded-r-md border-l border-l-white/30 !min-w-0 px-2" aria-label="More save options" disabled={saving} onClick={() => setMenuOpen((v) => !v)}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          {menuOpen ? (
            <div className="absolute bottom-full right-0 mb-1 w-44 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
              <button type="button" onClick={() => void save("close")} className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Save and close</button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <FullScreenFormShell title={`Journal Entry #${number}`} onClose={closePage} toolbar={toolbar} onSettings={() => toast({ variant: "info", title: "Choose what you use isn't available yet" })} settingsLabel="Choose what you use" footer={footer}>
      <div className="px-6 pb-8 pt-5">
        <div className="flex flex-wrap items-end gap-4 pb-6">
          <div>
            <label className={LABEL} htmlFor="journal-date">Journal date</label>
            <InputField id="journal-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[200px]" />
          </div>
          <div>
            <label className={LABEL} htmlFor="journal-no">Journal no.</label>
            <InputField id="journal-no" value={number} onChange={(event) => setNumber(event.target.value)} className="w-[260px]" />
          </div>
        </div>

        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-6" />
            <col className="w-10" />
            <col className="w-[26%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col />
            <col className="w-[18%]" />
            <col className="w-10" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
              <th aria-hidden="true" />
              <th className="px-2 py-3 text-center">#</th>
              <th className="px-2 py-3">Account</th>
              <th className={`${CELL} py-3 text-right`}>Debits</th>
              <th className={`${CELL} py-3 text-right`}>Credits</th>
              <th className={`${CELL} py-3`}>Description</th>
              <th className={`${CELL} py-3`}>Name</th>
              <th colSpan={2} />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id} className="border-b border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                <td className="text-[var(--color-icon-muted)]"><GripVertical className="h-4 w-4" aria-hidden="true" /></td>
                <td className="px-2 py-2 text-center">{index + 1}</td>
                <td className="px-2 py-2"><Select value={line.accountId} onChange={(v) => updateLine(line.id, { accountId: v })} options={accountOptions} placeholder="" allowCustomValue={false} /></td>
                <td className={CELL}><input type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(line.id, { debit: event.target.value, credit: event.target.value ? "" : line.credit })} aria-label={`Line ${index + 1} debit`} className={`${CELL_INPUT} text-right`} /></td>
                <td className={CELL}><input type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(line.id, { credit: event.target.value, debit: event.target.value ? "" : line.debit })} aria-label={`Line ${index + 1} credit`} className={`${CELL_INPUT} text-right`} /></td>
                <td className={CELL}><input value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} aria-label={`Line ${index + 1} description`} className={CELL_INPUT} /></td>
                <td className={CELL}><Select value={line.name} onChange={(v) => updateLine(line.id, { name: v })} options={nameOptions} placeholder="" allowCustomValue={false} /></td>
                <td className="px-1 text-center"><button type="button" aria-label="Copy line" onClick={() => setLines((current) => { const i = current.findIndex((l) => l.id === line.id); return [...current.slice(0, i + 1), { ...line, id: blankLine().id }, ...current.slice(i + 1)]; })} className="text-[var(--color-text-global)]"><Copy className="h-5 w-5" aria-hidden="true" /></button></td>
                <td className="px-1 text-center"><button type="button" aria-label="Delete line" onClick={() => setLines((current) => (current.length > 1 ? current.filter((l) => l.id !== line.id) : [blankLine()]))} className="text-[var(--color-text-global)] hover:text-[var(--color-negative)]"><Trash2 className="h-5 w-5" aria-hidden="true" /></button></td>
              </tr>
            ))}
            <tr className="border-b border-[var(--color-divider-tertiary)] font-semibold text-[var(--color-text-global)]">
              <td colSpan={3} className="px-2 py-3 text-right">Total</td>
              <td className="px-2 py-3 text-right">{money(debitCents / 100)}</td>
              <td className="px-2 py-3 text-right">{money(creditCents / 100)}</td>
              <td colSpan={4} />
            </tr>
          </tbody>
        </table>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={PLAIN_BUTTON} onClick={() => setLines((current) => [...current, blankLine(), blankLine()])}>Add lines</button>
          <button type="button" className={PLAIN_BUTTON} onClick={() => setLines(startingLines())}>Clear all lines</button>
          <button type="button" className={RT_BUTTON} onClick={clearZeroLines}>Clear 0 Value Lines</button>
          <button type="button" className={`${RT_LINK} ml-2 !text-sm font-semibold`} disabled={saving} onClick={openReverse}>Save and Reverse</button>
        </div>

        <div className="mt-10 flex flex-wrap gap-8">
          <div className="w-[520px] max-w-full">
            <label className={LABEL} htmlFor="journal-memo">Memo</label>
            <textarea id="journal-memo" value={memo} onChange={(event) => setMemo(event.target.value)} className={`${INPUT_BASE_CLASSES} h-40 resize-y rounded px-3 py-2 text-sm`} />
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
              <button type="button" className={RT_LINK} onClick={() => { const names = [...new Set(lines.map((l) => l.name).filter(Boolean))]; if (names.length) setMemo((m) => (m ? `${m} ${names.join(", ")}` : names.join(", "))); }}>Copy Names To Memo</button>
              <button type="button" className={`${RT_LINK} text-right`} disabled title="Tags aren't available yet">Copy Tags To Memo</button>
              <button type="button" className={RT_LINK} onClick={() => setMemo(lines.map((l) => l.description.trim()).filter(Boolean).join("; "))}>Copy Descriptions To Memo</button>
              <span />
              <button type="button" className={RT_LINK} onClick={() => setLines((current) => current.map((l) => ({ ...l, description: memo })))}>Copy Memo to Descriptions</button>
            </div>
          </div>
          <div className="w-[520px] max-w-full">
            <AttachmentsField attachments={attachments} formLabel="Journal Entry" />
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error}</p> : null}
        <p className="mt-6 text-center"><a href="https://www.intuit.com/privacy/" target="_blank" rel="noreferrer" className="text-[var(--color-link-action)] hover:underline">Privacy</a></p>
      </div>

      <Modal open={reverseOpen} onClose={() => setReverseOpen(false)} title="Save and Reverse" size="sm">
        <p className="mb-3 text-sm">Posts this entry, then a second entry with every debit and credit swapped on the date below.</p>
        <label className={LABEL} htmlFor="journal-reverse-date">Reversal date</label>
        <InputField id="journal-reverse-date" type="date" value={reverseDate} onChange={(event) => setReverseDate(event.target.value)} />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setReverseOpen(false)}>Cancel</Button>
          <Button disabled={!reverseDate || saving} onClick={() => { setReverseOpen(false); void save("stay", reverseDate); }}>Save and Reverse</Button>
        </div>
      </Modal>
    </FullScreenFormShell>
  );
}
