"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, ClipboardPaste, Copy, GripVertical, Plus, Settings, SquareArrowOutUpRight, Trash2, X } from "lucide-react";
import { FullScreenFormShell, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { ExpensePasteModal } from "@/components/accounting/expense-paste-modal";
import type { PastedLine } from "@/components/accounting/expense-paste-modal";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { PayeeSideModal } from "@/components/bank-register/payee-side-modal";
import { Button } from "@/components/ui/button";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { AttachmentsField } from "@/components/accounting/attachments-field";
import { useFormAttachments } from "@/lib/hooks/use-form-attachments";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { nextAccountCode } from "@/lib/accounting/next-account-code";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useVendors } from "@/lib/hooks/use-vendors";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

type Line = { id: string; categoryAccountId: string; description: string; amount: string };

let lineCounter = 0;
const blankLine = (): Line => {
  lineCounter += 1;
  return { id: `expense-line-${lineCounter}`, categoryAccountId: "", description: "", amount: "" };
};
const startingLines = () => [blankLine(), blankLine(), blankLine(), blankLine()];

// QBO's built-in payment methods; "+ Add new" adds your own (kept in this browser).
const DEFAULT_METHODS = ["ACH", "Cash", "Check", "Credit Card"];
const METHODS_KEY = "newgl:payment-methods:v1";
// Accounts you can pay an expense from: bank, card, and other current asset/liability accounts.
const PAYMENT_CATEGORIES = new Set<Account["category"]>(["BANK", "CREDIT_CARD", "OTHER_CURRENT_ASSET", "OTHER_CURRENT_LIABILITY"]);
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const RT_BUTTON = "rounded-md border border-[var(--color-negative)] px-3 py-1.5 text-sm text-[var(--color-negative)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const PLAIN_BUTTON = "rounded-md border border-[var(--color-button-border)] px-3 py-1.5 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]";
// Transaction types the "Copy options" panel can copy this expense into (QBO's list).
const COPY_TARGETS = ["Bill", "Check", "Credit Card Credit", "Credit Memo", "Delayed Charge", "Delayed Credit", "Estimate", "Expense", "Invoice", "Journal Entry", "Purchase Order", "Refund Receipt", "Sales Order", "Sales Receipt", "Vendor Credit"];
const CHECK_NEXT_KEY = "newgl:check-next:v1";
const COPY_KEY = "newgl:expense-copy:v1";
const COLUMNS_KEY = "newgl:expense-columns:v1";
const TAGS_KEY = "newgl:expense-use-tags:v1";
type Columns = { description: boolean; amount: boolean };
const COPY_ICON_BUTTON = "flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const CHECKBOX = "h-5 w-5 cursor-pointer rounded accent-[var(--color-ui-primary)] disabled:cursor-not-allowed";
const RT_LINK = "text-left text-sm font-semibold text-[var(--color-negative)] hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline";

const cents = (value: string) => Math.round((Number(value) || 0) * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

// QBO's full-screen Expense form (/expense?rtAccountId=...&rt=close). The
// payment account comes from rtAccountId, so "+ Expense" on a bank screen opens
// it already pointing at that account. `rt=close` is RightTool's flag that this
// page was opened from a list: Save and close / Cancel / X return there.
// Save posts a real expense (category lines debit, the payment account credits).
export function ExpenseFormPage({ kind = "expense" }: { kind?: "expense" | "check" }) {
  const isCheck = kind === "check";
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: vendors, add: addVendor } = useVendors();
  const { items: customers, add: addCustomer } = useCustomers();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payee, setPayee] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState(params.get("rtAccountId") ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("");
  const [checkNo, setCheckNo] = useState("1");
  const [printLater, setPrintLater] = useState(false);
  const [mailing, setMailing] = useState("");
  const [refNo, setRefNo] = useState("");
  const [lines, setLines] = useState<Line[]>(startingLines);
  const [memo, setMemo] = useState("");
  const [linesOpen, setLinesOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payeeModalOpen, setPayeeModalOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [customMethods, setCustomMethods] = useState<string[]>([]);
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [newMethod, setNewMethod] = useState("");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const attachments = useFormAttachments();
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<"copy" | "settings" | null>(null);
  const [copyTarget, setCopyTarget] = useState("");
  const [copyCardOpen, setCopyCardOpen] = useState(true);
  const [columns, setColumns] = useState<Columns>({ description: true, amount: true });
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [useTags, setUseTags] = useState(true);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);

  useEffect(() => {
    if (!isCheck) return;
    try {
      const stored = Number(window.localStorage.getItem(CHECK_NEXT_KEY));
      if (Number.isInteger(stored) && stored > 0) setCheckNo(String(stored));
    } catch {
      // storage unavailable: start at 1
    }
  }, [isCheck]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(METHODS_KEY) ?? "[]");
      if (Array.isArray(stored)) setCustomMethods(stored.filter((m): m is string => typeof m === "string"));
    } catch {
      // storage unavailable: only the built-in methods
    }
  }, []);

  useEffect(() => {
    try {
      const cols = JSON.parse(window.localStorage.getItem(COLUMNS_KEY) ?? "null");
      if (cols && typeof cols === "object") setColumns({ description: cols.description !== false, amount: cols.amount !== false });
      setUseTags(window.localStorage.getItem(TAGS_KEY) !== "0");
      // A "Copy to Expense" from another tab leaves the draft here; take it once.
      if (params.get("copy") === "1") {
        const draft = JSON.parse(window.localStorage.getItem(COPY_KEY) ?? "null");
        window.localStorage.removeItem(COPY_KEY);
        if (draft) {
          setPayee(draft.payee ?? "");
          setMethod(draft.method ?? "");
          setMemo(draft.memo ?? "");
          if (Array.isArray(draft.lines) && draft.lines.length > 0) {
            const next = draft.lines.map((l: Omit<Line, "id">) => ({ ...blankLine(), categoryAccountId: l.categoryAccountId ?? "", description: l.description ?? "", amount: l.amount ?? "" }));
            while (next.length < 4) next.push(blankLine());
            setLines(next);
          }
        }
      }
    } catch {
      // storage unavailable: defaults
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!columnsOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [columnsOpen]);

  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setPanel(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panel]);

  useEffect(() => {
    if (!saveMenuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!saveMenuRef.current?.contains(event.target as Node)) setSaveMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [saveMenuOpen]);

  const paymentAccounts = useMemo(() => accounts.filter((a) => (isCheck ? a.category === "BANK" : PAYMENT_CATEGORIES.has(a.category))).sort((a, b) => a.name.localeCompare(b.name)), [accounts, isCheck]);
  const methodOptions = useMemo(() => [...new Set([...DEFAULT_METHODS, ...customMethods])].sort((a, b) => a.localeCompare(b)).map((m) => ({ value: m, label: m })), [customMethods]);
  const payeeRecord = useMemo(() => vendors.find((v) => v.name === payee) ?? customers.find((c) => c.name === payee), [vendors, customers, payee]);
  const paymentAccount = accounts.find((a) => a.id === paymentAccountId);
  useEffect(() => {
    if (isCheck) setMailing([payeeRecord?.name, payeeRecord?.address].filter(Boolean).join("\n"));
  }, [isCheck, payeeRecord]);
  // If no (or an unknown) rtAccountId came in, default to the first bank/card account once loaded.
  useEffect(() => {
    if (accounts.length === 0 || paymentAccount) return;
    if (paymentAccounts[0]) setPaymentAccountId(paymentAccounts[0].id);
  }, [accounts, paymentAccount, paymentAccounts]);

  const paymentOptions = useMemo(() => paymentAccounts.map((a) => ({ value: a.id, label: a.name, rightLabel: ACCOUNT_CATEGORY_LABELS[a.category] })), [paymentAccounts]);
  const categoryOptions = useMemo(
    () => accounts.filter((a) => a.id !== paymentAccountId).map((a) => ({ value: a.id, label: a.name, rightLabel: ACCOUNT_CATEGORY_LABELS[a.category] })),
    [accounts, paymentAccountId]
  );
  const payeeOptions = useMemo(
    () => [
      ...vendors.map((v) => ({ value: v.name, label: v.name, rightLabel: "Vendor" })),
      ...customers.map((c) => ({ value: c.name, label: c.name, rightLabel: "Customer" }))
    ],
    [vendors, customers]
  );
  const totalCents = lines.reduce((sum, l) => sum + cents(l.amount), 0);
  const categoryName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";

  const closePage = () => leaveFormPage(router);

  function resetForm() {
    setPayee("");
    setMethod("");
    setRefNo("");
    setPrintLater(false);
    setLines(startingLines());
    setMemo("");
    attachments.reset();
    setError(null);
  }

  const updateLine = (id: string, patch: Partial<Line>) => setLines((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  async function save(after: "stay" | "close") {
    setSaveMenuOpen(false);
    if (!paymentAccount) return setError("Choose the payment account.");
    if (!date) return setError("Enter the payment date.");
    const used = lines.filter((l) => l.categoryAccountId || cents(l.amount) > 0);
    if (used.length === 0) return setError("Add at least one line with a category and an amount.");
    if (used.some((l) => !l.categoryAccountId)) return setError("Every line with an amount needs a category.");
    if (used.some((l) => cents(l.amount) <= 0)) return setError("Every line needs an amount above zero.");
    setSaving(true);
    setError(null);
    try {
      const total = totalCents / 100;
      const created = await services.transactionService.createTransaction({
        type: isCheck ? "CHECK" : "EXPENSE",
        transactionDate: date,
        referenceNumber: (isCheck ? checkNo : refNo).trim() || undefined,
        memo: memo.trim() || undefined,
        payee: payee.trim() || undefined,
        accountLabel: used.length > 1 ? "Split" : categoryName(used[0].categoryAccountId),
        sourceAccountId: paymentAccount.id,
        postings: [
          ...used.map((l) => ({ accountId: l.categoryAccountId, type: "DEBIT" as const, amount: cents(l.amount) / 100 })),
          { accountId: paymentAccount.id, type: "CREDIT" as const, amount: total }
        ]
      });
      await services.transactionService.postTransaction(created.id);
      await attachments.linkTo(created.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      toast({ variant: "success", title: isCheck ? "Check saved" : "Expense saved" });
      if (isCheck) {
        const following = String((Number(checkNo) || 0) + 1);
        setCheckNo(following);
        try {
          window.localStorage.setItem(CHECK_NEXT_KEY, following);
        } catch {
          // not persisted
        }
      }
      if (after === "close") closePage();
      else {
        resetForm();
        services.accountService.listAccounts().then(setAccounts).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : isCheck ? "Could not save this check." : "Could not save this expense.");
    } finally {
      setSaving(false);
    }
  }

  // RightTool helpers on the lines and memo.
  const clearZeroLines = () => setLines((current) => { const kept = current.filter((l) => cents(l.amount) > 0 || l.categoryAccountId || l.description); return kept.length >= 2 ? kept : [...kept, ...Array.from({ length: 2 - kept.length }, blankLine)]; });
  const copyNamesToMemo = () => payee && setMemo((m) => (m ? `${m} ${payee}` : payee));
  const copyDescriptionsToMemo = () => setMemo(lines.map((l) => l.description.trim()).filter(Boolean).join("; "));
  const copyMemoToDescriptions = () => setLines((current) => current.map((l) => ({ ...l, description: memo })));
  function exportCsv() {
    const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const rows = [["Category", "Description", "Amount"], ...lines.filter((l) => l.categoryAccountId || l.description || l.amount).map((l) => [categoryName(l.categoryAccountId), l.description, l.amount])];
    const blob = new Blob([rows.map((r) => r.map(escape).join(",")).join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = isCheck ? "check-lines.csv" : "expense-lines.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function applyPasted(pasted: PastedLine[]) {
    if (pasted.length === 0) return;
    const next = pasted.map((p) => ({ ...blankLine(), ...p }));
    while (next.length < 4) next.push(blankLine());
    setLines(next);
    const missing = pasted.filter((p) => !p.categoryAccountId).length;
    if (missing > 0) toast({ variant: "info", title: missing === 1 ? "1 line still needs a category" : `${missing} lines still need a category` });
  }
  // The list the paste dialog matches against, as a CSV to build a spreadsheet from.
  function exportAccountList() {
    const rows = ["Category", ...categoryOptions.map((o) => `"${o.label.replaceAll('"', '""')}"`)].join("\n");
    const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "categories.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function setColumn(key: keyof Columns, on: boolean) {
    const next = { ...columns, [key]: on };
    setColumns(next);
    try {
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
    } catch {
      // not persisted
    }
  }
  function toggleTags(on: boolean) {
    setUseTags(on);
    try {
      window.localStorage.setItem(TAGS_KEY, on ? "1" : "0");
    } catch {
      // not persisted
    }
  }
  // Only Expense exists in NewGL so far: it opens a new form pre-filled with this one.
  function copyTo() {
    if (!copyTarget) return;
    if (copyTarget !== "Expense") {
      toast({ variant: "info", title: `Copying to ${copyTarget} isn't available yet` });
      return;
    }
    try {
      window.localStorage.setItem(COPY_KEY, JSON.stringify({ payee, method, memo, lines: lines.map(({ categoryAccountId, description, amount }) => ({ categoryAccountId, description, amount })) }));
    } catch {
      toast({ variant: "error", title: "Could not copy this expense" });
      return;
    }
    window.open(`/expense?rtAccountId=${encodeURIComponent(paymentAccountId)}&rt=close&copy=1`, "_blank");
    setPanel(null);
    setCopyTarget("");
  }
  function addMethod() {
    const name = newMethod.trim();
    if (!name) return;
    const next = [...new Set([...customMethods, name])];
    setCustomMethods(next);
    try {
      window.localStorage.setItem(METHODS_KEY, JSON.stringify(next));
    } catch {
      // not persisted; still usable for this visit
    }
    setMethod(name);
    setNewMethod("");
    setMethodModalOpen(false);
  }

  const footer = (
    <>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="!rounded-md" onClick={closePage}>Cancel</Button>
          <Button variant="secondary" className="!rounded-md" onClick={resetForm}>Clear</Button>
        </div>
        <div className="flex items-center gap-8 text-base">
          {isCheck ? (
            <>
              <button type="button" onClick={() => window.print()} className="text-[var(--color-text-global)] hover:underline">Print check</button>
              <button type="button" disabled title="Ordering checks isn't available yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">Order checks</button>
            </>
          ) : null}
          <button type="button" disabled title="Recurring transactions aren't available yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">Make recurring</button>
          {isCheck ? <button type="button" disabled title="More options aren't available yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">More</button> : null}
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="!rounded-md" disabled={saving} onClick={() => void save("stay")}>Save</Button>
          <div ref={saveMenuRef} className="relative inline-flex">
            <Button className="!rounded-l-md !rounded-r-none" disabled={saving} onClick={() => void save("close")}>{saving ? "Saving..." : "Save and close"}</Button>
            <Button className="!rounded-l-none !rounded-r-md border-l border-l-white/30 !min-w-0 px-2" aria-label="More save options" disabled={saving} onClick={() => setSaveMenuOpen((v) => !v)}>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            {saveMenuOpen ? (
              <div className="absolute bottom-full right-0 mb-1 w-40 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <button type="button" onClick={() => void save("stay")} className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Save and new</button>
              </div>
            ) : null}
          </div>
        </div>
    </>
  );

  return (
    <FullScreenFormShell
      title={isCheck ? `Check #${checkNo}` : "Expense"}
      onClose={closePage}
      toolbar={
        <button type="button" onClick={() => setPanel("copy")} className="flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">
          <Copy className="h-5 w-5" aria-hidden="true" />
          Copy
        </button>
      }
      onSettings={() => setPanel("settings")}
      settingsLabel="Choose what you use"
      footer={footer}
    >
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-6 pb-6">
          <div className="flex flex-wrap gap-6">
            <div className="w-[320px]">
              <span className={LABEL}>Payee</span>
              <Select value={payee} onChange={setPayee} options={payeeOptions} placeholder="Who did you pay?" allowCustomValue={false} onAddNew={() => setPayeeModalOpen(true)} addNewLabel="+ Add new" />
              {payeeRecord ? (
                <button type="button" onClick={() => window.open(`/${"is1099Contractor" in payeeRecord ? "vendor" : "customer"}detail?nameId=${encodeURIComponent(payeeRecord.id)}`, "_blank")} className="mt-1 block text-sm font-medium text-[var(--color-negative)] underline hover:no-underline">
                  Payee Details
                </button>
              ) : null}
            </div>
            <div className="w-[320px]">
              <span className={LABEL}>{isCheck ? "Bank Account" : "Payment account"}</span>
              <Select value={paymentAccountId} onChange={setPaymentAccountId} options={paymentOptions} placeholder="Select account" allowCustomValue={false} onAddNew={() => setAccountModalOpen(true)} addNewLabel="+ Add new" />
            </div>
            {paymentAccount ? (
              <p className="self-center pt-5 text-sm">
                <strong className="text-[var(--color-text-global)]">Balance</strong> {money(paymentAccount.currentBalance)}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-[var(--color-text-global)]">Amount</p>
            <p className="text-5xl text-[var(--color-text-global)]">{money(totalCents / 100)}</p>
          </div>
        </div>

        {isCheck ? (
          <div className="flex flex-wrap items-start gap-6 pb-6">
            <div className="w-[350px]">
              <label className={LABEL} htmlFor="check-mailing">Mailing address</label>
              <textarea id="check-mailing" value={mailing} onChange={(event) => setMailing(event.target.value)} className={`${INPUT_BASE_CLASSES} h-[154px] resize-none rounded px-3 py-2 text-sm`} />
            </div>
            <div>
              <label className={LABEL} htmlFor="expense-date">Payment date</label>
              <InputField id="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[200px]" />
            </div>
            <div>
              <label className={LABEL} htmlFor="check-no">Check no.</label>
              <InputField id="check-no" value={checkNo} disabled={printLater} onChange={(event) => setCheckNo(event.target.value)} className="w-[214px]" />
              <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={printLater} onChange={(event) => setPrintLater(event.target.checked)} className={CHECKBOX} />Print later</label>
            </div>
          </div>
        ) : (
        <div className="flex flex-wrap gap-6 pb-6">
          <div>
            <label className={LABEL} htmlFor="expense-date">Payment Date</label>
            <InputField id="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[200px]" />
          </div>
          <div className="w-[240px]">
            <span className={LABEL}>Payment Method</span>
            <Select value={method} onChange={setMethod} options={methodOptions} placeholder="" allowCustomValue={false} onAddNew={() => setMethodModalOpen(true)} addNewLabel="+ Add new" />
          </div>
          <div>
            <label className={LABEL} htmlFor="expense-ref">Ref no.</label>
            <InputField id="expense-ref" value={refNo} onChange={(event) => setRefNo(event.target.value)} className="w-[214px]" />
          </div>
        </div>
        )}

        <section className="rounded-lg bg-[var(--color-container-background-primary)] px-6 pb-6 pt-2">
          <button type="button" onClick={() => setLinesOpen((v) => !v)} aria-expanded={linesOpen} aria-label="Toggle category details" className="mx-auto mb-2 flex text-[var(--color-icon-secondary)]">
            {linesOpen ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <ChevronDown className="h-5 w-5" aria-hidden="true" />}
          </button>
          {linesOpen ? (
            <>
              <div className="mb-2 flex justify-end gap-3 text-[var(--color-text-global)]">
                <button type="button" onClick={exportCsv} aria-label="Export lines" title="Export lines" className="hover:text-[var(--color-link-action)]"><SquareArrowOutUpRight className="h-5 w-5" aria-hidden="true" /></button>
                <button type="button" onClick={() => setPasteOpen(true)} aria-label="Paste from Excel" title="Paste from Excel" className="hover:text-[var(--color-link-action)]"><ClipboardPaste className="h-5 w-5" aria-hidden="true" /></button>
                <div ref={columnsRef} className="relative">
                  <button type="button" onClick={() => setColumnsOpen((v) => !v)} aria-label="Table settings" aria-expanded={columnsOpen} className="hover:text-[var(--color-link-action)]"><Settings className="h-5 w-5" aria-hidden="true" /></button>
                  {columnsOpen ? (
                    <div role="dialog" aria-label="Columns" className="absolute right-[-12px] top-full z-20 mt-3 w-[250px] rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-4 pb-4 pt-3 shadow-lg">
                      <span aria-hidden="true" className="absolute -top-[7px] right-[18px] h-3 w-3 rotate-45 border-l border-t border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)]" />
                      <button type="button" onClick={() => setColumnsOpen(false)} aria-label="Close columns" className="ml-auto mr-1 block text-[var(--color-icon-secondary)]"><X className="h-5 w-5" aria-hidden="true" /></button>
                      <p className="mt-2 text-sm text-[var(--color-text-global)]">Columns</p>
                      <ul className="mt-2 space-y-3 text-sm uppercase text-[var(--color-text-global)]">
                        <li><label className="flex items-center gap-3 opacity-60"><input type="checkbox" checked disabled className={CHECKBOX} />Category</label></li>
                        <li><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={columns.description} onChange={(event) => setColumn("description", event.target.checked)} className={CHECKBOX} />Description</label></li>
                        <li><label className="flex cursor-pointer items-center gap-3"><input type="checkbox" checked={columns.amount} onChange={(event) => setColumn("amount", event.target.checked)} className={CHECKBOX} />Amount</label></li>
                        <li><label className="flex items-center gap-3 opacity-60" title="Classes aren't available yet"><input type="checkbox" disabled className={CHECKBOX} />Class</label></li>
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-6" />
                  <col className="w-10" />
                  <col className="w-[28%]" />
                  {columns.description ? <col /> : null}
                  {columns.amount ? <col className="w-[18%]" /> : null}
                  {!columns.description && !columns.amount ? <col /> : null}
                  <col className="w-12" />
                  <col className="w-12" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
                    <th aria-hidden="true" />
                    <th className="px-2 py-3 text-center">#</th>
                    <th className="px-2 py-3">Category</th>
                    {columns.description ? <th className="border-l border-[var(--color-divider-tertiary)] px-2 py-3">Description</th> : null}
                    {columns.amount ? <th className="border-l border-[var(--color-divider-tertiary)] px-2 py-3 text-right">Amount</th> : null}
                    {!columns.description && !columns.amount ? <th /> : null}
                    <th />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id} className={`border-b border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)] ${index % 2 === 0 ? "bg-[var(--color-table-row-secondary)]" : ""}`}>
                      <td className="text-[var(--color-icon-muted)]"><GripVertical className="h-4 w-4" aria-hidden="true" /></td>
                      <td className="px-2 py-2 text-center">{index + 1}</td>
                      <td className="px-2 py-2">
                        <Select value={line.categoryAccountId} onChange={(v) => updateLine(line.id, { categoryAccountId: v })} options={categoryOptions} placeholder="" allowCustomValue={false} />
                      </td>
                      {columns.description ? <td className="border-l border-[var(--color-divider-tertiary)] px-2 py-2">
                        <input value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} aria-label={`Line ${index + 1} description`} className={`${INPUT_BASE_CLASSES} h-9 rounded px-3 text-sm`} />
                      </td> : null}
                      {columns.amount ? <td className="border-l border-[var(--color-divider-tertiary)] px-2 py-2">
                        <input type="number" min="0" step="0.01" value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} aria-label={`Line ${index + 1} amount`} className={`${INPUT_BASE_CLASSES} h-9 rounded px-3 text-right text-sm`} />
                      </td> : null}
                      {!columns.description && !columns.amount ? <td /> : null}
                      <td className="px-1 text-center">
                        <button type="button" aria-label="Copy line" onClick={() => setLines((current) => { const i = current.findIndex((l) => l.id === line.id); return [...current.slice(0, i + 1), { ...line, id: blankLine().id }, ...current.slice(i + 1)]; })} className="text-[var(--color-text-global)]">
                          <Copy className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </td>
                      <td className="px-1 text-center">
                        <button type="button" aria-label="Delete line" onClick={() => setLines((current) => (current.length > 1 ? current.filter((l) => l.id !== line.id) : [blankLine()]))} className="text-[var(--color-text-global)] hover:text-[var(--color-negative)]">
                          <Trash2 className="h-5 w-5" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" className={PLAIN_BUTTON} onClick={() => setLines((current) => [...current, blankLine(), blankLine()])}>
                    <Plus className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Add lines
                  </button>
                  <button type="button" className={PLAIN_BUTTON} onClick={() => setLines(startingLines())}>Clear all lines</button>
                  <button type="button" className={RT_BUTTON} onClick={clearZeroLines}>Clear 0 Value Lines</button>
                  <button type="button" className={RT_BUTTON} onClick={exportCsv}>Export CSV</button>
                  <button type="button" className={RT_BUTTON} onClick={() => setPasteOpen(true)}>Paste From Excel</button>
                </div>
                <p className="flex gap-16 pr-14 text-base font-semibold text-[var(--color-text-global)]">
                  <span>Total</span>
                  <span>{money(totalCents / 100)}</span>
                </p>
              </div>
            </>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-8">
            <div className="w-[520px] max-w-full">
              <label className={LABEL} htmlFor="expense-memo">Memo</label>
              <textarea id="expense-memo" value={memo} onChange={(event) => setMemo(event.target.value)} className={`${INPUT_BASE_CLASSES} h-40 resize-y rounded px-3 py-2 text-sm`} />
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                <button type="button" className={RT_LINK} onClick={copyNamesToMemo} disabled={!payee}>Copy Names To Memo</button>
                {useTags ? <button type="button" className={RT_LINK} disabled title="Tags aren't available yet">Copy Tags To Memo</button> : <span />}
                <button type="button" className={RT_LINK} onClick={copyDescriptionsToMemo}>Copy Descriptions To Memo</button>
                <span />
                <button type="button" className={RT_LINK} onClick={copyMemoToDescriptions}>Copy Memo to Descriptions</button>
              </div>
            </div>
            <div className="w-[520px] max-w-full">
              <AttachmentsField attachments={attachments} formLabel="Expense" />
            </div>
          </div>
        </section>
        {error ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error}</p> : null}
      </div>


      <PayeeSideModal
        open={payeeModalOpen}
        onClose={() => setPayeeModalOpen(false)}
        onSave={(created) => {
          const make = created.kind === "CUSTOMER" ? addCustomer({ name: created.name }) : addVendor({ name: created.name });
          make.then(() => setPayee(created.name)).catch((err) => toast({ variant: "error", title: "Could not add contact", description: err instanceof Error ? err.message : undefined }));
        }}
      />
      <ExpensePasteModal open={pasteOpen} accounts={categoryOptions.map((o) => ({ id: o.value, name: o.label }))} onClose={() => setPasteOpen(false)} onApply={applyPasted} onExportList={exportAccountList} />
      <AddAccountModal
        open={accountModalOpen}
        accounts={accounts}
        onClose={() => setAccountModalOpen(false)}
        onSave={async (input) => {
          const created = await services.accountService.createAccount({ code: nextAccountCode(accounts), name: input.name, category: input.category, subtype: input.subtype, currency: "USD", openingBalance: input.openingBalance });
          setAccounts(await services.accountService.listAccounts());
          setPaymentAccountId(created.id);
          return created;
        }}
      />
      <Modal open={methodModalOpen} onClose={() => setMethodModalOpen(false)} title="New payment method" size="sm">
        <InputField value={newMethod} onChange={(event) => setNewMethod(event.target.value)} placeholder="Payment method name" aria-label="Payment method name" autoFocus onKeyDown={(event) => event.key === "Enter" && addMethod()} />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setMethodModalOpen(false)}>Cancel</Button>
          <Button onClick={addMethod} disabled={!newMethod.trim()}>Save</Button>
        </div>
      </Modal>
      {panel ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/30">
          <button type="button" aria-label="Close panel" tabIndex={-1} className="h-full flex-1" onClick={() => setPanel(null)} />
          <aside className="flex h-full w-[min(1650px,94vw)] flex-col overflow-y-auto bg-[var(--color-container-background-primary)] px-8 pb-8 pt-6 shadow-2xl" role="dialog" aria-label={panel === "copy" ? "Copy options" : "Choose what you use"}>
            <div className="relative text-center">
              <h2 className="text-lg text-[var(--color-text-global)]">{panel === "copy" ? "Copy options" : "Choose what you use"}</h2>
              <button type="button" onClick={() => setPanel(null)} aria-label="Close" className="absolute right-0 top-0 -mt-1 rounded-md p-1.5 text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-ui-primary)]">
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            {panel === "copy" ? (
              <section className="mt-8 rounded-lg border border-[var(--color-container-border-secondary)]">
                <button type="button" onClick={() => setCopyCardOpen((v) => !v)} aria-expanded={copyCardOpen} className="flex w-full items-center justify-between px-6 py-5 text-left text-lg font-semibold text-[var(--color-text-global)]">
                  Copy data to another transaction
                  {copyCardOpen ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <ChevronDown className="h-5 w-5" aria-hidden="true" />}
                </button>
                {copyCardOpen ? (
                  <div className="flex items-end justify-between gap-6 border-t border-[var(--color-divider-tertiary)] px-6 pb-8 pt-8">
                    <div className="w-[260px]">
                      <span className={LABEL}>Copy to</span>
                      <Select value={copyTarget} onChange={setCopyTarget} options={COPY_TARGETS.map((t) => ({ value: t, label: t }))} placeholder="Select..." allowCustomValue={false} />
                    </div>
                    <Button variant="secondary" className="!rounded-md" disabled={!copyTarget} onClick={copyTo}>Copy</Button>
                  </div>
                ) : null}
              </section>
            ) : (
              <div className="mt-6">
                <p className="text-base">Changes you make here apply to all expense forms.</p>
                <label className="mt-6 flex cursor-pointer items-center gap-3 text-base text-[var(--color-text-global)]">
                  <input type="checkbox" checked={useTags} onChange={(event) => toggleTags(event.target.checked)} className={CHECKBOX} />
                  Tags
                </label>
              </div>
            )}
          </aside>
        </div>
      ) : null}
    </FullScreenFormShell>
  );
}
