"use client";

import { CANNOT_SHOW, formDetails, useSavedTransaction } from "@/lib/hooks/use-saved-transaction";
import { DateField } from "@/components/ui/date-field";
import { nextSalesReceiptNumber } from "@/lib/accounting/next-check-number";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, CircleHelp, Copy, GripVertical, Lock, LockOpen, Plus, Trash2 } from "lucide-react";
import { FullScreenFormShell, RT_TOOLBAR_LINK, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { ProductServicePanel } from "@/components/accounting/product-service-panel";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { PayeeSideModal } from "@/components/bank-register/payee-side-modal";
import { Button } from "@/components/ui/button";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { AttachmentsField } from "@/components/accounting/attachments-field";
import { useFormAttachments } from "@/lib/hooks/use-form-attachments";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { nextAccountCode } from "@/lib/accounting/next-account-code";
import { useCustomers } from "@/lib/hooks/use-customers";
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";
import { useProductsServices } from "@/lib/hooks/use-products-services";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

type Line = { id: string; productId: string; description: string; qty: string; rate: string; amount: string; locked: boolean; accountId?: string };

let lineCounter = 0;
const blankLine = (): Line => {
  lineCounter += 1;
  return { id: `receipt-line-${lineCounter}`, productId: "", description: "", qty: "", rate: "", amount: "", locked: false };
};
const startingLines = () => [blankLine(), blankLine()];

const DEPOSIT_CATEGORIES = new Set<Account["category"]>(["BANK", "OTHER_CURRENT_ASSET"]);
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const PLAIN_BUTTON = "rounded-md border border-[var(--color-button-border)] px-3 py-1.5 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const RT_BUTTON = "rounded-md border border-[var(--color-negative)] px-3 py-1.5 text-sm text-[var(--color-negative)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const CARD = "rounded-xl border border-[var(--color-container-border-secondary)] bg-[var(--color-container-background-primary)]";
const CARD_TITLE = "border-b border-[var(--color-divider-tertiary)] px-5 py-4 text-lg font-semibold text-[var(--color-text-global)]";
const CELL_INPUT = `${INPUT_BASE_CLASSES} h-9 rounded px-3 text-sm`;

const OUTLINE_BUTTON = "rounded-md border-2 border-[var(--color-ui-primary)] px-4 py-1.5 font-medium text-[var(--color-ui-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const FOOTER_LINK = "font-medium text-[var(--color-ui-primary)] hover:underline";

const cents = (value: string) => Math.round((Number(value) || 0) * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const lineAmount = (l: Line) => (l.amount === "" ? 0 : cents(l.amount));

// QBO's full-screen Sales Receipt (/salesreceipt?rtAccountId=...&rt=close).
// rtAccountId is the account the money is deposited to. Record posts a real
// sales receipt: the deposit account is debited, each line credits its
// product's income account.
export function SalesReceiptFormPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: customers, add: addCustomer } = useCustomers();
  const { items: products, add: addProduct } = useProductsServices();
  const methods = usePaymentMethods();
  const attachments = useFormAttachments();

  const txnId = params.get("txnId");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");
  const [ccOpen, setCcOpen] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [sendLater, setSendLater] = useState(false);
  const [number, setNumber] = useState("1001");
  const [charge, setCharge] = useState(false);
  // QBO shows lines as plain text; only the one being edited has input boxes.
  const [activeLineId, setActiveLineId] = useState<string | null>(null);
  const [detailsHidden, setDetailsHidden] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refNo, setRefNo] = useState("");
  const [method, setMethod] = useState("");
  const [depositId, setDepositId] = useState(params.get("rtAccountId") ?? "");
  const [billing, setBilling] = useState("");
  const [lines, setLines] = useState<Line[]>(startingLines);
  const [message, setMessage] = useState("");
  const [statement, setStatement] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [newMethod, setNewMethod] = useState("");
  const [addProductForLine, setAddProductForLine] = useState<string | null>(null);
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

  // ?txnId= opens a saved sales receipt to edit it (the register's "Edit").
  const { loaded, setLoaded, loadError } = useSavedTransaction(txnId, "SALES_RECEIPT", "a sales receipt", (txn) => {
    const debits = txn.postings.filter((p) => p.type === "DEBIT");
    const credits = txn.postings.filter((p) => p.type === "CREDIT");
    if (debits.length !== 1 || credits.length === 0) return CANNOT_SHOW;
    const d = txn.details ?? {};
    setDepositId(debits[0].accountId);
    setDate(txn.transactionDate);
    setCustomer(txn.payee ?? "");
    setEmail(d.email ?? "");
    setCc(d.cc ?? "");
    setBcc(d.bcc ?? "");
    setBilling(d.billing ?? "");
    setSendLater(d.sendLater === "1");
    setNumber(d.number ?? txn.referenceNumber ?? "");
    setRefNo(d.refNo ?? "");
    setMethod(txn.paymentMethod ?? "");
    // The register memo is the statement message. (Receipts saved earlier kept it the other way round.)
    setStatement(d.statement ?? txn.memo ?? "");
    setMessage(d.statement !== undefined ? txn.memo ?? "" : d.message ?? "");
    const next: Line[] = credits.map((p) => {
      // Qty x rate is only shown while it still agrees with the posted amount.
      const keepRate = cents(String(Number(p.details?.qty) * Number(p.details?.rate))) === cents(String(p.amount));
      return {
        ...blankLine(),
        accountId: p.accountId,
        productId: p.details?.productId ?? "",
        description: p.description ?? "",
        qty: keepRate ? p.details?.qty ?? "" : "",
        rate: keepRate ? p.details?.rate ?? "" : "",
        amount: p.amount.toFixed(2)
      };
    });
    while (next.length < 2) next.push(blankLine());
    setLines(next);
    void attachments.loadLinked(txn.id).catch(() => toast({ variant: "error", title: "Could not load the attachments" }));
  });
  const savedSourceId = txnId ? loaded?.postings.find((p) => p.type === "DEBIT")?.accountId : undefined;

  const depositAccounts = useMemo(() => accounts.filter((a) => a.id === savedSourceId || DEPOSIT_CATEGORIES.has(a.category)).sort((a, b) => a.name.localeCompare(b.name)), [accounts, savedSourceId]);
  const depositAccount = accounts.find((a) => a.id === depositId);
  useEffect(() => {
    if (txnId || accounts.length === 0 || depositAccount) return;
    if (depositAccounts[0]) setDepositId(depositAccounts[0].id);
  }, [txnId, accounts, depositAccount, depositAccounts]);

  const numberTyped = useRef(false);
  useEffect(() => {
    if (txnId || !depositId) return;
    let cancelled = false;
    services.registerService
      .listRegisterEntries(depositId)
      .then((entries) => {
        if (!cancelled && !numberTyped.current) setNumber(nextSalesReceiptNumber(entries));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [txnId, depositId, services]);

  const incomeAccounts = useMemo(() => accounts.filter((a) => a.category === "INCOME" || a.category === "OTHER_INCOME"), [accounts]);
  const customerRecord = customers.find((c) => c.name === customer);
  const customerOptions = useMemo(() => {
    const contacts = customers.map((c) => ({ value: c.name, label: c.name, rightLabel: "Customer" }));
    return customer && !contacts.some((c) => c.value === customer) ? [{ value: customer, label: customer, rightLabel: "" }, ...contacts] : contacts;
  }, [customers, customer]);
  const depositOptions = useMemo(() => depositAccounts.map((a) => ({ value: a.id, label: a.name })), [depositAccounts]);
  const activeProducts = useMemo(() => products.filter((p) => p.status === "ACTIVE"), [products]);
  const productOptions = useMemo(() => activeProducts.map((p) => ({ value: p.id, label: p.name, rightLabel: p.type === "SERVICE" ? "Service" : "Product" })), [activeProducts]);
  const incomeAccountOptions = useMemo(() => incomeAccounts.map((a) => ({ value: a.id, label: a.name })), [incomeAccounts]);
  const totalCents = lines.reduce((sum, l) => sum + lineAmount(l), 0);

  const closePage = () => leaveFormPage(router);
  function resetForm(nextNumber?: string) {
    setCustomer("");
    setEmail("");
    setCc("");
    setBcc("");
    setSendLater(false);
    setRefNo("");
    setMethod("");
    setBilling("");
    setLines(startingLines());
    setMessage("");
    setStatement("");
    attachments.reset();
    setError(null);
    if (nextNumber) setNumber(nextNumber);
  }
  const updateLine = (id: string, patch: Partial<Line>) => setLines((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  // Qty x rate drives the amount whenever both are filled; the amount can still be typed directly.
  function editQtyRate(line: Line, patch: Partial<Pick<Line, "qty" | "rate">>) {
    const next = { ...line, ...patch };
    const computed = next.qty !== "" && next.rate !== "" ? ((Number(next.qty) || 0) * (Number(next.rate) || 0)).toFixed(2) : line.amount;
    updateLine(line.id, { ...patch, amount: computed });
  }
  function pickProduct(line: Line, productId: string) {
    const product = activeProducts.find((p) => p.id === productId);
    if (!product) return updateLine(line.id, { productId: "" });
    // A new product brings its own income account.
    updateLine(line.id, { accountId: undefined });
    const rate = product.salesPrice !== undefined ? String(product.salesPrice) : line.rate;
    const qty = line.qty || (product.salesPrice !== undefined ? "1" : "");
    updateLine(line.id, { productId, description: line.description || product.description || product.name, qty, rate, amount: qty !== "" && rate !== "" ? ((Number(qty) || 0) * (Number(rate) || 0)).toFixed(2) : line.amount });
  }
  function onCustomerChange(name: string) {
    setCustomer(name);
    const record = customers.find((c) => c.name === name);
    if (record?.email) setEmail(record.email);
  }

  async function save(after: "stay" | "close" | "new") {
    setMenuOpen(false);
    if (!depositAccount) return setError("Choose the account to deposit to.");
    if (!date) return setError("Enter the sales receipt date.");
    const used = lines.filter((l) => l.productId || lineAmount(l) > 0);
    if (used.length === 0) return setError("Add at least one line with a product/service and an amount.");
    if (used.some((l) => lineAmount(l) <= 0)) return setError("Every line needs an amount above zero.");
    // Each line credits its product's income account; lines without a product use the first income account.
    const fallbackIncome = incomeAccounts[0];
    const postedLines = used.map((l) => ({
      line: l,
      accountId: l.accountId ?? activeProducts.find((p) => p.id === l.productId)?.incomeAccountId ?? fallbackIncome?.id ?? ""
    }));
    if (postedLines.some((l) => !l.accountId)) return setError("Add an income account to the chart of accounts first.");
    const creditAccounts = [...new Set(postedLines.map((l) => l.accountId))];
    setSaving(true);
    setError(null);
    try {
      const total = used.reduce((sum, l) => sum + lineAmount(l), 0) / 100;
      if (txnId && !loaded) throw new Error(loadError ?? "This transaction is still loading.");
      const body = {
        paymentMethod: method || undefined,
        details: formDetails({ email, cc, bcc, billing, message, number, refNo, sendLater: sendLater ? "1" : "" }),
        transactionDate: date,
        referenceNumber: refNo.trim() || number,
        memo: statement.trim() || undefined,
        payee: customer.trim() || undefined,
        accountLabel: creditAccounts.length > 1 ? "Split" : accounts.find((a) => a.id === creditAccounts[0])?.name ?? "",
        sourceAccountId: depositAccount.id,
        postings: [
          { accountId: depositAccount.id, type: "DEBIT" as const, amount: total },
          ...postedLines.map(({ line, accountId }) => ({
            accountId,
            type: "CREDIT" as const,
            amount: lineAmount(line) / 100,
            description: line.description.trim() || undefined,
            details: formDetails({ productId: line.productId, qty: line.qty, rate: line.rate })
          }))
        ]
      };
      if (loaded) {
        setLoaded(await services.transactionService.updateTransaction(loaded.id, body));
        await attachments.linkTo(loaded.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
        await attachments.loadLinked(loaded.id).catch(() => undefined);
        toast({ variant: "success", title: "Sales receipt saved" });
        if (after === "new") window.location.assign("/salesreceipt");
        else if (after === "close") closePage();
        else services.accountService.listAccounts().then(setAccounts).catch(() => undefined);
        return;
      }
      const created = await services.transactionService.createTransaction({ ...body, type: "SALES_RECEIPT" });
      await services.transactionService.postTransaction(created.id);
      await attachments.linkTo(created.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      const following = /^\d+$/.test(number.trim()) ? String(Number(number) + 1) : number;
      numberTyped.current = false;
      toast({ variant: "success", title: "Sales receipt recorded" });
      if (after === "close") closePage();
      else {
        resetForm(following);
        services.accountService.listAccounts().then(setAccounts).catch(() => undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this sales receipt.");
    } finally {
      setSaving(false);
    }
  }

  const clearZeroLines = () => setLines((current) => { const kept = current.filter((l) => lineAmount(l) > 0 || l.productId || l.description); return kept.length >= 2 ? kept : [...kept, ...Array.from({ length: 2 - kept.length }, blankLine)]; });
  function exportCsv() {
    const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const name = (id: string) => products.find((p) => p.id === id)?.name ?? "";
    const rows = [["Product/Service", "Description", "Qty", "Rate", "Amount"], ...lines.filter((l) => l.productId || l.description || l.amount).map((l) => [name(l.productId), l.description, l.qty, l.rate, l.amount])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(escape).join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales-receipt-lines.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  // Paste Excel: reads tab/comma rows from the clipboard as Product/Service, Description, Qty, Rate.
  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      const rows = text.split(/\r?\n/).filter((r) => r.trim()).map((r) => r.split(r.includes("\t") ? "\t" : ","));
      if (rows.length === 0) return toast({ variant: "info", title: "The clipboard is empty" });
      const next = rows.map(([product = "", description = "", qty = "", rate = ""]) => {
        const match = activeProducts.find((p) => p.name.toLowerCase() === product.trim().toLowerCase());
        const q = qty.replace(/[$,]/g, "").trim();
        const r = rate.replace(/[$,]/g, "").trim();
        return { ...blankLine(), productId: match?.id ?? "", description: description.trim() || (match ? "" : product.trim()), qty: q, rate: r, amount: q && r ? ((Number(q) || 0) * (Number(r) || 0)).toFixed(2) : "" };
      });
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
    setMethod(name);
    setNewMethod("");
    setMethodModalOpen(false);
  }

  const toolbar = (
    <>
      <button type="button" onClick={exportCsv} className={RT_TOOLBAR_LINK}>Export CSV</button>
      <button type="button" onClick={() => void pasteFromClipboard()} className={`${RT_TOOLBAR_LINK} mr-2`}>Paste Excel</button>
    </>
  );

  const divider = <span className="h-8 w-px bg-[var(--color-divider-tertiary)]" aria-hidden="true" />;
  const footer = (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-6 text-base">
      <button type="button" onClick={closePage} className={FOOTER_LINK}>Cancel</button>
      {txnId ? null : <button type="button" onClick={() => resetForm()} className={FOOTER_LINK}>Clear</button>}
      <button type="button" onClick={() => window.print()} className={FOOTER_LINK}>Print or Preview</button>
      {divider}
      <button type="button" disabled title="Customizing the form isn't available yet" className={`${FOOTER_LINK} cursor-not-allowed opacity-60`}>Customize</button>
      {divider}
      <button type="button" disabled title="More options aren't available yet" className={`${FOOTER_LINK} cursor-not-allowed opacity-60`}>More</button>
      <button type="button" disabled={saving || Boolean(txnId && !loaded)} onClick={() => void save("stay")} className={`${OUTLINE_BUTTON} disabled:opacity-50`}>Record</button>
      <div ref={menuRef} className="relative inline-flex">
        <Button variant="primary" className="!rounded-l-md !rounded-r-none" disabled={saving || Boolean(txnId && !loaded)} onClick={() => void save("close")}>{saving ? "Recording..." : "Record and close"}</Button>
        <Button variant="primary" className="!rounded-l-none !rounded-r-md border-l border-l-white/30 !min-w-0 px-2" aria-label="More record options" disabled={saving || Boolean(txnId && !loaded)} onClick={() => setMenuOpen((v) => !v)}>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Button>
        {menuOpen ? (
          <div className="absolute bottom-full right-0 mb-1 w-44 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
            <button type="button" onClick={() => void save(txnId ? "new" : "stay")} className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Record and new</button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <FullScreenFormShell title={<><span className="font-semibold">{`Sales Receipt # ${number}`}</span> {loaded?.reconcileStatus === "R" ? <span className="text-lg text-[var(--color-negative)]">(Reconciled)</span> : null}</>} onClose={closePage} toolbar={toolbar} footer={footer}>
      <div className="px-6 pb-8 pt-5">
        <div className="flex flex-wrap items-start gap-6">
          <div className="w-[340px]">
            <span className={LABEL}>Customer</span>
            <Select value={customer} onChange={onCustomerChange} options={customerOptions} placeholder="Choose a customer" allowCustomValue={false} onAddNew={() => setCustomerModalOpen(true)} addNewLabel="+ Add new" />
            {customerRecord ? (
              <button type="button" onClick={() => window.open(`/customerdetail?nameId=${encodeURIComponent(customerRecord.id)}`, "_blank")} className="mt-1 block text-sm font-medium text-[var(--color-negative)] underline hover:no-underline">Payee Details</button>
            ) : null}
          </div>
          <div className="w-[400px]">
            <div className="flex items-baseline justify-between">
              <label htmlFor="receipt-email" className={LABEL}>Email</label>
              <button type="button" onClick={() => setCcOpen((v) => !v)} className="text-sm text-[var(--color-link-action)] hover:underline">Cc/Bcc</button>
            </div>
            <InputField id="receipt-email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email (Separate emails with a comma)" />
            {ccOpen ? (
              <div className="mt-2 space-y-2">
                <InputField value={cc} onChange={(event) => setCc(event.target.value)} placeholder="Cc" aria-label="Cc" />
                <InputField value={bcc} onChange={(event) => setBcc(event.target.value)} placeholder="Bcc" aria-label="Bcc" />
              </div>
            ) : null}
            <label className="mt-2 flex cursor-pointer items-center gap-3 text-base">
              <input type="checkbox" checked={sendLater} onChange={(event) => setSendLater(event.target.checked)} className="h-5 w-5 rounded accent-[var(--color-ui-primary)]" />
              Send later
            </label>
          </div>
          <div className="w-[140px]">
            <label htmlFor="receipt-number" className={LABEL}>Sales Receipt no.</label>
            <InputField id="receipt-number" value={number} onChange={(event) => { numberTyped.current = true; setNumber(event.target.value); }} />
          </div>
          <label className="flex cursor-pointer items-center gap-2 self-center pt-4 text-base font-semibold text-[var(--color-negative)]">
            {detailsHidden ? "Show Details" : "Hide Details"}
            <input type="checkbox" checked={detailsHidden} onChange={(event) => setDetailsHidden(event.target.checked)} className="h-5 w-5 rounded accent-[var(--color-negative)]" />
          </label>
          <div className="ml-auto text-right">
            <p className="text-xs font-semibold uppercase text-[var(--color-text-global)]">Amount</p>
            <p className="text-5xl font-semibold text-[var(--color-text-global)]">{money(totalCents / 100)}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-start gap-6">
          <section className={`${CARD} w-[870px] max-w-full`}>
            <h2 className={CARD_TITLE}>
              Record or charge
            </h2>
            <div className="flex flex-wrap gap-8 px-5 py-6">
              <div className="w-[300px] space-y-5">
                <label className="flex gap-3">
                  <input type="radio" name="receipt-mode" checked={!charge} onChange={() => setCharge(false)} className="mt-1.5 h-5 w-5 accent-[var(--color-ui-primary)]" />
                  <span><span className="block text-lg text-[var(--color-text-global)]">Record payment</span><span className="text-base">Received via check, cash, other</span></span>
                </label>
                <label className="flex cursor-pointer gap-3">
                  <input type="radio" name="receipt-mode" checked={charge} onChange={() => setCharge(true)} className="mt-1.5 h-5 w-5 accent-[var(--color-ui-primary)]" />
                  <span>
                    <span className="flex items-center gap-2 text-lg text-[var(--color-text-global)]">Charge new payment <CircleHelp className="h-5 w-5 text-[var(--color-icon-secondary)]" aria-hidden="true" /></span>
                    <span className="text-base">Process a card or ACH bank transfer</span>
                    <span className="mt-3 flex gap-1.5 text-[10px] font-bold">
                      {["VISA", "MC", "DISCOVER", "BANK"].map((b) => <span key={b} className="rounded border border-[var(--color-divider-tertiary)] px-1.5 py-1">{b}</span>)}
                    </span>
                  </span>
                </label>
              </div>
              {charge ? (
                <div className="flex-1 rounded-xl bg-[var(--color-container-background-accent)] p-8" style={{ minWidth: 420 }}>
                  <h3 className="text-xl font-semibold text-[var(--color-text-global)]">Process payments on open invoices</h3>
                  <p className="mt-3 max-w-xl text-lg">Charge debit and credit cards or process ACH bank payments. Your books update automatically when you get paid through QuickBooks. <a href="https://quickbooks.intuit.com/payments/" target="_blank" rel="noreferrer" className="text-[var(--color-link-action)] hover:underline">Find out more</a></p>
                  <button type="button" disabled title="Payments aren't available yet" className="mt-6 cursor-not-allowed rounded-md border-2 border-[var(--color-ui-primary)] px-5 py-2.5 text-xl text-[var(--color-ui-primary)] opacity-70">Activate payments</button>
                </div>
              ) : (
              <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3" style={{ minWidth: 520 }}>
                  <div>
                    <label htmlFor="receipt-date" className={LABEL}>Sales Receipt Date</label>
                    <DateField id="receipt-date" value={date} onChange={setDate} />
                  </div>
                  <div>
                    <label htmlFor="receipt-ref" className={LABEL}>Reference no.</label>
                    <InputField id="receipt-ref" value={refNo} onChange={(event) => setRefNo(event.target.value)} />
                  </div>
                  <div>
                    <span className={LABEL}>Payment method</span>
                    <Select value={method} onChange={setMethod} options={methods.options} placeholder="Select method" allowCustomValue={false} onAddNew={() => setMethodModalOpen(true)} addNewLabel="+ Add new" />
                  </div>
                  <div>
                    <span className={LABEL}>Deposit To</span>
                    <Select value={depositId} onChange={setDepositId} options={depositOptions} placeholder="Select account" allowCustomValue={false} onAddNew={() => setAccountModalOpen(true)} addNewLabel="+ Add new" />
                  </div>
                </div>
              )}
            </div>
          </section>
          {!detailsHidden ? (
            <section className={`${CARD} w-[595px] max-w-full`}>
              <h2 className={CARD_TITLE}>Addresses</h2>
              <div className="px-5 py-5">
                <label htmlFor="receipt-billing" className={LABEL}>Billing Address</label>
                <textarea id="receipt-billing" value={billing} onChange={(event) => setBilling(event.target.value)} className={`${INPUT_BASE_CLASSES} h-[122px] resize-none rounded px-3 py-2 text-sm`} />
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <section className="bg-[var(--color-container-background-primary)] px-6 pb-8 pt-8">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-6" />
            <col className="w-10" />
            <col className="w-[27%]" />
            <col />
            <col className="w-[10%]" />
            <col className="w-[12%]" />
            <col className="w-[14%]" />
            <col className="w-12" />
          </colgroup>
          <thead>
            <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
              <th aria-hidden="true" />
              <th className="px-2 py-3 text-center">#</th>
              <th className="px-2 py-3">Product/Service</th>
              <th className="border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-3">Description</th>
              <th className="border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-3 text-right">Qty</th>
              <th className="border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-3 text-right">Rate</th>
              <th className="border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-3 text-right">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.id} onClick={() => setActiveLineId(line.id)} onFocus={() => setActiveLineId(line.id)} className="group h-[53px] border-b border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                <td className="relative text-[var(--color-icon-muted)]">
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                  <button type="button" aria-label="Insert line below" onClick={() => setLines((current) => { const i = current.findIndex((l) => l.id === line.id); return [...current.slice(0, i + 1), blankLine(), ...current.slice(i + 1)]; })} className="absolute left-0 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[#1b3a2f] text-white group-hover:flex"><Plus className="h-4 w-4" aria-hidden="true" /></button>
                </td>
                <td className="relative px-2 py-2 text-center">
                  <span className="group-hover:invisible">{index + 1}</span>
                  <span className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 flex-col gap-1 text-[var(--color-negative)] group-hover:flex">
                    <button type="button" aria-label={line.locked ? "Unlock line" : "Lock line"} onClick={() => updateLine(line.id, { locked: !line.locked })}>{line.locked ? <Lock className="h-5 w-5" aria-hidden="true" /> : <LockOpen className="h-5 w-5" aria-hidden="true" />}</button>
                    <button type="button" aria-label="Duplicate line" onClick={() => setLines((current) => { const i = current.findIndex((l) => l.id === line.id); return [...current.slice(0, i + 1), { ...line, id: blankLine().id }, ...current.slice(i + 1)]; })}><Copy className="h-5 w-5" aria-hidden="true" /></button>
                  </span>
                </td>
                <td className="px-2 py-2">
                  {activeLineId === line.id ? <Select value={line.productId} onChange={(v) => pickProduct(line, v)} options={productOptions} placeholder="" allowCustomValue={false} disabled={line.locked} onAddNew={() => setAddProductForLine(line.id)} addNewLabel="+ Add new" /> : <button type="button" aria-label={`Line ${index + 1} product`} onClick={() => setActiveLineId(line.id)} className="block min-h-9 w-full truncate px-3 text-left">{products.find((p) => p.id === line.productId)?.name ?? accounts.find((a) => a.id === line.accountId)?.name}</button>}
                </td>
                <td className="border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-2">
                  {activeLineId === line.id ? <input value={line.description} readOnly={line.locked} onChange={(event) => updateLine(line.id, { description: event.target.value })} aria-label={`Line ${index + 1} description`} className={CELL_INPUT} /> : <button type="button" aria-label={`Line ${index + 1} description`} onClick={() => setActiveLineId(line.id)} className="block min-h-9 w-full truncate px-3 text-left">{line.description}</button>}
                </td>
                <td className="border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-2">
                  {activeLineId === line.id ? <input type="number" min="0" step="any" value={line.qty} readOnly={line.locked} onChange={(event) => editQtyRate(line, { qty: event.target.value })} aria-label={`Line ${index + 1} quantity`} className={`${CELL_INPUT} text-right`} /> : <button type="button" aria-label={`Line ${index + 1} quantity`} onClick={() => setActiveLineId(line.id)} className="block min-h-9 w-full truncate px-3 text-right">{line.qty}</button>}
                </td>
                <td className="border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-2">
                  {activeLineId === line.id ? <input type="number" min="0" step="0.01" value={line.rate} readOnly={line.locked} onChange={(event) => editQtyRate(line, { rate: event.target.value })} aria-label={`Line ${index + 1} rate`} className={`${CELL_INPUT} text-right`} /> : <button type="button" aria-label={`Line ${index + 1} rate`} onClick={() => setActiveLineId(line.id)} className="block min-h-9 w-full truncate px-3 text-right">{line.rate}</button>}
                </td>
                <td className="border-l border-dotted border-[var(--color-divider-tertiary)] px-2 py-2">
                  {activeLineId === line.id ? <input type="number" min="0" step="0.01" value={line.amount} readOnly={line.locked} onChange={(event) => updateLine(line.id, { amount: event.target.value })} aria-label={`Line ${index + 1} amount`} className={`${CELL_INPUT} text-right`} /> : <button type="button" aria-label={`Line ${index + 1} amount`} onClick={() => setActiveLineId(line.id)} className="block min-h-9 w-full truncate px-3 text-right">{line.amount === "" ? "" : money(cents(line.amount) / 100)}</button>}
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
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className={PLAIN_BUTTON} onClick={() => setLines((current) => [...current, blankLine(), blankLine()])}>Add lines</button>
          <button type="button" className={PLAIN_BUTTON} onClick={() => setLines(startingLines())}>Clear all lines</button>
          <button type="button" className={RT_BUTTON} onClick={clearZeroLines}>Clear 0 Value Lines</button>
        </div>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-8">
          <div className="w-[460px] max-w-full space-y-6">
            <div>
              <label htmlFor="receipt-message" className={LABEL}>Message displayed on sales receipt</label>
              <textarea id="receipt-message" value={message} onChange={(event) => setMessage(event.target.value)} className={`${INPUT_BASE_CLASSES} h-[122px] resize-none rounded px-3 py-2 text-sm`} />
            </div>
            <div>
              <label htmlFor="receipt-statement" className={LABEL}>Message displayed on statement</label>
              <textarea id="receipt-statement" value={statement} onChange={(event) => setStatement(event.target.value)} className={`${INPUT_BASE_CLASSES} h-[122px] resize-none rounded px-3 py-2 text-sm`} />
            </div>
          </div>
          <dl className="w-[565px] max-w-full space-y-6 text-lg text-[var(--color-text-global)]">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(totalCents / 100)}</dd></div>
            <div className="text-right"><button type="button" disabled title="Sales tax isn't available yet" className="cursor-not-allowed text-base text-[var(--color-link-action)] opacity-70">Add sales tax</button></div>
            <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{money(totalCents / 100)}</dd></div>
            <div className="flex justify-between"><dt>Amount received</dt><dd>{money(totalCents / 100)}</dd></div>
            <div className="flex justify-between border-t border-[var(--color-divider-tertiary)] pt-6 font-semibold"><dt>Balance due</dt><dd>{money(0)}</dd></div>
          </dl>
        </div>

        <div className="mt-8 w-[660px] max-w-full">
          <AttachmentsField attachments={attachments} formLabel="Sales Receipt" />
        </div>
        <p className="mt-6 text-center"><a href="https://www.intuit.com/privacy/" target="_blank" rel="noreferrer" className="text-[var(--color-link-action)] hover:underline">Privacy</a></p>
        {error ?? loadError ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error ?? loadError}</p> : null}
      </section>

      <PayeeSideModal
        open={customerModalOpen}
        onClose={() => setCustomerModalOpen(false)}
        onSave={(created) => {
          addCustomer({ name: created.name }).then(() => setCustomer(created.name)).catch((err) => toast({ variant: "error", title: "Could not add customer", description: err instanceof Error ? err.message : undefined }));
        }}
      />
      <ProductServicePanel
        open={addProductForLine !== null}
        incomeAccountOptions={incomeAccountOptions}
        onClose={() => setAddProductForLine(null)}
        onSave={async (input) => {
          const created = await addProduct(input);
          const line = lines.find((l) => l.id === addProductForLine);
          if (line) updateLine(line.id, { productId: created.id, description: line.description || created.description || created.name, ...(created.salesPrice !== undefined ? { qty: line.qty || "1", rate: String(created.salesPrice), amount: ((Number(line.qty || 1) || 0) * created.salesPrice).toFixed(2) } : {}) });
          toast({ variant: "success", title: `"${created.name}" added to Products & Services` });
        }}
      />
      <AddAccountModal
        open={accountModalOpen}
        accounts={accounts}
        onClose={() => setAccountModalOpen(false)}
        onSave={async (input) => {
          const created = await services.accountService.createAccount({ code: nextAccountCode(accounts), name: input.name, category: input.category, subtype: input.subtype, currency: "USD", openingBalance: input.openingBalance });
          setAccounts(await services.accountService.listAccounts());
          setDepositId(created.id);
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
    </FullScreenFormShell>
  );
}
