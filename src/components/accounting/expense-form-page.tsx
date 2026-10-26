"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Copy, History, Plus, Trash2, X } from "lucide-react";
import { PayeeSideModal } from "@/components/bank-register/payee-side-modal";
import { Button } from "@/components/ui/button";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useVendors } from "@/lib/hooks/use-vendors";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";

type Line = { id: string; categoryAccountId: string; description: string; amount: string };

let lineCounter = 0;
const blankLine = (): Line => {
  lineCounter += 1;
  return { id: `expense-line-${lineCounter}`, categoryAccountId: "", description: "", amount: "" };
};
const startingLines = () => [blankLine(), blankLine()];

const PAYMENT_METHODS = ["Cash", "Check", "Credit Card", "Debit Card", "Bank Transfer"].map((m) => ({ value: m, label: m }));
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const RT_BUTTON = "rounded-md border border-[var(--color-negative)] px-3 py-1.5 text-sm text-[var(--color-negative)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const PLAIN_BUTTON = "rounded-md border border-[var(--color-button-border)] px-3 py-1.5 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const RT_LINK = "text-left text-sm font-semibold text-[var(--color-negative)] hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline";

const cents = (value: string) => Math.round((Number(value) || 0) * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

// QBO's full-screen Expense form (/expense?rtAccountId=...&rt=close). The
// payment account comes from rtAccountId, so "+ Expense" on a bank screen opens
// it already pointing at that account. `rt=close` is RightTool's flag that this
// page was opened from a list: Save and close / Cancel / X return there.
// Save posts a real expense (category lines debit, the payment account credits).
export function ExpenseFormPage() {
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
  const [refNo, setRefNo] = useState("");
  const [lines, setLines] = useState<Line[]>(startingLines);
  const [memo, setMemo] = useState("");
  const [linesOpen, setLinesOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payeeModalOpen, setPayeeModalOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const saveMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);

  useEffect(() => {
    if (!saveMenuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!saveMenuRef.current?.contains(event.target as Node)) setSaveMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [saveMenuOpen]);

  const paymentAccounts = useMemo(() => accounts.filter((a) => isRegisterAccountCategory(a.category)), [accounts]);
  const paymentAccount = accounts.find((a) => a.id === paymentAccountId);
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

  function closePage() {
    if (window.history.length > 1) router.back();
    else router.push("/all-apps/bank-transactions");
  }

  function resetForm() {
    setPayee("");
    setMethod("");
    setRefNo("");
    setLines(startingLines());
    setMemo("");
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
        type: "EXPENSE",
        transactionDate: date,
        referenceNumber: refNo.trim() || undefined,
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
      toast({ variant: "success", title: "Expense saved" });
      if (after === "close") closePage();
      else {
        resetForm();
        services.accountService.listAccounts().then(setAccounts).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this expense.");
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
    a.download = "expense-lines.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  function applyPaste() {
    const parsed: Line[] = [];
    const unknown: string[] = [];
    for (const row of pasteText.split("\n").map((r) => r.trim()).filter(Boolean)) {
      const [category = "", description = "", amount = ""] = row.split(row.includes("\t") ? "\t" : ",").map((c) => c.trim());
      const match = accounts.find((a) => a.id !== paymentAccountId && a.name.toLowerCase() === category.toLowerCase());
      if (category && !match) unknown.push(category);
      parsed.push({ ...blankLine(), categoryAccountId: match?.id ?? "", description, amount: amount.replace(/[$,]/g, "") });
    }
    if (parsed.length > 0) setLines(parsed);
    setPasteOpen(false);
    setPasteText("");
    if (unknown.length > 0) toast({ variant: "info", title: "Some categories weren't found", description: [...new Set(unknown)].join(", ") });
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[var(--color-container-background-accent)] text-[var(--color-text-primary)]">
      <header className="flex items-center justify-between px-6 py-3">
        <h1 className="flex items-center gap-3 text-2xl text-[var(--color-text-global)]">
          <History className="h-6 w-6" aria-hidden="true" />
          Expense
        </h1>
        <button type="button" onClick={closePage} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
          <X className="h-6 w-6" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-6 pb-6">
          <div className="flex flex-wrap gap-6">
            <div className="w-[320px]">
              <span className={LABEL}>Payee</span>
              <Select value={payee} onChange={setPayee} options={payeeOptions} placeholder="Who did you pay?" allowCustomValue={false} onAddNew={() => setPayeeModalOpen(true)} addNewLabel="+ Add new" />
            </div>
            <div className="w-[320px]">
              <span className={LABEL}>Payment account</span>
              <Select value={paymentAccountId} onChange={setPaymentAccountId} options={paymentOptions} placeholder="Select account" allowCustomValue={false} />
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

        <div className="flex flex-wrap gap-6 pb-6">
          <div>
            <label className={LABEL} htmlFor="expense-date">Payment Date</label>
            <InputField id="expense-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[200px]" />
          </div>
          <div className="w-[240px]">
            <span className={LABEL}>Payment Method</span>
            <Select value={method} onChange={setMethod} options={PAYMENT_METHODS} placeholder="" allowCustomValue={false} />
          </div>
          <div>
            <label className={LABEL} htmlFor="expense-ref">Ref no.</label>
            <InputField id="expense-ref" value={refNo} onChange={(event) => setRefNo(event.target.value)} className="w-[214px]" />
          </div>
        </div>

        <section className="rounded-lg bg-[var(--color-container-background-primary)] px-6 pb-6 pt-2">
          <button type="button" onClick={() => setLinesOpen((v) => !v)} aria-expanded={linesOpen} aria-label="Toggle category details" className="mx-auto mb-2 flex text-[var(--color-icon-secondary)]">
            {linesOpen ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <ChevronDown className="h-5 w-5" aria-hidden="true" />}
          </button>
          {linesOpen ? (
            <>
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-10" />
                  <col className="w-[28%]" />
                  <col />
                  <col className="w-[18%]" />
                  <col className="w-12" />
                  <col className="w-12" />
                </colgroup>
                <thead>
                  <tr className="border-b border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
                    <th className="px-2 py-3 text-center">#</th>
                    <th className="px-2 py-3">Category</th>
                    <th className="border-l border-[var(--color-divider-tertiary)] px-2 py-3">Description</th>
                    <th className="border-l border-[var(--color-divider-tertiary)] px-2 py-3 text-right">Amount</th>
                    <th />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id} className="border-b border-[var(--color-divider-tertiary)]">
                      <td className="px-2 py-2 text-center">{index + 1}</td>
                      <td className="px-2 py-2">
                        <Select value={line.categoryAccountId} onChange={(v) => updateLine(line.id, { categoryAccountId: v })} options={categoryOptions} placeholder="" allowCustomValue={false} />
                      </td>
                      <td className="border-l border-[var(--color-divider-tertiary)] px-2 py-2">
                        <input value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} aria-label={`Line ${index + 1} description`} className={`${INPUT_BASE_CLASSES} h-9 rounded px-3 text-sm`} />
                      </td>
                      <td className="border-l border-[var(--color-divider-tertiary)] px-2 py-2">
                        <input type="number" min="0" step="0.01" value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} aria-label={`Line ${index + 1} amount`} className={`${INPUT_BASE_CLASSES} h-9 rounded px-3 text-right text-sm`} />
                      </td>
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
                <button type="button" className={RT_LINK} disabled title="Tags aren't available yet">Copy Tags To Memo</button>
                <button type="button" className={RT_LINK} onClick={copyDescriptionsToMemo}>Copy Descriptions To Memo</button>
                <span />
                <button type="button" className={RT_LINK} onClick={copyMemoToDescriptions}>Copy Memo to Descriptions</button>
              </div>
            </div>
            <div className="w-[520px] max-w-full">
              <span className={LABEL}>Attachments</span>
              <div className="rounded-md border border-dashed border-[var(--color-container-border-secondary)] px-6 py-6 text-center opacity-70" title="Attachments aren't available yet">
                <p className="text-[var(--color-link-action)]">Add attachment</p>
                <p className="text-sm">Max file size: 20 MB</p>
              </div>
            </div>
          </div>
        </section>
        {error ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error}</p> : null}
      </div>

      <footer className="flex items-center justify-between gap-4 border-t border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-6 py-3">
        <div className="flex items-center gap-3">
          <Button variant="secondary" className="!rounded-md" onClick={closePage}>Cancel</Button>
          <Button variant="secondary" className="!rounded-md" onClick={resetForm}>Clear</Button>
        </div>
        <button type="button" disabled title="Recurring transactions aren't available yet" className="cursor-not-allowed text-base text-[var(--color-text-disabled)]">Make recurring</button>
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
      </footer>

      <PayeeSideModal
        open={payeeModalOpen}
        onClose={() => setPayeeModalOpen(false)}
        onSave={(created) => {
          const make = created.kind === "CUSTOMER" ? addCustomer({ name: created.name }) : addVendor({ name: created.name });
          make.then(() => setPayee(created.name)).catch((err) => toast({ variant: "error", title: "Could not add contact", description: err instanceof Error ? err.message : undefined }));
        }}
      />
      <Modal open={pasteOpen} onClose={() => setPasteOpen(false)} title="Paste from Excel" description="One line per row: Category, Description, Amount (tab- or comma-separated). Categories must match an account name." size="md">
        <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} rows={8} className={`${INPUT_BASE_CLASSES} rounded px-3 py-2 text-sm`} aria-label="Pasted rows" />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setPasteOpen(false)}>Cancel</Button>
          <Button onClick={applyPaste} disabled={!pasteText.trim()}>Add lines</Button>
        </div>
      </Modal>
    </div>
  );
}
