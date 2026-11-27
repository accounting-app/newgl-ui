"use client";

import { CANNOT_SHOW, formDetails, useSavedTransaction } from "@/lib/hooks/use-saved-transaction";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ClipboardPaste, Copy, GripVertical, SquareArrowOutUpRight, Trash2 } from "lucide-react";
import { AttachmentsField } from "@/components/accounting/attachments-field";
import { MoreMenu, useTransactionPrint } from "@/components/accounting/transaction-actions";
import { FullScreenFormShell, RT_TOOLBAR_LINK, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { RecurringIntervalRow, RecurringNameRow, useRecurringTemplate } from "@/components/accounting/recurring-template-fields";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { multiplyLines } from "@/lib/accounting/multiply-lines";
import { nextJournalNumber } from "@/lib/accounting/next-check-number";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFormAttachments } from "@/lib/hooks/use-form-attachments";
import { useVendors } from "@/lib/hooks/use-vendors";
import { advanceRecurring, createRecurring, listRecurring, updateRecurring } from "@/lib/services/recurring-service";
import type { RecurringTemplate } from "@/lib/services/recurring-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

type Line = { id: string; accountId: string; debit: string; credit: string; description: string; name: string };

let lineCounter = 0;
const blankLine = (): Line => {
  lineCounter += 1;
  return { id: `journal-line-${lineCounter}`, accountId: "", debit: "", credit: "", description: "", name: "" };
};
const startingLines = () => Array.from({ length: 8 }, blankLine);

const COPY_KEY = "newgl:journal-copy:v1";
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const PLAIN_BUTTON = "rounded-md border border-[var(--color-button-border)] px-3 py-1.5 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const RT_BUTTON = "rounded-md border border-[var(--color-negative)] px-3 py-1.5 text-sm text-[var(--color-negative)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const RT_LINK = "text-left text-base font-medium text-[var(--color-negative)] hover:underline disabled:cursor-not-allowed disabled:opacity-50";
const CELL = "border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-2";
const CELL_INPUT = `${INPUT_BASE_CLASSES} h-9 rounded px-3 text-sm`;
// QBO shows a line as plain text until it is clicked.
const CELL_TEXT = "block min-h-9 w-full truncate px-3";
const FOOTER_LINK = "text-base font-medium text-[var(--color-text-global)] hover:underline disabled:cursor-not-allowed disabled:opacity-60";

const cents = (value: string) => Math.round((Number(value) || 0) * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

// QBO's full-screen Journal Entry (/journal?rtAccountId=...&rt=close).
// Save posts a real journal entry; debits must equal credits. "Save and
// Reverse" also posts the mirror-image entry on a date you choose, while
// "Reverse" only opens that mirror image for you to check and save.
// ?txnId= edits a saved entry.
export function JournalFormPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: customers } = useCustomers();
  const { items: vendors } = useVendors();
  const attachments = useFormAttachments();
  // "Make recurring" turns this form into a template editor (QBO's "Recurring Journal Entry").
  const tpl = useRecurringTemplate();
  const [useTplId, setUseTplId] = useState<string | null>(null); // template this form was filled from

  const txnId = params.get("txnId");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [number, setNumber] = useState("1");
  const [lines, setLines] = useState<Line[]>(startingLines);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [percent, setPercent] = useState("");
  const numberTyped = useRef(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reverseDate, setReverseDate] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get("txnId")) return;
      // "Copy" and "Reverse" leave their lines here; take them once.
      if (new URLSearchParams(window.location.search).get("copy") === "1") {
        const draft = JSON.parse(window.localStorage.getItem(COPY_KEY) ?? "null");
        window.localStorage.removeItem(COPY_KEY);
        if (draft) {
          setMemo(draft.memo ?? "");
          if (draft.date) setDate(draft.date);
          if (draft.number) {
            numberTyped.current = true;
            setNumber(draft.number);
          }
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
    if (txnId) return;
    let cancelled = false;
    services.transactionService
      .listTransactions()
      .then((transactions) => {
        if (!cancelled && !numberTyped.current) setNumber(nextJournalNumber(transactions));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [txnId, services]);
  // ?template=<id> fills the form from a saved template; &edit=1 opens it as the template editor, otherwise it is "Use" (saving counts the occurrence as done).
  const templateParam = params.get("template");
  const editParam = params.get("edit") === "1";
  useEffect(() => {
    if (!templateParam) return;
    listRecurring()
      .then((all) => {
        const t = all.find((x) => x.id === templateParam);
        if (!t) return toast({ variant: "error", title: "That recurring template no longer exists" });
        applyTemplate(t);
      })
      .catch(() => toast({ variant: "error", title: "Could not load the recurring template" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateParam]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // ?txnId= opens a saved journal entry to edit it (the register's "Edit").
  const { loaded, setLoaded, loadError } = useSavedTransaction(txnId, "JOURNAL_ENTRY", "a journal entry", (txn) => {
    setDate(txn.transactionDate);
    setNumber(txn.referenceNumber ?? "");
    setMemo(txn.memo ?? "");
    const next = txn.postings.map((p) => ({
      ...blankLine(),
      accountId: p.accountId,
      debit: p.type === "DEBIT" ? p.amount.toFixed(2) : "",
      credit: p.type === "CREDIT" ? p.amount.toFixed(2) : "",
      description: p.description ?? "",
      name: p.details?.name ?? ""
    }));
    // An entry made from the register has a payee but no line names: show it on the register's line.
    if (txn.payee && next.every((l) => !l.name)) {
      (next.find((l) => l.accountId === txn.sourceAccountId) ?? next[0]).name = txn.payee;
    }
    while (next.length < 8) next.push(blankLine());
    setLines(next);
    void attachments.loadLinked(txn.id).catch(() => toast({ variant: "error", title: "Could not load the attachments" }));
  });

  const accountOptions = useMemo(() => accounts.filter((a) => a.status === "ACTIVE").sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ value: a.id, label: a.name, rightLabel: ACCOUNT_CATEGORY_LABELS[a.category] })), [accounts]);
  const contactOptions = useMemo(() => [...customers.map((c) => ({ value: c.name, label: c.name, rightLabel: "Customer" })), ...vendors.map((v) => ({ value: v.name, label: v.name, rightLabel: "Vendor" }))].sort((a, b) => a.label.localeCompare(b.label)), [customers, vendors]);
  const nameOptions = [
    ...[...new Set(lines.map((l) => l.name).filter((n) => n && !contactOptions.some((o) => o.value === n)))].map((n) => ({ value: n, label: n, rightLabel: "" })),
    ...contactOptions
  ];
  const debitCents = lines.reduce((sum, l) => sum + cents(l.debit), 0);
  const creditCents = lines.reduce((sum, l) => sum + cents(l.credit), 0);

  const closePage = () => leaveFormPage(router);
  const printSaved = useTransactionPrint();
  const updateLine = (id: string, patch: Partial<Line>) => setLines((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  function resetForm(nextNumber?: string) {
    setLines(startingLines());
    setMemo("");
    attachments.reset();
    setError(null);
    if (nextNumber) setNumber(nextNumber);
  }

  /** Validates the lines and works out the ledger postings; shared by Save and Save template. */
  function buildPostings() {
    const used = lines.filter((l) => l.accountId || cents(l.debit) > 0 || cents(l.credit) > 0);
    if (used.length < 2) return { ok: false as const, error: "A journal entry needs at least two lines." };
    if (used.some((l) => !l.accountId)) return { ok: false as const, error: "Every line with an amount needs an account." };
    if (used.some((l) => cents(l.debit) > 0 && cents(l.credit) > 0)) return { ok: false as const, error: "A line can have a debit or a credit, not both." };
    if (used.some((l) => cents(l.debit) <= 0 && cents(l.credit) <= 0)) return { ok: false as const, error: "Every line needs a debit or a credit amount." };
    if (debitCents !== creditCents) return { ok: false as const, error: `Debits and credits must be equal (difference ${money(Math.abs(debitCents - creditCents) / 100)}).` };
    const names = [...new Set(used.map((l) => l.name).filter(Boolean))];
    // The reconcile mark belongs to the source account, so keep it while that account is still on the entry.
    const sourceAccountId = loaded?.sourceAccountId && used.some((l) => l.accountId === loaded.sourceAccountId) ? loaded.sourceAccountId : used[0].accountId;
    // The register's Account column shows the other side, as seen from the source account.
    const other = used.find((l) => l.accountId !== sourceAccountId) ?? used[0];
    return {
      ok: true as const,
      used,
      payee: names.length === 1 ? names[0] : undefined,
      sourceAccountId,
      label: used.length > 2 ? "Split" : accounts.find((a) => a.id === other.accountId)?.name ?? "",
      postings: used.map((l) => ({
        accountId: l.accountId,
        type: cents(l.debit) > 0 ? ("DEBIT" as const) : ("CREDIT" as const),
        amount: (cents(l.debit) > 0 ? cents(l.debit) : cents(l.credit)) / 100,
        description: l.description.trim() || undefined,
        details: formDetails({ name: l.name })
      }))
    };
  }

  function applyTemplate(t: RecurringTemplate) {
    const f = (t.formState ?? {}) as { memo?: string; lines?: Omit<Line, "id">[] };
    setMemo(f.memo ?? t.payload.memo ?? "");
    if (f.lines?.length) {
      const next = f.lines.map((l) => ({ ...blankLine(), ...l }));
      while (next.length < 8) next.push(blankLine());
      setLines(next);
    }
    if (editParam) tpl.load(t);
    else setUseTplId(t.id);
  }

  async function saveTemplate() {
    const head = tpl.buildBody();
    if ("error" in head) return setError(head.error);
    const built = buildPostings();
    if (!built.ok) return setError(built.error);
    const body = {
      ...head,
      payload: { memo: memo.trim() || undefined, payee: built.payee, accountLabel: built.label, sourceAccountId: built.sourceAccountId, postings: built.postings },
      formState: { memo, lines: built.used.map(({ accountId, debit, credit, description, name }) => ({ accountId, debit, credit, description, name })) }
    };
    setSaving(true);
    setError(null);
    try {
      if (tpl.id) await updateRecurring(tpl.id, body);
      else await createRecurring({ ...body, kind: "JOURNAL_ENTRY" });
      toast({ variant: "success", title: "Recurring template saved" });
      closePage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this template.");
    } finally {
      setSaving(false);
    }
  }

  async function postReversal(reverseOn: string, built: Extract<ReturnType<typeof buildPostings>, { ok: true }>, sourceAccountId: string) {
    const reversal = await services.transactionService.createTransaction({
      type: "JOURNAL_ENTRY",
      transactionDate: reverseOn,
      referenceNumber: number ? `${number}R` : undefined,
      memo: `Reversal of journal entry ${number}`.trim(),
      payee: built.payee,
      accountLabel: built.label,
      sourceAccountId,
      postings: built.postings.map((p) => ({ ...p, type: p.type === "DEBIT" ? ("CREDIT" as const) : ("DEBIT" as const) }))
    });
    await services.transactionService.postTransaction(reversal.id);
  }

  async function save(after: "stay" | "close" | "new", reverseOn?: string) {
    setMenuOpen(false);
    if (!date) return setError("Enter the journal date.");
    const built = buildPostings();
    if (!built.ok) return setError(built.error);
    if (txnId && !loaded) return setError(loadError ?? "This transaction is still loading.");
    const { postings, label, payee, sourceAccountId } = built;
    const body = { transactionDate: date, referenceNumber: number.trim() || undefined, memo: memo.trim() || undefined, payee, accountLabel: label, sourceAccountId, postings };
    setSaving(true);
    setError(null);
    try {
      let savedId: string;
      if (loaded) {
        setLoaded(await services.transactionService.updateTransaction(loaded.id, { ...body, dueDate: loaded.dueDate, paymentMethod: loaded.paymentMethod, details: loaded.details }));
        savedId = loaded.id;
      } else {
        const created = await services.transactionService.createTransaction({ ...body, type: "JOURNAL_ENTRY" });
        await services.transactionService.postTransaction(created.id);
        savedId = created.id;
        if (useTplId) await advanceRecurring(useTplId).catch(() => undefined);
      }
      await attachments.linkTo(savedId).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      if (reverseOn) await postReversal(reverseOn, built, sourceAccountId);
      toast({ variant: "success", title: reverseOn ? "Journal entry saved and reversed" : "Journal entry saved" });
      if (after === "close") closePage();
      else if (after === "new") window.location.assign("/journal");
      else {
        // "Save" keeps the entry open.
        await attachments.loadLinked(savedId).catch(() => undefined);
        if (!loaded) router.replace(`/journal?txnId=${encodeURIComponent(savedId)}`);
        services.accountService.listAccounts().then(setAccounts).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this journal entry.");
    } finally {
      setSaving(false);
    }
  }

  const firstOfNextMonth = () => {
    const base = new Date(`${date || new Date().toISOString().slice(0, 10)}T00:00:00`);
    return new Date(base.getFullYear(), base.getMonth() + 1, 1).toLocaleDateString("en-CA");
  };

  // "Reverse" opens the mirror image as a new, unsaved entry.
  function reverseEntry() {
    const used = lines.filter((l) => l.accountId || l.debit || l.credit);
    if (used.length === 0) return setError("There are no lines to reverse.");
    try {
      window.localStorage.setItem(
        COPY_KEY,
        JSON.stringify({
          memo: `Reversal of journal entry ${number}`.trim(),
          date: firstOfNextMonth(),
          number: number ? `${number}R` : "",
          lines: used.map(({ accountId, debit, credit, description, name }) => ({ accountId, debit: credit, credit: debit, description, name }))
        })
      );
    } catch {
      return toast({ variant: "error", title: "Could not reverse this entry" });
    }
    window.location.assign("/journal?copy=1");
  }

  function multiply() {
    const value = Number(percent);
    if (!(value > 0)) return toast({ variant: "info", title: "Enter a percentage above zero" });
    setLines((current) => multiplyLines(current, value));
    setPercent("");
  }

  function openReverse() {
    setReverseDate(firstOfNextMonth());
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

  const sortIcon = <button type="button" disabled aria-label="Sort lines" title="Sorting lines isn't available yet" className="flex h-9 items-center px-2 text-[var(--color-negative)] disabled:opacity-60"><span aria-hidden="true" className="text-lg leading-none">↑↓</span></button>;
  const toolbar = (
    <>
      <button type="button" onClick={exportCsv} className={RT_TOOLBAR_LINK}>Export CSV</button>
      <button type="button" onClick={() => void pasteFromClipboard()} className={RT_TOOLBAR_LINK}>Paste Excel</button>
      {tpl.active ? null : <button type="button" onClick={copyEntry} className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"><Copy className="h-5 w-5" aria-hidden="true" />Copy</button>}
    </>
  );

  const footer = tpl.active ? (
    <>
      <div className="flex items-center gap-3">
        <Button variant="secondary" className="!rounded-md" onClick={closePage}>Cancel</Button>
        <Button variant="secondary" className="!rounded-md" onClick={() => resetForm()}>Clear</Button>
      </div>
      <button type="button" onClick={() => { tpl.cancel(); setError(null); }} className="text-base text-[var(--color-text-global)] hover:underline">Cancel make recurring</button>
      <Button className="!rounded-md" disabled={saving} onClick={() => void saveTemplate()}>{saving ? "Saving..." : "Save template"}</Button>
    </>
  ) : (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-8">
      <Button variant="secondary" className="!rounded-md" onClick={closePage}>Cancel</Button>
      {txnId ? null : <button type="button" onClick={() => resetForm()} className={FOOTER_LINK}>Clear</button>}
      <button type="button" onClick={() => void printSaved(loaded)} className={`${FOOTER_LINK} !text-[var(--color-negative)]`}>RightTool Print</button>
      <button type="button" onClick={reverseEntry} className={FOOTER_LINK}>Reverse</button>
      <button type="button" onClick={() => tpl.start(date)} className={FOOTER_LINK}>Make recurring</button>
      <MoreMenu transaction={loaded} onRemoved={closePage} className={FOOTER_LINK} />
      <div className="ml-6 flex items-center gap-3">
        <Button variant="secondary" className="!rounded-md" disabled={saving || Boolean(txnId && !loaded)} onClick={() => void save("stay")}>Save</Button>
        <div ref={menuRef} className="relative inline-flex">
          <Button variant="primary" className="!rounded-l-md !rounded-r-none" disabled={saving || Boolean(txnId && !loaded)} onClick={() => void save("new")}>{saving ? "Saving..." : "Save and new"}</Button>
          <Button variant="primary" className="!rounded-l-none !rounded-r-md border-l border-l-white/30 !min-w-0 px-2" aria-label="More save options" disabled={saving || Boolean(txnId && !loaded)} onClick={() => setMenuOpen((v) => !v)}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          {menuOpen ? (
            <div className="absolute bottom-full right-0 mb-1 w-44 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
              <button type="button" onClick={() => void save("close")} className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Save and close</button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <FullScreenFormShell title={<>{`Journal Entry #${number}`} {loaded?.reconcileStatus === "R" ? <span className="text-lg text-[var(--color-negative)]">(Reconciled)</span> : null}</>} onClose={closePage} toolbar={toolbar} onSettings={() => toast({ variant: "info", title: "Choose what you use isn't available yet" })} settingsLabel="Choose what you use" footer={footer} leadingTools={sortIcon}>
      <div className="px-6 pb-8 pt-5">
        {tpl.active ? (
          <div className="pb-6">
            <p className="mb-3 text-sm font-semibold text-[var(--color-text-global)]">Recurring Journal Entry</p>
            <RecurringNameRow tpl={tpl} />
            <RecurringIntervalRow tpl={tpl} />
          </div>
        ) : (
        <div className="flex flex-wrap items-end gap-4 pb-6">
          <div>
            <label className={LABEL} htmlFor="journal-date">Journal date</label>
            <DateField id="journal-date" value={date} onChange={setDate} className="w-[160px]" />
          </div>
          <div>
            <label className={LABEL} htmlFor="journal-no">Journal no.</label>
            <InputField id="journal-no" value={number} onChange={(event) => { numberTyped.current = true; setNumber(event.target.value); }} className="w-[260px]" />
          </div>
        </div>
        )}

        <div className="mb-2 flex justify-end gap-3 text-[var(--color-text-global)]">
          <button type="button" onClick={exportCsv} aria-label="Export lines" title="Export lines" className="hover:text-[var(--color-link-action)]"><SquareArrowOutUpRight className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" onClick={() => void pasteFromClipboard()} aria-label="Paste from Excel" title="Paste from Excel" className="hover:text-[var(--color-link-action)]"><ClipboardPaste className="h-5 w-5" aria-hidden="true" /></button>
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
            {lines.map((line, index) => {
              const active = activeLineId === line.id;
              const open = () => setActiveLineId(line.id);
              const text = (label: string, value: string, align = "text-left") => (
                <button type="button" aria-label={`Line ${index + 1} ${label}`} onClick={open} onFocus={open} className={`${CELL_TEXT} ${align}`}>{value}</button>
              );
              const amount = (value: string) => (value ? money(cents(value) / 100) : "");
              return (
              <tr key={line.id} onClick={open} className="h-[53px] border-b border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                <td className="text-[var(--color-icon-muted)]"><GripVertical className="h-4 w-4" aria-hidden="true" /></td>
                <td className="px-2 py-2 text-center">{index + 1}</td>
                <td className="px-2 py-2">{active ? <Select value={line.accountId} onChange={(v) => updateLine(line.id, { accountId: v })} options={accountOptions} placeholder="" allowCustomValue={false} /> : text("account", accounts.find((a) => a.id === line.accountId)?.name ?? "")}</td>
                <td className={CELL}>{active ? <input type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(line.id, { debit: event.target.value, credit: event.target.value ? "" : line.credit })} aria-label={`Line ${index + 1} debit`} className={`${CELL_INPUT} text-right`} /> : text("debit", amount(line.debit), "text-right")}</td>
                <td className={CELL}>{active ? <input type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(line.id, { credit: event.target.value, debit: event.target.value ? "" : line.debit })} aria-label={`Line ${index + 1} credit`} className={`${CELL_INPUT} text-right`} /> : text("credit", amount(line.credit), "text-right")}</td>
                <td className={CELL}>{active ? <input value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} aria-label={`Line ${index + 1} description`} className={CELL_INPUT} /> : text("description", line.description)}</td>
                <td className={CELL}>{active ? <Select value={line.name} onChange={(v) => updateLine(line.id, { name: v })} options={nameOptions} placeholder="" allowCustomValue={false} /> : text("name", line.name)}</td>
                <td className="px-1 text-center"><button type="button" aria-label="Copy line" onClick={() => setLines((current) => { const i = current.findIndex((l) => l.id === line.id); return [...current.slice(0, i + 1), { ...line, id: blankLine().id }, ...current.slice(i + 1)]; })} className="text-[var(--color-text-global)]"><Copy className="h-5 w-5" aria-hidden="true" /></button></td>
                <td className="px-1 text-center"><button type="button" aria-label="Delete line" onClick={() => setLines((current) => (current.length > 1 ? current.filter((l) => l.id !== line.id) : [blankLine()]))} className="text-[var(--color-text-global)] hover:text-[var(--color-negative)]"><Trash2 className="h-5 w-5" aria-hidden="true" /></button></td>
              </tr>
              );
            })}
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
          <span className="ml-4 flex items-center gap-2">
            <input value={percent} onChange={(event) => setPercent(event.target.value.replace(/[^0-9.]/g, ""))} onKeyDown={(event) => event.key === "Enter" && multiply()} placeholder="%" aria-label="Percentage" className="h-8 w-14 rounded border border-[var(--color-negative)] bg-transparent px-2 text-sm" />
            <button type="button" onClick={multiply} className="text-sm text-[var(--color-negative)] hover:underline">Multiply by %</button>
          </span>
          <button type="button" className={RT_BUTTON} onClick={clearZeroLines}>Clear 0 Value Lines</button>
          {tpl.active ? null : <button type="button" className={`${RT_LINK} ml-2 !text-sm font-semibold`} disabled={saving} onClick={openReverse}>Save and Reverse</button>}
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
        {error ?? loadError ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error ?? loadError}</p> : null}
        <p className="mt-6 text-center"><a href="https://www.intuit.com/privacy/" target="_blank" rel="noreferrer" className="text-[var(--color-link-action)] hover:underline">Privacy</a></p>
      </div>

      <Modal open={reverseOpen} onClose={() => setReverseOpen(false)} title="Save and Reverse" size="sm">
        <p className="mb-3 text-sm">Posts this entry, then a second entry with every debit and credit swapped on the date below.</p>
        <label className={LABEL} htmlFor="journal-reverse-date">Reversal date</label>
        <InputField id="journal-reverse-date" type="date" value={reverseDate} onChange={(event) => setReverseDate(event.target.value)} />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setReverseOpen(false)}>Cancel</Button>
          <Button variant="primary" disabled={!reverseDate || saving} onClick={() => { setReverseOpen(false); void save("stay", reverseDate); }}>Save and Reverse</Button>
        </div>
      </Modal>
    </FullScreenFormShell>
  );
}
