"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AttachmentsField } from "@/components/accounting/attachments-field";
import { MoreMenu, useTransactionPrint } from "@/components/accounting/transaction-actions";
import { FullScreenFormShell, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { CreditsTable, ListCount, ListTools, OpenDocumentsTable, RT_BUTTON, SECTION_TITLE } from "@/components/accounting/payment-form-parts";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { nextAccountCode } from "@/lib/accounting/next-account-code";
import { allocationProblem, planApplications } from "@/lib/accounting/payment-allocation";
import { appliedByTransaction, findReceivableAccount, unappliedPayments } from "@/lib/accounting/receivables";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFormAttachments } from "@/lib/hooks/use-form-attachments";
import { cents, usePaymentAllocation } from "@/lib/hooks/use-payment-allocation";
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";
import { CANNOT_SHOW, useSavedTransaction } from "@/lib/hooks/use-saved-transaction";
import { applyInvoicePayment, listInvoices } from "@/lib/services/invoices-service";
import type { Invoice } from "@/lib/services/invoices-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

const DEPOSIT_CATEGORIES = new Set<Account["category"]>(["BANK", "OTHER_CURRENT_ASSET"]);
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const CARD = "rounded-xl border border-[var(--color-container-border-secondary)] bg-[var(--color-container-background-primary)]";
const CARD_TITLE = "border-b border-[var(--color-divider-tertiary)] px-5 py-4 text-lg text-[var(--color-text-global)]";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const usDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

// QBO's full-screen Receive Payment (/recvpayment?rtAccountId=...&rt=close).
// rtAccountId is the account the money lands in. Record posts one payment
// (deposit account debited, receivables credited) and applies it, with any
// credits used, to the ticked invoices, in whole or in part. Money not applied
// stays as an unapplied payment. ?txnId= edits a saved payment and can apply
// what it has left.
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
  const [findId, setFindId] = useState<string | null>(null);
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
    allocation.setAmount(debits[0].amount.toFixed(2));
    void attachments.loadLinked(txn.id).catch(() => toast({ variant: "error", title: "Could not load the attachments" }));
  });
  const savedSourceId = loaded?.postings.find((p) => p.type === "DEBIT")?.accountId;
  // The invoices this saved payment is applied to. While there are any, its amount and customer are fixed.
  const appliedHere = useMemo(() => {
    const map = new Map<string, number>();
    if (txnId) for (const invoice of invoices) for (const payment of invoice.payments) if (payment.transactionId === txnId) map.set(invoice.id, (map.get(invoice.id) ?? 0) + cents(payment.amount));
    return map;
  }, [txnId, invoices]);
  const appliedHereCents = [...appliedHere.values()].reduce((sum, value) => sum + value, 0);
  const amountLocked = Boolean(txnId) && (!invoicesLoaded || appliedHereCents > 0);

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
  const applied = useMemo(() => appliedByTransaction(invoices), [invoices]);
  const allCredits = useMemo(() => (invoicesLoaded ? unappliedPayments(transactions, accounts, applied, customer) : []), [invoicesLoaded, transactions, accounts, applied, customer]);
  const credits = allCredits.filter((c) => c.id !== txnId);
  const customerBalance = open.reduce((sum, i) => sum + cents(i.openBalance), 0) - allCredits.reduce((sum, c) => sum + cents(c.amount), 0);
  const allocation = usePaymentAllocation(
    open.map((i) => ({ id: i.id, open: cents(i.openBalance) })),
    credits.map((c) => ({ id: c.id, available: cents(c.amount) })),
    Boolean(txnId)
  );
  const { amount } = allocation;

  const search = invoiceSearch.trim().toLowerCase();
  // Open invoices, plus any this payment already paid off.
  const rows = invoices
    .filter((i) => open.includes(i) || appliedHere.has(i.id))
    .filter((i) => !search || (i.invoiceNumber ?? "").toLowerCase().includes(search))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const creditRows = credits.filter((c) => !creditSearch.trim() || usDate(c.date).includes(creditSearch.trim()));
  const paying = open.filter((i) => cents(allocation.payments[i.id] ?? 0) > 0).map((i) => ({ invoice: i, cents: cents(allocation.payments[i.id]!), open: cents(i.openBalance) }));
  const creditsUsed = credits.filter((c) => cents(allocation.used[c.id] ?? 0) > 0).map((c) => ({ id: c.id, cents: cents(allocation.used[c.id]!), available: cents(c.amount) }));
  const creditUsedCents = creditsUsed.reduce((sum, c) => sum + c.cents, 0);
  const payingCents = paying.reduce((sum, p) => sum + p.cents, 0);
  // Money from this payment that is still free to apply, and what would be left over after saving.
  const moneyCents = Math.max(0, cents(amount) - appliedHereCents);
  const leftoverCents = Math.max(0, moneyCents - Math.max(0, payingCents - creditUsedCents));
  const selectedCount = new Set([...appliedHere.keys(), ...paying.map((p) => p.invoice.id)]).size;
  const selectedCents = appliedHereCents + payingCents;

  const closePage = () => leaveFormPage(router);
  const printSaved = useTransactionPrint();
  function chooseCustomer(name: string) {
    setCustomer(name);
    allocation.clear();
  }
  // "Find by invoice no." ticks the invoice once its customer's list is on screen.
  useEffect(() => {
    if (!findId || !open.some((i) => i.id === findId)) return;
    allocation.toggle(findId);
    setFindId(null);
  }, [findId, open]); // eslint-disable-line react-hooks/exhaustive-deps
  function findInvoice() {
    const wanted = findNo.trim().toLowerCase();
    const match = invoices.find((i) => i.status === "OPEN" && (i.invoiceNumber ?? "").toLowerCase() === wanted);
    if (!match) return toast({ variant: "error", title: wanted ? `No open invoice numbered ${findNo.trim()}` : "Enter an invoice number" });
    const owner = customers.find((c) => c.id === match.customerId);
    if (!owner) return toast({ variant: "error", title: "That invoice's customer wasn't found" });
    chooseCustomer(owner.name);
    setFindId(match.id);
    setFindOpen(false);
    setFindNo("");
  }
  const copyDetailsToMemo = () => setMemo(rows.filter((i) => appliedHere.has(i.id) || cents(allocation.payments[i.id] ?? 0) > 0).map((i) => `Invoice${i.invoiceNumber ? ` # ${i.invoiceNumber}` : ""} ${money(((appliedHere.get(i.id) ?? 0) + cents(allocation.payments[i.id] ?? 0)) / 100)}`).join("; "));
  function resetForm() {
    setCustomer("");
    setRefNo("");
    setMethod("");
    allocation.clear();
    setMemo("");
    attachments.reset();
    setError(null);
  }

  const problem = () =>
    allocationProblem({ money: moneyCents, payments: paying, credits: creditsUsed, noun: "invoice" });

  /** Puts the credits, then this payment's own money, against the ticked invoices. */
  async function applyTo(transactionId: string | undefined) {
    const sources = [...creditsUsed.map((c) => ({ id: c.id, available: c.cents })), ...(transactionId ? [{ id: transactionId, available: moneyCents }] : [])];
    for (const step of planApplications(paying.map((p) => ({ id: p.invoice.id, cents: p.cents })), sources)) {
      await applyInvoicePayment(step.documentId, { paymentTransactionId: step.sourceId, amount: step.cents / 100 });
    }
  }
  const notApplied = (err: unknown) => `The payment was saved, but not all of it could be applied: ${err instanceof Error ? err.message : "unknown error"}`;

  async function saveExisting(after: "stay" | "close" | "new") {
    if (!loaded) return setError(loadError ?? "This transaction is still loading.");
    if (!depositAccount) return setError("Choose the account to deposit to.");
    if (!date) return setError("Enter the payment date.");
    const debit = loaded.postings.find((p) => p.type === "DEBIT")!;
    const credit = loaded.postings.find((p) => p.type === "CREDIT")!;
    const total = amountLocked ? debit.amount : cents(amount) / 100;
    if (total <= 0) return setError("Enter the amount received.");
    const wrong = problem();
    if (wrong) return setError(wrong);
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
      try {
        await applyTo(loaded.id);
      } catch (err) {
        allocation.clear();
        reload();
        return setError(notApplied(err));
      }
      allocation.clear();
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
    if (moneyCents <= 0 && creditUsedCents <= 0) return setError("Enter the amount received, or use a credit.");
    const wrong = problem();
    if (wrong) return setError(wrong);
    setSaving(true);
    setError(null);
    try {
      let posted: Transaction | undefined;
      if (moneyCents > 0) {
        let receivableId = findReceivableAccount(accounts)?.id;
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
            { accountId: depositAccount.id, type: "DEBIT", amount: moneyCents / 100 },
            { accountId: receivableId, type: "CREDIT", amount: moneyCents / 100 }
          ]
        });
        posted = await services.transactionService.postTransaction(created.id);
        await attachments.linkTo(posted.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      }
      try {
        await applyTo(posted?.id);
      } catch (err) {
        // The money is recorded, so clear the form: recording again would enter it twice.
        resetForm();
        reload();
        return setError(notApplied(err));
      }
      toast({ variant: "success", title: "Payment recorded" });
      if (after === "close") closePage();
      else {
        resetForm();
        reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this payment.");
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
      <button type="button" onClick={() => void printSaved(loaded)} className={footerLink}>Print</button>
      <MoreMenu transaction={loaded} onRemoved={closePage} className={`border-l border-[var(--color-divider-tertiary)] pl-4 ${footerLink}`} />
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
      <span className="text-sm font-bold text-[var(--color-negative)]">{selectedCount} {selectedCount === 1 ? "invoice" : "invoices"} selected · {money(selectedCents / 100)}</span>
      <button type="button" onClick={() => setHeaderHidden((v) => !v)} className={RT_BUTTON}>{headerHidden ? "Show Header" : "Hide Header"}</button>
    </>
  );

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
                onChange={(event) => allocation.typeAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                disabled={amountLocked}
                placeholder="$0.00"
                className="w-[350px] max-w-full"
              />
              {appliedHereCents > 0 ? <p className="mt-2 text-xs">This payment is applied to {appliedHere.size === 1 ? "an invoice" : "invoices"}, so its customer and amount can't change.</p> : null}
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
          <OpenDocumentsTable
            noun="invoice"
            dueHeading="Due date"
            emptyText="There are no transactions matching the criteria."
            rows={rows.map((i) => ({ id: i.id, label: `Invoice${i.invoiceNumber ? ` # ${i.invoiceNumber}` : ""} (${usDate(i.invoiceDate)})`, dueDate: i.dueDate, original: i.amount, open: i.openBalance, appliedHere: (appliedHere.get(i.id) ?? 0) / 100 }))}
            payments={allocation.payments}
            onToggle={allocation.toggle}
            onToggleAll={allocation.toggleAll}
            onPayment={allocation.setPayment}
          />
          <ListCount count={rows.length} />
        </section>

        {credits.length > 0 ? (
          <section className="mt-8">
            <h2 className={SECTION_TITLE}>Credits</h2>
            <ListTools placeholder="Find Credit Memo No." value={creditSearch} onChange={setCreditSearch} />
            <CreditsTable rows={creditRows} used={allocation.used} href={(id) => `/recvpayment?txnId=${id}`} onToggle={allocation.toggleCredit} onAmount={allocation.setCredit} />
            <ListCount count={creditRows.length} />
          </section>
        ) : null}

        <div className="mt-4 flex flex-col items-end gap-2 text-sm">
          <p className="flex w-[330px] justify-between"><strong className="text-[var(--color-text-global)]">Amount to Apply</strong><span>{money((moneyCents + creditUsedCents) / 100)}</span></p>
          <p className="flex w-[330px] justify-between"><strong className="text-[var(--color-text-global)]">Amount to Credit</strong><span>{money(leftoverCents / 100)}</span></p>
          <Button variant="secondary" className="!rounded-md mt-2" onClick={allocation.clear}>Clear Payment</Button>
          {leftoverCents > 0 ? <p className="mt-2">This transaction will create an additional credit in the amount of {money(leftoverCents / 100)}</p> : null}
        </div>

        <div className="mt-4 w-[460px] max-w-full">
          <div className="mb-1 flex items-center gap-3">
            <label className="text-sm" htmlFor="rp-memo">Memo</label>
            <button type="button" onClick={copyDetailsToMemo} disabled={selectedCount === 0} className={RT_BUTTON}>Copy Invoice Details to Memo</button>
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
