"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AttachmentsField } from "@/components/accounting/attachments-field";
import { MoreMenu, useTransactionPrint } from "@/components/accounting/transaction-actions";
import { FullScreenFormShell, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { CHECKBOX, CreditsTable, ListCount, ListTools, OpenDocumentsTable, RT_BUTTON, SECTION_TITLE } from "@/components/accounting/payment-form-parts";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { nextAccountCode } from "@/lib/accounting/next-account-code";
import { nextCheckNumber } from "@/lib/accounting/next-check-number";
import { allocationProblem, planApplications } from "@/lib/accounting/payment-allocation";
import { appliedByTransaction, findPayableAccount, unappliedPayments } from "@/lib/accounting/receivables";
import { useFormAttachments } from "@/lib/hooks/use-form-attachments";
import { cents, usePaymentAllocation } from "@/lib/hooks/use-payment-allocation";
import { CANNOT_SHOW, formDetails, useSavedTransaction } from "@/lib/hooks/use-saved-transaction";
import { useVendors } from "@/lib/hooks/use-vendors";
import { applyBillPayment, listBills } from "@/lib/services/bills-service";
import type { Bill } from "@/lib/services/bills-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

const PAYMENT_CATEGORIES = new Set<Account["category"]>(["BANK", "CREDIT_CARD"]);
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const OUTLINE_BUTTON = "rounded-md border-2 border-[var(--color-ui-primary)] px-4 py-1.5 font-medium text-[var(--color-ui-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const FOOTER_LINK = "text-base font-medium text-[var(--color-text-global)] hover:underline disabled:cursor-not-allowed disabled:opacity-60";
const FOOTER_RT = "text-base font-bold text-[var(--color-negative)] disabled:cursor-not-allowed disabled:opacity-60";

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const usDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

// QBO's full-screen Bill Payment (/billpayment?rtAccountId=...&rt=close). Save
// posts one payment (payables debited, the bank or card credited) and applies
// it, with any credits used, to the ticked bills, in whole or in part. Money
// not applied stays as an unapplied payment. ?txnId= edits a saved payment and
// can apply what it has left.
export function BillPaymentFormPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: vendors } = useVendors();
  const attachments = useFormAttachments();
  const txnId = params.get("txnId");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billsLoaded, setBillsLoaded] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payee, setPayee] = useState("");
  const [accountId, setAccountId] = useState(params.get("rtAccountId") ?? "");
  const [mailing, setMailing] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [refNo, setRefNo] = useState("");
  const [printLater, setPrintLater] = useState(false);
  const [amountFocused, setAmountFocused] = useState(false);
  const [memo, setMemo] = useState("");
  const [billSearch, setBillSearch] = useState("");
  const [creditSearch, setCreditSearch] = useState("");
  const [headerOpen, setHeaderOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const refTyped = useRef(false);

  const reload = () => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
    listBills()
      .then((items) => {
        setBills(items);
        setBillsLoaded(true);
      })
      .catch(() => setError("Could not load bills."));
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
  const { loaded, setLoaded, loadError } = useSavedTransaction(txnId, "BILL_PAYMENT", "a bill payment", (txn) => {
    const debits = txn.postings.filter((p) => p.type === "DEBIT");
    const credits = txn.postings.filter((p) => p.type === "CREDIT");
    if (debits.length !== 1 || credits.length !== 1) return CANNOT_SHOW;
    setAccountId(credits[0].accountId);
    setDate(txn.transactionDate);
    setPayee(txn.payee ?? "");
    setRefNo(txn.referenceNumber ?? "");
    setMailing(txn.details?.mailing ?? "");
    setPrintLater(txn.details?.printLater === "1");
    setMemo(txn.memo ?? "");
    allocation.setAmount(credits[0].amount.toFixed(2));
    void attachments.loadLinked(txn.id).catch(() => toast({ variant: "error", title: "Could not load the attachments" }));
  });
  const savedSourceId = loaded?.postings.find((p) => p.type === "CREDIT")?.accountId;
  // The bills this saved payment is applied to. While there are any, its amount and payee are fixed.
  const appliedHere = useMemo(() => {
    const map = new Map<string, number>();
    if (txnId) for (const bill of bills) for (const payment of bill.payments) if (payment.transactionId === txnId) map.set(bill.id, (map.get(bill.id) ?? 0) + cents(payment.amount));
    return map;
  }, [txnId, bills]);
  const appliedHereCents = [...appliedHere.values()].reduce((sum, value) => sum + value, 0);
  const amountLocked = Boolean(txnId) && (!billsLoaded || appliedHereCents > 0);

  const paymentAccounts = useMemo(() => accounts.filter((a) => a.id === savedSourceId || (a.status === "ACTIVE" && PAYMENT_CATEGORIES.has(a.category))).sort((a, b) => a.name.localeCompare(b.name)), [accounts, savedSourceId]);
  const paymentAccount = accounts.find((a) => a.id === accountId);
  useEffect(() => {
    if (txnId || accounts.length === 0 || paymentAccount) return;
    const first = paymentAccounts.find((a) => a.category === "BANK") ?? paymentAccounts[0];
    if (first) setAccountId(first.id);
  }, [txnId, accounts, paymentAccount, paymentAccounts]);

  // A new payment takes the paying account's next check number until one is typed.
  useEffect(() => {
    if (txnId || !accountId) return;
    let cancelled = false;
    services.registerService
      .listRegisterEntries(accountId)
      .then((entries) => {
        if (!cancelled && !refTyped.current) setRefNo(nextCheckNumber(entries));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [txnId, accountId, services]);

  const vendor = vendors.find((v) => v.name === payee);
  const addressFor = (name: string) => {
    const record = vendors.find((v) => v.name === name);
    return record ? [record.name, record.companyName, record.address].filter(Boolean).join("\n") : name;
  };
  const payeeOptions = useMemo(() => {
    const contacts = vendors.map((v) => ({ value: v.name, label: v.name, rightLabel: "Vendor" }));
    return payee && !contacts.some((c) => c.value === payee) ? [{ value: payee, label: payee, rightLabel: "" }, ...contacts] : contacts;
  }, [vendors, payee]);
  const accountOptions = useMemo(() => paymentAccounts.map((a) => ({ value: a.id, label: a.name })), [paymentAccounts]);
  // Oldest due first: that's the order a typed amount is applied in.
  const open = useMemo(() => bills.filter((b) => b.status === "OPEN" && b.vendorId === vendor?.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [bills, vendor]);
  const applied = useMemo(() => appliedByTransaction(bills), [bills]);
  const credits = useMemo(
    () => (billsLoaded ? unappliedPayments(transactions, accounts, applied, payee, "vendor").filter((c) => c.id !== txnId) : []),
    [billsLoaded, transactions, accounts, applied, payee, txnId]
  );
  const allocation = usePaymentAllocation(
    open.map((b) => ({ id: b.id, open: cents(b.openBalance) })),
    credits.map((c) => ({ id: c.id, available: cents(c.amount) })),
    Boolean(txnId)
  );
  const { amount } = allocation;

  const search = billSearch.trim().toLowerCase();
  // Open bills, plus any this payment already paid off.
  const rows = bills
    .filter((b) => open.includes(b) || appliedHere.has(b.id))
    .filter((b) => !search || (b.billNumber ?? "").toLowerCase().includes(search))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const creditRows = credits.filter((c) => !creditSearch.trim() || usDate(c.date).includes(creditSearch.trim()));
  const paying = open.filter((b) => cents(allocation.payments[b.id] ?? 0) > 0).map((b) => ({ bill: b, cents: cents(allocation.payments[b.id]!), open: cents(b.openBalance) }));
  const creditsUsed = credits.filter((c) => cents(allocation.used[c.id] ?? 0) > 0).map((c) => ({ id: c.id, cents: cents(allocation.used[c.id]!), available: cents(c.amount) }));
  const creditUsedCents = creditsUsed.reduce((sum, c) => sum + c.cents, 0);
  const payingCents = paying.reduce((sum, p) => sum + p.cents, 0);
  // Money from this payment that is still free to apply, and what would be left over after saving.
  const moneyCents = Math.max(0, cents(amount) - appliedHereCents);
  const leftoverCents = Math.max(0, moneyCents - Math.max(0, payingCents - creditUsedCents));
  const selected = rows.filter((b) => appliedHere.has(b.id) || cents(allocation.payments[b.id] ?? 0) > 0);

  const closePage = () => leaveFormPage(router);
  const printSaved = useTransactionPrint();
  function choosePayee(name: string) {
    setPayee(name);
    setMailing(addressFor(name));
    allocation.clear();
  }
  const copyBillMemos = () => setMemo(selected.map((b) => b.memo?.trim()).filter(Boolean).join("; "));
  function resetForm(nextRef: string) {
    setPayee("");
    setMailing("");
    setPrintLater(false);
    allocation.clear();
    setMemo("");
    attachments.reset();
    setError(null);
    refTyped.current = false;
    setRefNo(nextRef);
  }

  const details = () => formDetails({ mailing, printLater: printLater ? "1" : "" });
  const reference = () => (printLater ? undefined : refNo.trim() || undefined);

  const problem = () => allocationProblem({ money: moneyCents, payments: paying, credits: creditsUsed, noun: "bill" });

  /** Puts the credits, then this payment's own money, against the ticked bills. */
  async function applyTo(transactionId: string | undefined) {
    const sources = [...creditsUsed.map((c) => ({ id: c.id, available: c.cents })), ...(transactionId ? [{ id: transactionId, available: moneyCents }] : [])];
    for (const step of planApplications(paying.map((p) => ({ id: p.bill.id, cents: p.cents })), sources)) {
      await applyBillPayment(step.documentId, { paymentTransactionId: step.sourceId, amount: step.cents / 100 });
    }
  }
  const notApplied = (err: unknown) => `The payment was saved, but not all of it could be applied: ${err instanceof Error ? err.message : "unknown error"}`;

  async function saveExisting(after: "close" | "new") {
    if (!loaded) return setError(loadError ?? "This transaction is still loading.");
    if (!paymentAccount) return setError("Choose the bank or credit account.");
    if (!date) return setError("Enter the payment date.");
    const debit = loaded.postings.find((p) => p.type === "DEBIT")!;
    const credit = loaded.postings.find((p) => p.type === "CREDIT")!;
    const total = amountLocked ? credit.amount : cents(amount) / 100;
    if (total <= 0) return setError("Enter the amount.");
    const wrong = problem();
    if (wrong) return setError(wrong);
    setSaving(true);
    setError(null);
    try {
      setLoaded(
        await services.transactionService.updateTransaction(loaded.id, {
          transactionDate: date,
          dueDate: loaded.dueDate,
          referenceNumber: reference(),
          memo: memo.trim() || undefined,
          payee: payee.trim() || undefined,
          accountLabel: loaded.accountLabel,
          sourceAccountId: paymentAccount.id,
          paymentMethod: loaded.paymentMethod,
          details: details(),
          postings: [
            { ...debit, amount: total },
            { ...credit, accountId: paymentAccount.id, amount: total }
          ]
        })
      );
      await attachments.linkTo(loaded.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      try {
        await applyTo(loaded.id);
      } catch (err) {
        allocation.clear();
        reload();
        return setError(notApplied(err));
      }
      toast({ variant: "success", title: "Bill payment saved" });
      if (after === "new") window.location.assign("/billpayment");
      else closePage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this bill payment.");
    } finally {
      setSaving(false);
    }
  }

  async function save(after: "close" | "new") {
    setMenuOpen(false);
    if (txnId) return saveExisting(after);
    if (!paymentAccount) return setError("Choose the bank or credit account.");
    if (!vendor) return setError("Choose a vendor as the payee.");
    if (!date) return setError("Enter the payment date.");
    if (moneyCents <= 0 && creditUsedCents <= 0) return setError("Enter the amount, or use a credit.");
    const wrong = problem();
    if (wrong) return setError(wrong);
    const following = /^\d+$/.test(refNo.trim()) && moneyCents > 0 ? String(Number(refNo) + 1).padStart(refNo.trim().length, "0") : refNo;
    setSaving(true);
    setError(null);
    try {
      let posted: Transaction | undefined;
      if (moneyCents > 0) {
        let payableId = findPayableAccount(accounts)?.id;
        if (!payableId) {
          payableId = (await services.accountService.createAccount({ code: nextAccountCode(accounts), name: "Accounts Payable", category: "ACCOUNTS_PAYABLE", currency: "USD" })).id;
        }
        const created = await services.transactionService.createTransaction({
          type: "BILL_PAYMENT",
          transactionDate: date,
          referenceNumber: reference(),
          memo: memo.trim() || undefined,
          payee: vendor.name,
          accountLabel: accounts.find((a) => a.id === payableId)?.name ?? "Accounts Payable",
          sourceAccountId: paymentAccount.id,
          details: details(),
          postings: [
            { accountId: payableId, type: "DEBIT", amount: moneyCents / 100 },
            { accountId: paymentAccount.id, type: "CREDIT", amount: moneyCents / 100 }
          ]
        });
        posted = await services.transactionService.postTransaction(created.id);
        await attachments.linkTo(posted.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      }
      try {
        await applyTo(posted?.id);
      } catch (err) {
        // The money is recorded, so clear the form: saving again would enter it twice.
        resetForm(following);
        reload();
        return setError(notApplied(err));
      }
      toast({ variant: "success", title: "Bill payment saved" });
      if (after === "close") closePage();
      else {
        resetForm(following);
        reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this bill payment.");
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || Boolean(txnId && !loaded);
  const footer = (
    <div className="ml-auto flex flex-wrap items-center justify-end gap-8">
      <button type="button" onClick={closePage} className={OUTLINE_BUTTON}>Cancel</button>
      <button type="button" disabled title="Copying this payment isn't available yet" className={FOOTER_RT}>RightTool Copy</button>
      <button type="button" disabled title="Remittance advice isn't available yet" className={FOOTER_RT}>Remittance</button>
      <button type="button" onClick={() => void printSaved(loaded, "check")} className={FOOTER_LINK}>Print check</button>
      <button type="button" disabled title="Ordering checks isn't available yet" className={FOOTER_LINK}>Order checks</button>
      <MoreMenu transaction={loaded} onRemoved={closePage} className={FOOTER_LINK} />
      <div ref={menuRef} className="relative ml-6 inline-flex">
        <Button variant="primary" className="!rounded-l-md !rounded-r-none" disabled={busy} onClick={() => void save("close")}>{saving ? "Saving..." : "Save and close"}</Button>
        <Button variant="primary" className="!rounded-l-none !rounded-r-md border-l border-l-white/30 !min-w-0 px-2" aria-label="More save options" disabled={busy} onClick={() => setMenuOpen((v) => !v)}>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </Button>
        {menuOpen ? (
          <div className="absolute bottom-full right-0 mb-1 w-40 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
            <button type="button" onClick={() => void save("new")} className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Save and new</button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <FullScreenFormShell title={<span className="font-bold">Bill Payment{refNo && !printLater ? ` #${refNo}` : ""}</span>} onClose={closePage} footer={footer} centerTools hideSettings>
      <div className={headerOpen ? "px-10 pb-8 pt-4" : "hidden"}>
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-[320px]">
              <span className={LABEL}>Payee</span>
              <Select value={payee} onChange={choosePayee} options={payeeOptions} placeholder="Who did you pay?" allowCustomValue={false} disabled={amountLocked} />
              {vendor ? (
                <button type="button" onClick={() => window.open(`/vendordetail?nameId=${encodeURIComponent(vendor.id)}`, "_blank")} className="mt-1 block text-sm font-medium text-[var(--color-negative)] hover:underline">Payee Details</button>
              ) : null}
            </div>
            <div className="w-[320px]">
              <span className={LABEL}>Bank/Credit account</span>
              <Select value={accountId} onChange={setAccountId} options={accountOptions} placeholder="Select account" allowCustomValue={false} onAddNew={() => setAccountModalOpen(true)} addNewLabel="+ Add new" />
            </div>
            {paymentAccount ? (
              <p className="self-center pt-5 text-sm">
                <strong className="text-[var(--color-text-global)]">Balance</strong> {money(paymentAccount.currentBalance)}
              </p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase">Amount paid</p>
            <p className="text-5xl font-bold text-[var(--color-text-global)]">{money(cents(amount) / 100)}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-6">
          <div className="w-[320px]">
            <label className={LABEL} htmlFor="bp-mailing">Mailing address</label>
            <textarea id="bp-mailing" value={mailing} onChange={(event) => setMailing(event.target.value)} className={`${INPUT_BASE_CLASSES} h-[154px] resize-none rounded px-3 py-2 text-sm`} />
          </div>
          <div>
            <label className={LABEL} htmlFor="bp-date">Payment date</label>
            <DateField id="bp-date" value={date} onChange={setDate} className="w-[200px]" />
          </div>
          <div className="ml-[18%]">
            <label className={LABEL} htmlFor="bp-ref">Ref no.</label>
            <InputField id="bp-ref" value={refNo} disabled={printLater} onChange={(event) => { refTyped.current = true; setRefNo(event.target.value); }} className="w-[214px]" />
            <label className="mt-3 flex cursor-pointer items-center gap-3 text-sm"><input type="checkbox" checked={printLater} onChange={(event) => setPrintLater(event.target.checked)} className={CHECKBOX} />Print later</label>
          </div>
        </div>
      </div>

      <div className="bg-[var(--color-container-background-primary)] px-10 pb-10">
        <button type="button" onClick={() => setHeaderOpen((v) => !v)} aria-expanded={headerOpen} aria-label={headerOpen ? "Hide header" : "Show header"} className="relative -top-4 mx-auto flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] text-[var(--color-icon-secondary)]">
          {headerOpen ? <ChevronUp className="h-5 w-5" aria-hidden="true" /> : <ChevronDown className="h-5 w-5" aria-hidden="true" />}
        </button>
        <div className="flex justify-end">
          <div className="w-[180px] text-right">
            <label className={LABEL} htmlFor="bp-amount">Amount</label>
            <InputField
              id="bp-amount"
              inputMode="decimal"
              value={amountFocused || !amount ? amount : money(cents(amount) / 100)}
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
              onChange={(event) => allocation.typeAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              disabled={amountLocked}
              placeholder="$0.00"
              className="text-right"
            />
          </div>
        </div>
        {appliedHereCents > 0 ? <p className="mt-2 text-right text-xs">This payment is applied to {appliedHere.size === 1 ? "a bill" : "bills"}, so its payee and amount can&apos;t change.</p> : null}

        <section>
          <h2 className={SECTION_TITLE}>Outstanding Transactions</h2>
          <ListTools placeholder="Find Bill No." value={billSearch} onChange={setBillSearch}>
            <button type="button" onClick={copyBillMemos} disabled={selected.length === 0} className={RT_BUTTON}>Copy Memos from Bills</button>
            <button type="button" disabled title="Copying the reference number to bills isn't available yet" className={RT_BUTTON}>Copy Payment Ref# to Bills</button>
          </ListTools>
          <OpenDocumentsTable
            noun="bill"
            dueHeading="Due date ▲"
            emptyText="You don't have any bills."
            rows={rows.map((b) => ({ id: b.id, label: `Bill${b.billNumber ? ` # ${b.billNumber}` : ""} (${usDate(b.billDate)})`, dueDate: b.dueDate, original: b.amount, open: b.openBalance, appliedHere: (appliedHere.get(b.id) ?? 0) / 100 }))}
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
            <ListTools placeholder="Find Credit No." value={creditSearch} onChange={setCreditSearch} />
            <CreditsTable rows={creditRows} used={allocation.used} href={(id) => `/billpayment?txnId=${id}`} onToggle={allocation.toggleCredit} onAmount={allocation.setCredit} />
            <ListCount count={creditRows.length} />
          </section>
        ) : null}

        <div className="mt-4 flex flex-wrap items-start justify-between gap-8">
          <div className="flex flex-wrap items-start gap-6">
            <div className="w-[400px] max-w-full">
              <label className={LABEL} htmlFor="bp-memo">Memo</label>
              <textarea id="bp-memo" value={memo} onChange={(event) => setMemo(event.target.value)} className={`${INPUT_BASE_CLASSES} h-[132px] resize-y rounded px-3 py-2 text-sm`} />
            </div>
            <div className="w-[400px] max-w-full"><AttachmentsField attachments={attachments} formLabel="Bill Payment" /></div>
          </div>
          <div className="flex w-[330px] flex-col items-end gap-2 text-sm">
            <p className="flex w-full justify-between"><strong className="text-[var(--color-text-global)]">Amount to Apply</strong><span>{money((moneyCents + creditUsedCents) / 100)}</span></p>
            <p className="flex w-full justify-between"><strong className="text-[var(--color-text-global)]">Amount to Credit</strong><span>{money(leftoverCents / 100)}</span></p>
            <Button variant="secondary" className="mt-2 !rounded-md" onClick={allocation.clear}>Clear Payment</Button>
            {leftoverCents > 0 ? <p className="mt-2">This transaction will create an additional credit in the amount of {(leftoverCents / 100).toFixed(2)}</p> : null}
          </div>
        </div>
        {error || loadError ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error ?? loadError}</p> : null}
      </div>

      <AddAccountModal
        open={accountModalOpen}
        accounts={accounts}
        onClose={() => setAccountModalOpen(false)}
        onSave={async (input) => {
          const created = await services.accountService.createAccount({ code: nextAccountCode(accounts), name: input.name, category: input.category, subtype: input.subtype, currency: "USD", openingBalance: input.openingBalance });
          setAccounts(await services.accountService.listAccounts());
          setAccountId(created.id);
          return created;
        }}
      />
    </FullScreenFormShell>
  );
}
