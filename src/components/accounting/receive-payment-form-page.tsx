"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AttachmentsField } from "@/components/accounting/attachments-field";
import { FullScreenFormShell, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { CHECKBOX, ListCount, ListTools, NO_APPLY, PAYMENT_BOX, RT_BUTTON, SECTION_TITLE, TD, TH } from "@/components/accounting/payment-form-parts";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { nextAccountCode } from "@/lib/accounting/next-account-code";
import { findReceivableAccount, unappliedPayments } from "@/lib/accounting/receivables";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFormAttachments } from "@/lib/hooks/use-form-attachments";
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";
import { CANNOT_SHOW, useSavedTransaction } from "@/lib/hooks/use-saved-transaction";
import { listInvoices, payInvoice } from "@/lib/services/invoices-service";
import type { Invoice } from "@/lib/services/invoices-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

const DEPOSIT_CATEGORIES = new Set<Account["category"]>(["BANK", "OTHER_CURRENT_ASSET"]);
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const CARD = "rounded-xl border border-[var(--color-container-border-secondary)] bg-[var(--color-container-background-primary)]";
const CARD_TITLE = "border-b border-[var(--color-divider-tertiary)] px-5 py-4 text-lg text-[var(--color-text-global)]";

const cents = (value: number | string) => Math.round((Number(value) || 0) * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const usDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

// QBO's full-screen Receive Payment (/recvpayment?rtAccountId=...&rt=close).
// rtAccountId is the account the money lands in. Record pays each ticked open
// invoice in full (the ledger has no partial payments) and keeps anything left
// over as an unapplied payment: deposit account debited, receivables credited.
// ?txnId= edits a saved payment; the invoices it paid stay as they are.
export function ReceivePaymentFormPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: customers } = useCustomers();
  const methods = usePaymentMethods();
  const attachments = useFormAttachments();
  const txnId = params.get("txnId");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [headerHidden, setHeaderHidden] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [creditSearch, setCreditSearch] = useState("");
  const [customer, setCustomer] = useState("");
  const [charge, setCharge] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refNo, setRefNo] = useState("");
  const [method, setMethod] = useState("");
  const [depositId, setDepositId] = useState(params.get("rtAccountId") ?? "");
  const [amount, setAmount] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findNo, setFindNo] = useState("");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [newMethod, setNewMethod] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const reload = () => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
    listInvoices()
      .then((items) => {
        setInvoices(items);
        setInvoicesLoaded(true);
      })
      .catch(() => setError("Could not load invoices."));
    services.transactionService.listTransactions().then(setTransactions).catch(() => setTransactions([]));
  };
  useEffect(reload, [services]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  // ?txnId= opens a saved payment to edit it (the register's "Edit").
  const { loaded, setLoaded, loadError } = useSavedTransaction(txnId, "RECEIVE_PAYMENT", "a received payment", (txn) => {
    const debits = txn.postings.filter((p) => p.type === "DEBIT");
    const credits = txn.postings.filter((p) => p.type === "CREDIT");
    if (debits.length !== 1 || credits.length !== 1) return CANNOT_SHOW;
    setDepositId(debits[0].accountId);
    setDate(txn.transactionDate);
    setCustomer(txn.payee ?? "");
    setRefNo(txn.referenceNumber ?? "");
    setMethod(txn.paymentMethod ?? "");
    setMemo(txn.memo ?? "");
    setAmount(debits[0].amount.toFixed(2));
    void attachments.loadLinked(txn.id).catch(() => toast({ variant: "error", title: "Could not load the attachments" }));
  });
  const savedSourceId = loaded?.postings.find((p) => p.type === "DEBIT")?.accountId;
  // The invoices this saved payment paid. While there are any, its amount and customer are fixed.
  const paidByThis = useMemo(() => (txnId ? invoices.filter((i) => i.paymentTransactionId === txnId) : []), [txnId, invoices]);
  const amountLocked = Boolean(txnId) && (!invoicesLoaded || paidByThis.length > 0);

  const depositAccounts = useMemo(() => accounts.filter((a) => a.id === savedSourceId || (a.status === "ACTIVE" && DEPOSIT_CATEGORIES.has(a.category))).sort((a, b) => a.name.localeCompare(b.name)), [accounts, savedSourceId]);
  const depositAccount = accounts.find((a) => a.id === depositId);
  useEffect(() => {
    if (txnId || accounts.length === 0 || depositAccount) return;
    if (depositAccounts[0]) setDepositId(depositAccounts[0].id);
  }, [txnId, accounts, depositAccount, depositAccounts]);

  const customerRecord = customers.find((c) => c.name === customer);
  const customerOptions = useMemo(() => {
    const contacts = customers.map((c) => ({ value: c.name, label: c.name, rightLabel: "Customer" }));
    return customer && !contacts.some((c) => c.value === customer) ? [{ value: customer, label: customer, rightLabel: "" }, ...contacts] : contacts;
  }, [customers, customer]);
  const depositOptions = useMemo(() => depositAccounts.map((a) => ({ value: a.id, label: a.name })), [depositAccounts]);
  const methodOptions = useMemo(() => (method && !methods.options.some((o) => o.value === method) ? [{ value: method, label: method }, ...methods.options] : methods.options), [method, methods.options]);
  // Oldest due first: that's the order a typed amount is applied in.
  const open = useMemo(() => invoices.filter((i) => i.status === "OPEN" && i.customerId === customerRecord?.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [invoices, customerRecord]);
  const appliedIds = useMemo(() => new Set(invoices.flatMap((i) => (i.paymentTransactionId ? [i.paymentTransactionId] : []))), [invoices]);
  const allCredits = useMemo(() => (invoicesLoaded ? unappliedPayments(transactions, accounts, appliedIds, customer) : []), [invoicesLoaded, transactions, accounts, appliedIds, customer]);
  const credits = allCredits.filter((c) => c.id !== txnId);
  const customerBalance = open.reduce((sum, i) => sum + cents(i.amount), 0) - allCredits.reduce((sum, c) => sum + cents(c.amount), 0);

  const search = invoiceSearch.trim().toLowerCase();
  const rows = [...paidByThis, ...open].filter((i) => !search || (i.invoiceNumber ?? "").toLowerCase().includes(search));
  const creditRows = credits.filter((c) => !creditSearch.trim() || usDate(c.date).includes(creditSearch.trim()));
  const selected = txnId ? paidByThis : open.filter((i) => picked.has(i.id));
  const appliedCents = selected.reduce((sum, i) => sum + cents(i.amount), 0);
  const creditCents = Math.max(0, cents(amount) - appliedCents);

  const closePage = () => leaveFormPage(router);
  function chooseCustomer(name: string) {
    setCustomer(name);
    setPicked(new Set());
    setAmount("");
  }
  function pick(next: Set<string>) {
    setPicked(next);
    const total = open.filter((i) => next.has(i.id)).reduce((sum, i) => sum + cents(i.amount), 0);
    setAmount(total > 0 ? (total / 100).toFixed(2) : "");
  }
  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    pick(next);
  }
  function typeAmount(value: string) {
    setAmount(value);
    if (txnId) return;
    let left = cents(value);
    const next = new Set<string>();
    for (const i of open) {
      if (cents(i.amount) <= left) {
        next.add(i.id);
        left -= cents(i.amount);
      }
    }
    setPicked(next);
  }
  function findInvoice() {
    const wanted = findNo.trim().toLowerCase();
    const match = invoices.find((i) => i.status === "OPEN" && (i.invoiceNumber ?? "").toLowerCase() === wanted);
    if (!match) return toast({ variant: "error", title: wanted ? `No open invoice numbered ${findNo.trim()}` : "Enter an invoice number" });
    const owner = customers.find((c) => c.id === match.customerId);
    if (!owner) return toast({ variant: "error", title: "That invoice's customer wasn't found" });
    setCustomer(owner.name);
    setPicked(new Set([match.id]));
    setAmount(match.amount.toFixed(2));
    setFindOpen(false);
    setFindNo("");
  }
  const copyDetailsToMemo = () => setMemo(selected.map((i) => `Invoice${i.invoiceNumber ? ` # ${i.invoiceNumber}` : ""} ${money(i.amount)}`).join("; "));
  function resetForm() {
    setCustomer("");
    setRefNo("");
    setMethod("");
    setAmount("");
    setPicked(new Set());
    setMemo("");
    attachments.reset();
    setError(null);
  }

  /** The invoices API posts a bare payment; this puts the form's own fields on it. */
  async function addFormFields(transactionId: string): Promise<Transaction> {
    const txn = await services.transactionService.getTransactionById(transactionId);
    if (!refNo.trim() && !memo.trim() && !method) return txn;
    return services.transactionService.updateTransaction(txn.id, {
      transactionDate: txn.transactionDate,
      dueDate: txn.dueDate,
      referenceNumber: refNo.trim() || txn.referenceNumber,
      memo: memo.trim() || txn.memo,
      payee: txn.payee,
      accountLabel: txn.accountLabel,
      sourceAccountId: depositId,
      paymentMethod: method || undefined,
      details: txn.details,
      postings: txn.postings
    });
  }

  async function saveExisting(after: "stay" | "close" | "new") {
    if (!loaded) return setError(loadError ?? "This transaction is still loading.");
    if (!depositAccount) return setError("Choose the account to deposit to.");
    if (!date) return setError("Enter the payment date.");
    const debit = loaded.postings.find((p) => p.type === "DEBIT")!;
    const credit = loaded.postings.find((p) => p.type === "CREDIT")!;
    const total = amountLocked ? debit.amount : cents(amount) / 100;
    if (total <= 0) return setError("Enter the amount received.");
    setSaving(true);
    setError(null);
    try {
      setLoaded(
        await services.transactionService.updateTransaction(loaded.id, {
          transactionDate: date,
          dueDate: loaded.dueDate,
          referenceNumber: refNo.trim() || undefined,
          memo: memo.trim() || undefined,
          payee: customer.trim() || undefined,
          accountLabel: loaded.accountLabel,
          sourceAccountId: depositAccount.id,
          paymentMethod: method || undefined,
          details: loaded.details,
          postings: [
            { ...debit, accountId: depositAccount.id, amount: total },
            { ...credit, amount: total }
          ]
        })
      );
      await attachments.linkTo(loaded.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      await attachments.loadLinked(loaded.id).catch(() => undefined);
      toast({ variant: "success", title: "Payment saved" });
      if (after === "new") window.location.assign("/recvpayment");
      else if (after === "close") closePage();
      else reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this payment.");
    } finally {
      setSaving(false);
    }
  }

  async function save(after: "stay" | "close" | "new") {
    setMenuOpen(false);
    if (txnId) return saveExisting(after);
    if (!depositAccount) return setError("Choose the account to deposit to.");
    if (!customerRecord) return setError("Choose a customer.");
    if (!date) return setError("Enter the payment date.");
    if (cents(amount) <= 0) return setError("Enter the amount received.");
    if (cents(amount) < appliedCents) return setError(`The amount received must cover whole invoices (selected invoices total ${money(appliedCents / 100)}). Partial payments aren't supported yet.`);
    setSaving(true);
    setError(null);
    try {
      let last: Transaction | undefined;
      for (const invoice of selected) {
        const paid = await payInvoice(invoice.id, { depositAccountId: depositAccount.id, paymentDate: date });
        if (paid.paymentTransactionId) last = await addFormFields(paid.paymentTransactionId);
      }
      if (creditCents > 0) {
        let receivableId = last?.postings.find((p) => p.type === "CREDIT")?.accountId ?? findReceivableAccount(accounts)?.id;
        if (!receivableId) {
          receivableId = (await services.accountService.createAccount({ code: nextAccountCode(accounts), name: "Accounts Receivable", category: "ACCOUNTS_RECEIVABLE", currency: "USD" })).id;
        }
        const created = await services.transactionService.createTransaction({
          type: "RECEIVE_PAYMENT",
          transactionDate: date,
          referenceNumber: refNo.trim() || undefined,
          memo: memo.trim() || undefined,
          payee: customerRecord.name,
          accountLabel: accounts.find((a) => a.id === receivableId)?.name ?? "Accounts Receivable",
          sourceAccountId: depositAccount.id,
          paymentMethod: method || undefined,
          postings: [
            { accountId: depositAccount.id, type: "DEBIT", amount: creditCents / 100 },
            { accountId: receivableId, type: "CREDIT", amount: creditCents / 100 }
          ]
        });
        last = await services.transactionService.postTransaction(created.id);
      }
      if (last) await attachments.linkTo(last.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      toast({ variant: "success", title: "Payment recorded" });
      if (after === "close") closePage();
      else {
        resetForm();
        reload();
      }
    } catch (err) {
      // Some invoices may already be paid: start the amounts over so a retry can't record them twice.
      setPicked(new Set());
      setAmount("");
      setError(`${err instanceof Error ? err.message : "Could not record this payment."} Check which invoices are still open before trying again.`);
      reload();
    } finally {
      setSaving(false);
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

  const footerLink = "text-base font-medium text-[var(--color-text-global)] hover:underline";
  const footer = (
    <>
      <button type="button" onClick={closePage} className={`ml-auto ${footerLink}`}>Cancel</button>
      <button type="button" onClick={() => window.print()} className={footerLink}>Print</button>
      <button type="button" onClick={() => toast({ variant: "info", title: "More isn't available yet" })} className={`border-l border-[var(--color-divider-tertiary)] pl-4 ${footerLink}`}>More</button>
      <div className="flex items-center gap-3">
        <Button variant="secondary" className="!rounded-md" disabled={saving || Boolean(txnId && !loaded)} onClick={() => void save("stay")}>Record</Button>
        <div ref={menuRef} className="relative inline-flex">
          <Button variant="primary" className="!rounded-l-md !rounded-r-none" disabled={saving || Boolean(txnId && !loaded)} onClick={() => void save("close")}>{saving ? "Recording..." : "Record and close"}</Button>
          <Button variant="primary" className="!rounded-l-none !rounded-r-md border-l border-l-white/30 !min-w-0 px-2" aria-label="More record options" disabled={saving || Boolean(txnId && !loaded)} onClick={() => setMenuOpen((v) => !v)}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          {menuOpen ? (
            <div className="absolute bottom-full right-0 mb-1 w-44 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
              <button type="button" onClick={() => void save("new")} className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Record and new</button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  const title = (
    <>
      <span className="font-bold">Receive Payment</span>
      <span className="text-sm font-bold text-[var(--color-negative)]">{selected.length} {selected.length === 1 ? "invoice" : "invoices"} selected · {money(appliedCents / 100)}</span>
      <button type="button" onClick={() => setHeaderHidden((v) => !v)} className={RT_BUTTON}>{headerHidden ? "Show Header" : "Hide Header"}</button>
    </>
  );
  const allPicked = rows.length > 0 && rows.every((i) => (txnId ? paidByThis.includes(i) : picked.has(i.id)));

  return (
    <FullScreenFormShell title={title} onClose={closePage} footer={footer} hideSettings hideTools>
      <div className={headerHidden ? "hidden" : "px-10 pb-6 pt-5"}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className={LABEL}>Customer</span>
            <div className="flex items-start gap-4">
              <div className="w-[400px] max-w-full">
                <Select value={customer} onChange={chooseCustomer} options={customerOptions} placeholder="Choose a customer" allowCustomValue={false} disabled={amountLocked} />
                {customerRecord ? (
                  <button type="button" onClick={() => window.open(`/customerdetail?nameId=${encodeURIComponent(customerRecord.id)}`, "_blank")} className="mt-1 block text-sm font-medium text-[var(--color-negative)] hover:underline">Payee Details</button>
                ) : null}
              </div>
              {txnId ? null : <Button variant="secondary" className="!rounded-md" onClick={() => setFindOpen(true)}>Find by invoice no.</Button>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-[var(--color-text-primary)]">Amount received</p>
            <p className="text-5xl font-bold text-[var(--color-text-global)]">{money(cents(amount) / 100)}</p>
            <p className="mt-3 text-sm"><strong className="text-[var(--color-text-global)]">Customer balance</strong><br />{money(customerBalance / 100)}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-start gap-6">
          <section className={`${CARD} w-[870px] max-w-full`}>
            <h2 className={CARD_TITLE}>Record or charge</h2>
            <div className="flex flex-wrap gap-8 px-5 py-5">
              <div className="w-[290px] space-y-6">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="radio" name="pay-mode" checked readOnly className="mt-1 h-5 w-5 accent-[var(--color-ui-primary)]" />
                  <span><span className="block text-lg text-[var(--color-text-global)]">Record payment</span><span className="text-sm">Received via check, cash, other</span></span>
                </label>
                <label className="flex cursor-not-allowed items-start gap-3 opacity-60" title="Charging cards isn't available yet">
                  <input type="radio" name="pay-mode" checked={false} disabled className="mt-1 h-5 w-5" />
                  <span>
                    <span className="block text-lg text-[var(--color-text-global)]">Charge new payment</span>
                    <span className="text-sm">Process a card or ACH bank transfer</span>
                    <span className="mt-3 flex gap-1.5">
                      {["VISA", "MC", "DISCOVER", "BANK"].map((brand) => (
                        <span key={brand} className="rounded border border-[var(--color-container-border-secondary)] px-1.5 py-1 text-[10px] font-bold">{brand}</span>
                      ))}
                    </span>
                  </span>
                </label>
              </div>
              <div className="grid min-w-[420px] flex-1 grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className={LABEL} htmlFor="rp-date">Payment Date</label>
                  <DateField id="rp-date" value={date} onChange={setDate} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="rp-ref">Reference no.</label>
                  <InputField id="rp-ref" value={refNo} onChange={(event) => setRefNo(event.target.value)} />
                </div>
                <div>
                  <span className={LABEL}>Payment method</span>
                  <Select value={method} onChange={setMethod} options={methodOptions} placeholder="Select method" allowCustomValue={false} onAddNew={() => setMethodModalOpen(true)} addNewLabel="+ Add new" />
                </div>
                <div>
                  <span className={LABEL}>Deposit To</span>
                  <Select value={depositId} onChange={setDepositId} options={depositOptions} placeholder="Select account" allowCustomValue={false} onAddNew={() => setAccountModalOpen(true)} addNewLabel="+ Add new" />
                </div>
              </div>
            </div>
          </section>
          <section className={`${CARD} w-[430px] max-w-full`}>
            <h2 className={CARD_TITLE}>Amount</h2>
            <div className="px-5 py-5">
              <label className={LABEL} htmlFor="rp-amount">Amount received</label>
              <InputField
                id="rp-amount"
                inputMode="decimal"
                value={amountFocused || !amount ? amount : money(cents(amount) / 100)}
                onFocus={() => setAmountFocused(true)}
                onBlur={() => setAmountFocused(false)}
                onChange={(event) => typeAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                disabled={amountLocked}
                placeholder="$0.00"
                className="w-[350px] max-w-full"
              />
              {paidByThis.length > 0 ? <p className="mt-2 text-xs">This payment paid {paidByThis.length === 1 ? "an invoice" : "invoices"} in full, so its customer and amount can't change.</p> : null}
            </div>
          </section>
        </div>
      </div>

      <div className="bg-[var(--color-container-background-primary)] px-14 pb-10 pt-6">
        <section>
          <h2 className={SECTION_TITLE}>Outstanding Transactions</h2>
          <ListTools placeholder="Find Invoice No." value={invoiceSearch} onChange={setInvoiceSearch}>
            <button type="button" disabled title="More Fields isn't available yet" className={RT_BUTTON}>More Fields</button>
            <button type="button" disabled title="Copying the reference number to invoices isn't available yet" className={RT_BUTTON}>Copy Payment Ref# to Invoices</button>
          </ListTools>
          <table className="mt-4 w-full table-fixed border-collapse border-b-2 border-[var(--color-divider-tertiary)] text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
                <th className="w-14 px-3 py-3 text-center"><input type="checkbox" aria-label="Select all invoices" checked={allPicked} disabled={Boolean(txnId) || rows.length === 0} onChange={() => pick(new Set(allPicked ? [] : rows.map((i) => i.id)))} className={CHECKBOX} /></th>
                <th className={TH}>Description</th>
                <th className={`${TH} w-[16%]`}>Due date</th>
                <th className={`${TH} w-[20%] text-right`}>Original amount</th>
                <th className={`${TH} w-[22%] text-right`}>Open balance</th>
                <th className={`${TH} w-[13%] text-right`}>Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const paidHere = paidByThis.includes(i);
                const ticked = txnId ? paidHere : picked.has(i.id);
                return (
                  <tr key={i.id} className="border-b border-[var(--color-divider-tertiary)]">
                    <td className="px-3 py-3 text-center"><input type="checkbox" checked={ticked} disabled={Boolean(txnId)} title={txnId && !paidHere ? NO_APPLY : undefined} onChange={() => toggle(i.id)} aria-label={`Pay invoice ${i.invoiceNumber ?? ""}`} className={CHECKBOX} /></td>
                    <td className={TD}>Invoice{i.invoiceNumber ? ` # ${i.invoiceNumber}` : ""} ({usDate(i.invoiceDate)})</td>
                    <td className={TD}>{usDate(i.dueDate)}</td>
                    <td className={`${TD} text-right`}>{money(i.amount)}</td>
                    <td className={`${TD} text-right`}>{money(paidHere ? 0 : i.amount)}</td>
                    <td className={TD}><div className={PAYMENT_BOX}>{ticked ? i.amount.toFixed(2) : ""}</div></td>
                  </tr>
                );
              })}
              {rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-14 text-center">There are no transactions matching the criteria.</td></tr> : null}
            </tbody>
          </table>
          <ListCount count={rows.length} />
        </section>

        {credits.length > 0 ? (
          <section className="mt-8">
            <h2 className={SECTION_TITLE}>Credits</h2>
            <ListTools placeholder="Find Credit Memo No." value={creditSearch} onChange={setCreditSearch} />
            <table className="mt-4 w-full table-fixed border-collapse border-b-2 border-[var(--color-divider-tertiary)] text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
                  <th className="w-14 px-3 py-3 text-center"><input type="checkbox" aria-label="Select all credits" disabled checked={false} readOnly className={CHECKBOX} /></th>
                  <th className={TH}>Description</th>
                  <th className={`${TH} w-[24%] text-right`}>Original amount</th>
                  <th className={`${TH} w-[27%] text-right`}>Open balance</th>
                  <th className={`${TH} w-[16%] text-right`}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {creditRows.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-divider-tertiary)]">
                    <td className="px-3 py-3 text-center"><input type="checkbox" disabled checked={false} readOnly title="Applying credits isn't available yet" aria-label={`Apply credit from ${usDate(c.date)}`} className={CHECKBOX} /></td>
                    <td className={TD}><a href={`/recvpayment?txnId=${c.id}`} className="text-[var(--color-link-action)] hover:underline">Unapplied payment</a> <span className="text-xs">({usDate(c.date)})</span></td>
                    <td className={`${TD} text-right`}>{money(c.amount)}</td>
                    <td className={`${TD} text-right`}>{money(c.amount)}</td>
                    <td className={TD}><div className={`${PAYMENT_BOX} opacity-60`} title="Applying credits isn't available yet" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ListCount count={creditRows.length} />
          </section>
        ) : null}

        <div className="mt-4 flex flex-col items-end gap-2 text-sm">
          <p className="flex w-[330px] justify-between"><strong className="text-[var(--color-text-global)]">Amount to Apply</strong><span>{money(cents(amount) / 100)}</span></p>
          <p className="flex w-[330px] justify-between"><strong className="text-[var(--color-text-global)]">Amount to Credit</strong><span>{money(creditCents / 100)}</span></p>
          <Button variant="secondary" className="!rounded-md mt-2" disabled={Boolean(txnId)} onClick={() => pick(new Set())}>Clear Payment</Button>
          {creditCents > 0 ? <p className="mt-2">This transaction will create an additional credit in the amount of {money(creditCents / 100)}</p> : null}
        </div>

        <div className="mt-4 w-[460px] max-w-full">
          <div className="mb-1 flex items-center gap-3">
            <label className="text-sm" htmlFor="rp-memo">Memo</label>
            <button type="button" onClick={copyDetailsToMemo} disabled={selected.length === 0} className={RT_BUTTON}>Copy Invoice Details to Memo</button>
          </div>
          <textarea id="rp-memo" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Note" className={`${INPUT_BASE_CLASSES} h-[122px] resize-none rounded px-3 py-2 text-sm`} />
        </div>
        <div className="mt-4 w-[660px] max-w-full"><AttachmentsField attachments={attachments} formLabel="Payment" /></div>
        {error || loadError ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error ?? loadError}</p> : null}
        <p className="mt-6 text-center"><a href="https://www.intuit.com/privacy/" target="_blank" rel="noreferrer" className="text-[var(--color-link-action)] hover:underline">Privacy</a></p>
      </div>

      <Modal open={findOpen} onClose={() => setFindOpen(false)} title="Find by invoice no." size="sm">
        <InputField value={findNo} onChange={(event) => setFindNo(event.target.value)} placeholder="Invoice number" aria-label="Invoice number" autoFocus onKeyDown={(event) => event.key === "Enter" && findInvoice()} />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setFindOpen(false)}>Cancel</Button>
          <Button variant="primary" onClick={findInvoice} disabled={!findNo.trim()}>Find</Button>
        </div>
      </Modal>
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
          <Button variant="primary" onClick={addMethod} disabled={!newMethod.trim()}>Save</Button>
        </div>
      </Modal>
    </FullScreenFormShell>
  );
}
