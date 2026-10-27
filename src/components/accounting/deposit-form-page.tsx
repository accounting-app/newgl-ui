"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import { FullScreenFormShell, RT_TOOLBAR_LINK, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
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
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";
import { useVendors } from "@/lib/hooks/use-vendors";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

type Line = { id: string; receivedFrom: string; accountId: string; description: string; method: string; refNo: string; amount: string };

let lineCounter = 0;
const blankLine = (): Line => {
  lineCounter += 1;
  return { id: `deposit-line-${lineCounter}`, receivedFrom: "", accountId: "", description: "", method: "", refNo: "", amount: "" };
};
const startingLines = () => [blankLine(), blankLine()];

const DEPOSIT_CATEGORIES = new Set<Account["category"]>(["BANK", "OTHER_CURRENT_ASSET"]);
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const PLAIN_BUTTON = "rounded-md border border-[var(--color-button-border)] px-3 py-1.5 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const RT_BUTTON = "rounded-md border border-[var(--color-negative)] px-3 py-1.5 text-sm text-[var(--color-negative)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const RT_LINK = "text-left text-base font-medium text-[var(--color-negative)] hover:underline disabled:cursor-not-allowed disabled:opacity-50";
const CELL = "border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-2";
const CELL_INPUT = `${INPUT_BASE_CLASSES} h-9 rounded px-3 text-sm`;

const cents = (value: string) => Math.round((Number(value) || 0) * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

// QBO's full-screen Bank Deposit (/deposit?rtAccountId=...&rt=close).
// rtAccountId is the account receiving the funds. Save posts a real DEPOSIT:
// the account is debited (less any cash back), the cash-back account takes
// the cash back, and each line credits its own account.
export function DepositFormPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: customers } = useCustomers();
  const { items: vendors } = useVendors();
  const methods = usePaymentMethods();
  const attachments = useFormAttachments();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [depositId, setDepositId] = useState(params.get("rtAccountId") ?? "");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>(startingLines);
  const [open, setOpen] = useState(true);
  const [memo, setMemo] = useState("");
  const [cashBackId, setCashBackId] = useState("");
  const [cashBackMemo, setCashBackMemo] = useState("");
  const [cashBackAmount, setCashBackAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountModalFor, setAccountModalFor] = useState<"deposit" | "cashback" | string | null>(null);
  const [methodModalFor, setMethodModalFor] = useState<string | null>(null);
  const [newMethod, setNewMethod] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const active = useMemo(() => accounts.filter((a) => a.status === "ACTIVE").sort((a, b) => a.name.localeCompare(b.name)), [accounts]);
  const depositAccounts = useMemo(() => active.filter((a) => DEPOSIT_CATEGORIES.has(a.category)), [active]);
  const depositAccount = accounts.find((a) => a.id === depositId);
  useEffect(() => {
    if (accounts.length === 0 || depositAccount) return;
    if (depositAccounts[0]) setDepositId(depositAccounts[0].id);
  }, [accounts, depositAccount, depositAccounts]);

  const depositOptions = useMemo(() => depositAccounts.map((a) => ({ value: a.id, label: a.name })), [depositAccounts]);
  const lineAccountOptions = useMemo(() => active.filter((a) => a.id !== depositId).map((a) => ({ value: a.id, label: a.name, rightLabel: ACCOUNT_CATEGORY_LABELS[a.category] })), [active, depositId]);
  const cashBackOptions = useMemo(() => active.filter((a) => a.id !== depositId).map((a) => ({ value: a.id, label: a.name })), [active, depositId]);
  const nameOptions = useMemo(
    () => [...customers.map((c) => ({ value: c.name, label: c.name, rightLabel: "Customer" })), ...vendors.map((v) => ({ value: v.name, label: v.name, rightLabel: "Vendor" }))].sort((a, b) => a.label.localeCompare(b.label)),
    [customers, vendors]
  );

  const otherFundsCents = lines.reduce((sum, l) => sum + (l.amount === "" ? 0 : cents(l.amount)), 0);
  const cashBackCents = cents(cashBackAmount);
  const totalCents = otherFundsCents - cashBackCents;

  const updateLine = (id: string, patch: Partial<Line>) => setLines((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const closePage = () => leaveFormPage(router);
  function resetForm() {
    setLines(startingLines());
    setMemo("");
    setCashBackId("");
    setCashBackMemo("");
    setCashBackAmount("");
    attachments.reset();
    setError(null);
  }

  async function save(after: "stay" | "close") {
    setMenuOpen(false);
    if (!depositAccount) return setError("Choose the account to deposit to.");
    if (!date) return setError("Enter the deposit date.");
    const used = lines.filter((l) => l.accountId || l.amount !== "");
    if (used.length === 0) return setError("Add at least one line with an account and an amount.");
    if (used.some((l) => !l.accountId)) return setError("Every line needs an account.");
    if (used.some((l) => cents(l.amount) <= 0)) return setError("Every line needs an amount above zero.");
    if (cashBackCents < 0 || cashBackCents > otherFundsCents) return setError("Cash back can't be more than the funds being deposited.");
    if (cashBackCents > 0 && !cashBackId) return setError("Choose where the cash back goes.");
    const credits = new Map<string, number>();
    for (const l of used) credits.set(l.accountId, (credits.get(l.accountId) ?? 0) + cents(l.amount));
    const names = [...new Set(used.map((l) => l.receivedFrom).filter(Boolean))];
    setSaving(true);
    setError(null);
    try {
      const created = await services.transactionService.createTransaction({
        type: "DEPOSIT",
        transactionDate: date,
        referenceNumber: used.find((l) => l.refNo.trim())?.refNo.trim() || undefined,
        memo: memo.trim() || undefined,
        payee: names.length === 1 ? names[0] : undefined,
        accountLabel: credits.size > 1 ? "Split" : accounts.find((a) => a.id === [...credits.keys()][0])?.name ?? "",
        sourceAccountId: depositAccount.id,
        postings: [
          ...(totalCents > 0 ? [{ accountId: depositAccount.id, type: "DEBIT" as const, amount: totalCents / 100 }] : []),
          ...(cashBackCents > 0 ? [{ accountId: cashBackId, type: "DEBIT" as const, amount: cashBackCents / 100 }] : []),
          ...[...credits].map(([accountId, c]) => ({ accountId, type: "CREDIT" as const, amount: c / 100 }))
        ]
      });
      await services.transactionService.postTransaction(created.id);
      await attachments.linkTo(created.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      toast({ variant: "success", title: "Deposit saved" });
      if (after === "close") closePage();
      else {
        resetForm();
        services.accountService.listAccounts().then(setAccounts).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this deposit.");
    } finally {
      setSaving(false);
    }
  }

  const clearZeroLines = () => setLines((current) => { const kept = current.filter((l) => cents(l.amount) > 0 || l.accountId || l.description); return kept.length >= 2 ? kept : [...kept, ...Array.from({ length: 2 - kept.length }, blankLine)]; });
  function exportCsv() {
    const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";
    const rows = [["Received From", "Account", "Description", "Payment Method", "Ref No.", "Amount"], ...lines.filter((l) => l.receivedFrom || l.accountId || l.amount).map((l) => [l.receivedFrom, name(l.accountId), l.description, l.method, l.refNo, l.amount])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(escape).join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "deposit-lines.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  // Paste From Excel: Received From, Account, Description, Payment Method, Ref No., Amount (tab or comma separated).
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split(/\r?\n/).filter((r) => r.trim()).map((r) => r.split(r.includes("\t") ? "\t" : ","));
      if (rows.length === 0) return toast({ variant: "info", title: "The clipboard is empty" });
      const next = rows.map(([from = "", account = "", description = "", method = "", refNo = "", amount = ""]) => ({
        ...blankLine(),
        receivedFrom: from.trim(),
        accountId: active.find((a) => a.name.toLowerCase() === account.trim().toLowerCase())?.id ?? "",
        description: description.trim(),
        method: method.trim(),
        refNo: refNo.trim(),
        amount: amount.replace(/[$,]/g, "").trim()
      }));
      while (next.length < 2) next.push(blankLine());
      setLines(next);
    } catch {
      toast({ variant: "error", title: "Couldn't read the clipboard", description: "Allow clipboard access and try again." });
    }
  }
  function addMethod() {
    const name = newMethod.trim();
    if (!name) return;
    methods.add(name);
    if (methodModalFor) updateLine(methodModalFor, { method: name });
    setNewMethod("");
    setMethodModalFor(null);
  }

  const toolbar = (
    <button type="button" onClick={exportCsv} className={`${RT_TOOLBAR_LINK} mr-2`}>Export To CSV</button>
  );

  const footer = (
    <>
      <div className="flex items-center gap-6">
        <button type="button" onClick={closePage} className="text-base font-medium text-[var(--color-text-global)] hover:underline">Cancel</button>
        <button type="button" onClick={resetForm} className="text-base font-medium text-[var(--color-text-global)] hover:underline">Clear</button>
      </div>
      <div className="flex items-center gap-4 text-base font-medium text-[var(--color-text-global)]">
        <button type="button" onClick={() => window.print()} className="hover:underline">Print</button>
        <button type="button" disabled title="Recurring deposits aren't available yet" className="cursor-not-allowed opacity-60">Make recurring</button>
      </div>
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
    </>
  );

  return (
    <FullScreenFormShell title="Bank Deposit" onClose={closePage} toolbar={toolbar} footer={footer}>
      <div className="px-6 pb-8 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-6 pb-6">
          <div className="flex flex-wrap items-start gap-6">
            <div className="w-[320px]">
              <span className={LABEL}>Account</span>
              <Select value={depositId} onChange={setDepositId} options={depositOptions} placeholder="Select account" allowCustomValue={false} onAddNew={() => setAccountModalFor("deposit")} addNewLabel="+ Add new" />
            </div>
            {depositAccount ? (
              <p className="self-center pt-5 text-sm"><strong className="text-[var(--color-text-global)]">Balance</strong> {money(depositAccount.currentBalance)}</p>
            ) : null}
            <div>
              <label className={LABEL} htmlFor="deposit-date">Date</label>
              <InputField id="deposit-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[200px]" />
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-[var(--color-text-global)]">Amount</p>
            <p className="text-5xl font-semibold text-[var(--color-text-global)]">{money(totalCents / 100)}</p>
          </div>
        </div>

        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="mb-3 flex items-center gap-3 text-2xl text-[var(--color-text-global)]">
          {open ? <ChevronDown className="h-6 w-6" aria-hidden="true" /> : <ChevronUp className="h-6 w-6" aria-hidden="true" />}
          Add funds to this deposit
        </button>

        {open ? (
          <section>
            <table className="w-full table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-6" />
                <col className="w-10" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col />
                <col className="w-[15%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
                  <th aria-hidden="true" />
                  <th className="px-2 py-3 text-center">#</th>
                  <th className="px-2 py-3">Received from</th>
                  <th className={`${CELL} py-3`}>Account</th>
                  <th className={`${CELL} py-3`}>Description</th>
                  <th className={`${CELL} py-3`}>Payment method</th>
                  <th className={`${CELL} py-3`}>Ref no.</th>
                  <th className={`${CELL} py-3 text-right`}>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id} className="border-b border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                    <td className="text-[var(--color-icon-muted)]"><GripVertical className="h-4 w-4" aria-hidden="true" /></td>
                    <td className="px-2 py-2 text-center">{index + 1}</td>
                    <td className="px-2 py-2"><Select value={line.receivedFrom} onChange={(v) => updateLine(line.id, { receivedFrom: v })} options={nameOptions} placeholder="" allowCustomValue={false} /></td>
                    <td className={CELL}><Select value={line.accountId} onChange={(v) => updateLine(line.id, { accountId: v })} options={lineAccountOptions} placeholder="" allowCustomValue={false} /></td>
                    <td className={CELL}><input value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} aria-label={`Line ${index + 1} description`} className={CELL_INPUT} /></td>
                    <td className={CELL}><Select value={line.method} onChange={(v) => updateLine(line.id, { method: v })} options={methods.options} placeholder="" allowCustomValue={false} onAddNew={() => setMethodModalFor(line.id)} addNewLabel="+ Add new" /></td>
                    <td className={CELL}><input value={line.refNo} onChange={(event) => updateLine(line.id, { refNo: event.target.value })} aria-label={`Line ${index + 1} ref no.`} className={CELL_INPUT} /></td>
                    <td className={CELL}><input type="number" min="0" step="0.01" value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} aria-label={`Line ${index + 1} amount`} className={`${CELL_INPUT} text-right`} /></td>
                    <td className="px-1 text-center">
                      <button type="button" aria-label="Delete line" onClick={() => setLines((current) => (current.length > 1 ? current.filter((l) => l.id !== line.id) : [blankLine()]))} className="text-[var(--color-text-global)] hover:text-[var(--color-negative)]"><Trash2 className="h-5 w-5" aria-hidden="true" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={PLAIN_BUTTON} onClick={() => setLines((current) => [...current, blankLine(), blankLine()])}>Add lines</button>
                <button type="button" className={PLAIN_BUTTON} onClick={() => setLines(startingLines())}>Clear all lines</button>
                <button type="button" className={RT_BUTTON} onClick={exportCsv}>Export CSV</button>
                <button type="button" className={RT_BUTTON} onClick={() => void pasteFromClipboard()}>Paste From Excel</button>
                <button type="button" className={RT_BUTTON} onClick={clearZeroLines}>Clear 0 Value Lines</button>
              </div>
              <p className="text-sm"><strong className="mr-6 text-[var(--color-text-global)]">Other funds total</strong>{money(otherFundsCents / 100)}</p>
            </div>
          </section>
        ) : null}

        <div className="mt-8 flex flex-wrap items-start justify-between gap-8">
          <div className="w-[520px] max-w-full space-y-8">
            <div>
              <label className={LABEL} htmlFor="deposit-memo">Memo</label>
              <textarea id="deposit-memo" value={memo} onChange={(event) => setMemo(event.target.value)} className={`${INPUT_BASE_CLASSES} h-40 resize-y rounded px-3 py-2 text-sm`} />
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                <button type="button" className={RT_LINK} onClick={() => { const names = [...new Set(lines.map((l) => l.receivedFrom).filter(Boolean))]; if (names.length) setMemo((m) => (m ? `${m} ${names.join(", ")}` : names.join(", "))); }}>Copy Names To Memo</button>
                <button type="button" className={`${RT_LINK} text-right`} disabled title="Tags aren't available yet">Copy Tags To Memo</button>
                <button type="button" className={RT_LINK} onClick={() => setMemo(lines.map((l) => l.description.trim()).filter(Boolean).join("; "))}>Copy Descriptions To Memo</button>
                <span />
                <button type="button" className={RT_LINK} onClick={() => setLines((current) => current.map((l) => ({ ...l, description: memo })))}>Copy Memo to Descriptions</button>
              </div>
            </div>
            <AttachmentsField attachments={attachments} formLabel="Bank Deposit" />
          </div>
          <div className="w-[720px] max-w-full">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-[240px]">
                <span className={LABEL}>Cash back goes to</span>
                <Select value={cashBackId} onChange={setCashBackId} options={cashBackOptions} placeholder="" allowCustomValue={false} onAddNew={() => setAccountModalFor("cashback")} addNewLabel="+ Add new" />
              </div>
              <div className="min-w-[160px] flex-1">
                <label className={LABEL} htmlFor="deposit-cb-memo">Cash back memo</label>
                <InputField id="deposit-cb-memo" value={cashBackMemo} onChange={(event) => setCashBackMemo(event.target.value)} />
              </div>
              <div className="w-[190px]">
                <label className={LABEL} htmlFor="deposit-cb-amount">Cash back amount</label>
                <InputField id="deposit-cb-amount" type="number" min="0" step="0.01" value={cashBackAmount} onChange={(event) => setCashBackAmount(event.target.value)} className="text-right" />
              </div>
            </div>
            <p className="mt-8 flex justify-end gap-24 text-lg"><strong className="text-[var(--color-text-global)]">Total</strong><span className="text-[var(--color-text-global)]">{money(totalCents / 100)}</span></p>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error}</p> : null}
        <p className="mt-6 text-center"><a href="https://www.intuit.com/privacy/" target="_blank" rel="noreferrer" className="text-[var(--color-link-action)] hover:underline">Privacy</a></p>
      </div>

      <AddAccountModal
        open={accountModalFor !== null}
        accounts={accounts}
        onClose={() => setAccountModalFor(null)}
        onSave={async (input) => {
          const created = await services.accountService.createAccount({ code: nextAccountCode(accounts), name: input.name, category: input.category, subtype: input.subtype, currency: "USD", openingBalance: input.openingBalance });
          setAccounts(await services.accountService.listAccounts());
          if (accountModalFor === "deposit") setDepositId(created.id);
          else if (accountModalFor === "cashback") setCashBackId(created.id);
          return created;
        }}
      />
      <Modal open={methodModalFor !== null} onClose={() => setMethodModalFor(null)} title="New payment method" size="sm">
        <InputField value={newMethod} onChange={(event) => setNewMethod(event.target.value)} placeholder="Payment method name" aria-label="Payment method name" autoFocus onKeyDown={(event) => event.key === "Enter" && addMethod()} />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setMethodModalFor(null)}>Cancel</Button>
          <Button onClick={addMethod} disabled={!newMethod.trim()}>Save</Button>
        </div>
      </Modal>
    </FullScreenFormShell>
  );
}
