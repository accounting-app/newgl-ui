"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AttachmentsField } from "@/components/accounting/attachments-field";
import { FullScreenFormShell, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { CHECKBOX, ListCount, ListTools, PAYMENT_BOX, RT_BUTTON, SECTION_TITLE, TD, TH } from "@/components/accounting/payment-form-parts";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { nextAccountCode } from "@/lib/accounting/next-account-code";
import { nextCheckNumber } from "@/lib/accounting/next-check-number";
import { findPayableAccount, unappliedPayments } from "@/lib/accounting/receivables";
import { useFormAttachments } from "@/lib/hooks/use-form-attachments";
import { CANNOT_SHOW, formDetails, useSavedTransaction } from "@/lib/hooks/use-saved-transaction";
import { useVendors } from "@/lib/hooks/use-vendors";
import { listBills, payBill } from "@/lib/services/bills-service";
import type { Bill } from "@/lib/services/bills-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account, Transaction } from "@/modules/accounting/domain/models";

const PAYMENT_CATEGORIES = new Set<Account["category"]>(["BANK", "CREDIT_CARD"]);
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const OUTLINE_BUTTON = "rounded-md border-2 border-[var(--color-ui-primary)] px-4 py-1.5 font-medium text-[var(--color-ui-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const FOOTER_LINK = "text-base font-medium text-[var(--color-text-global)] hover:underline disabled:cursor-not-allowed disabled:opacity-60";
const FOOTER_RT = "text-base font-bold text-[var(--color-negative)] disabled:cursor-not-allowed disabled:opacity-60";

const cents = (value: number | string) => Math.round((Number(value) || 0) * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const usDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;

// QBO's full-screen Bill Payment (/billpayment?rtAccountId=...&rt=close). Save
// pays each ticked open bill in full (the ledger has no partial payments) and
// keeps anything left over as an unapplied payment: payables debited, the bank
// or card credited. ?txnId= edits a saved payment; the bills it paid stay paid.
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
  const [amount, setAmount] = useState("");
  const [amountFocused, setAmountFocused] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
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
    setAmount(credits[0].amount.toFixed(2));
    void attachments.loadLinked(txn.id).catch(() => toast({ variant: "error", title: "Could not load the attachments" }));
  });
  const savedSourceId = loaded?.postings.find((p) => p.type === "CREDIT")?.accountId;
  // The bills this saved payment paid. While there are any, its amount and payee are fixed.
  const paidByThis = useMemo(() => (txnId ? bills.filter((b) => b.paymentTransactionId === txnId) : []), [txnId, bills]);
  const amountLocked = Boolean(txnId) && (!billsLoaded || paidByThis.length > 0);

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
  const appliedIds = useMemo(() => new Set(bills.flatMap((b) => (b.paymentTransactionId ? [b.paymentTransactionId] : []))), [bills]);
  const credits = useMemo(
    () => (billsLoaded ? unappliedPayments(transactions, accounts, appliedIds, payee, "vendor").filter((c) => c.id !== txnId) : []),
    [billsLoaded, transactions, accounts, appliedIds, payee, txnId]
  );

  const search = billSearch.trim().toLowerCase();
  const rows = [...paidByThis, ...open].filter((b) => !search || (b.billNumber ?? "").toLowerCase().includes(search));
  const creditRows = credits.filter((c) => !creditSearch.trim() || usDate(c.date).includes(creditSearch.trim()));
  const selected = txnId ? paidByThis : open.filter((b) => picked.has(b.id));
  const appliedCents = selected.reduce((sum, b) => sum + cents(b.amount), 0);
  const creditCents = Math.max(0, cents(amount) - appliedCents);
  const allPicked = rows.length > 0 && rows.every((b) => (txnId ? paidByThis.includes(b) : picked.has(b.id)));

  const closePage = () => leaveFormPage(router);
  function choosePayee(name: string) {
    setPayee(name);
    setMailing(addressFor(name));
    setPicked(new Set());
    setAmount("");
  }
  function pick(next: Set<string>) {
    setPicked(next);
    const total = open.filter((b) => next.has(b.id)).reduce((sum, b) => sum + cents(b.amount), 0);
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
    for (const b of open) {
      if (cents(b.amount) <= left) {
        next.add(b.id);
        left -= cents(b.amount);
      }
    }
    setPicked(next);
  }
  const copyBillMemos = () => setMemo(selected.map((b) => b.memo?.trim()).filter(Boolean).join("; "));
  function resetForm(nextRef: string) {
    setPayee("");
    setMailing("");
    setPrintLater(false);
    setAmount("");
    setPicked(new Set());
    setMemo("");
    attachments.reset();
    setError(null);
    refTyped.current = false;
    setRefNo(nextRef);
  }

  const details = () => formDetails({ mailing, printLater: printLater ? "1" : "" });
  const reference = () => (printLater ? undefined : refNo.trim() || undefined);

  /** The bills API posts a bare payment; this puts the form's own fields on it. */
  async function addFormFields(transactionId: string): Promise<Transaction> {
    const txn = await services.transactionService.getTransactionById(transactionId);
    return services.transactionService.updateTransaction(txn.id, {
      transactionDate: txn.transactionDate,
      dueDate: txn.dueDate,
      referenceNumber: reference(),
      memo: memo.trim() || txn.memo,
      payee: txn.payee,
      accountLabel: txn.accountLabel,
      sourceAccountId: accountId,
      details: details(),
      postings: txn.postings
    });
  }

  async function saveExisting(after: "close" | "new") {
    if (!loaded) return setError(loadError ?? "This transaction is still loading.");
    if (!paymentAccount) return setError("Choose the bank or credit account.");
    if (!date) return setError("Enter the payment date.");
    const debit = loaded.postings.find((p) => p.type === "DEBIT")!;
    const credit = loaded.postings.find((p) => p.type === "CREDIT")!;
    const total = amountLocked ? credit.amount : cents(amount) / 100;
    if (total <= 0) return setError("Enter the amount.");
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
    if (cents(amount) <= 0) return setError("Enter the amount.");
    if (cents(amount) < appliedCents) return setError(`The amount must cover whole bills (selected bills total ${money(appliedCents / 100)}). Partial payments aren't supported yet.`);
    setSaving(true);
    setError(null);
    try {
      let last: Transaction | undefined;
      for (const bill of selected) {
        const paid = await payBill(bill.id, { paymentAccountId: paymentAccount.id, paymentDate: date });
        if (paid.paymentTransactionId) last = await addFormFields(paid.paymentTransactionId);
      }
      if (creditCents > 0) {
        let payableId = last?.postings.find((p) => p.type === "DEBIT")?.accountId ?? findPayableAccount(accounts)?.id;
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
            { accountId: payableId, type: "DEBIT", amount: creditCents / 100 },
            { accountId: paymentAccount.id, type: "CREDIT", amount: creditCents / 100 }
          ]
        });
        last = await services.transactionService.postTransaction(created.id);
      }
      if (last) await attachments.linkTo(last.id).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      toast({ variant: "success", title: "Bill payment saved" });
      if (after === "close") closePage();
      else {
        resetForm(/^\d+$/.test(refNo.trim()) ? String(Number(refNo) + 1).padStart(refNo.trim().length, "0") : refNo);
        reload();
      }
    } catch (err) {
      // Some bills may already be paid: start the amounts over so a retry can't record them twice.
      setPicked(new Set());
      setAmount("");
      setError(`${err instanceof Error ? err.message : "Could not save this bill payment."} Check which bills are still open before trying again.`);
      reload();
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
      <button type="button" onClick={() => window.print()} className={FOOTER_LINK}>Print check</button>
      <button type="button" disabled title="Ordering checks isn't available yet" className={FOOTER_LINK}>Order checks</button>
      <button type="button" disabled title="More options aren't available yet" className={FOOTER_LINK}>More</button>
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
              onChange={(event) => typeAmount(event.target.value.replace(/[^0-9.]/g, ""))}
              disabled={amountLocked}
              placeholder="$0.00"
              className="text-right"
            />
          </div>
        </div>
        {paidByThis.length > 0 ? <p className="mt-2 text-right text-xs">This payment paid {paidByThis.length === 1 ? "a bill" : "bills"} in full, so its payee and amount can&apos;t change.</p> : null}

        <section>
          <h2 className={SECTION_TITLE}>Outstanding Transactions</h2>
          <ListTools placeholder="Find Bill No." value={billSearch} onChange={setBillSearch}>
            <button type="button" onClick={copyBillMemos} disabled={selected.length === 0} className={RT_BUTTON}>Copy Memos from Bills</button>
            <button type="button" disabled title="Copying the reference number to bills isn't available yet" className={RT_BUTTON}>Copy Payment Ref# to Bills</button>
          </ListTools>
          <table className="mt-4 w-full table-fixed border-collapse border-b-2 border-[var(--color-divider-tertiary)] text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
                <th className="w-14 px-3 py-3 text-center"><input type="checkbox" aria-label="Select all bills" checked={allPicked} disabled={Boolean(txnId) || rows.length === 0} onChange={() => pick(new Set(allPicked ? [] : rows.map((b) => b.id)))} className={CHECKBOX} /></th>
                <th className={TH}>Description</th>
                <th className={`${TH} w-[16%]`}>Due date ▲</th>
                <th className={`${TH} w-[20%] text-right`}>Original amount</th>
                <th className={`${TH} w-[20%] text-right`}>Open balance</th>
                <th className={`${TH} w-[16%] text-right`}>Payment</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const paidHere = paidByThis.includes(b);
                const ticked = txnId ? paidHere : picked.has(b.id);
                return (
                  <tr key={b.id} className="border-b border-[var(--color-divider-tertiary)]">
                    <td className="px-3 py-3 text-center"><input type="checkbox" checked={ticked} disabled={Boolean(txnId)} title={txnId && !paidHere ? "Applying a saved payment to bills isn't available yet" : undefined} onChange={() => toggle(b.id)} aria-label={`Pay bill ${b.billNumber ?? ""}`} className={CHECKBOX} /></td>
                    <td className={TD}>Bill{b.billNumber ? ` # ${b.billNumber}` : ""} ({usDate(b.billDate)})</td>
                    <td className={TD}>{usDate(b.dueDate)}</td>
                    <td className={`${TD} text-right`}>{money(b.amount)}</td>
                    <td className={`${TD} text-right`}>{money(paidHere ? 0 : b.amount)}</td>
                    <td className={TD}><div className={PAYMENT_BOX}>{ticked ? b.amount.toFixed(2) : ""}</div></td>
                  </tr>
                );
              })}
              {rows.length === 0 ? <tr><td colSpan={6} className="px-3 py-14 text-center">You don&apos;t have any bills.</td></tr> : null}
            </tbody>
          </table>
          <ListCount count={rows.length} />
        </section>

        {credits.length > 0 ? (
          <section className="mt-8">
            <h2 className={SECTION_TITLE}>Credits</h2>
            <ListTools placeholder="Find Credit No." value={creditSearch} onChange={setCreditSearch} />
            <table className="mt-4 w-full table-fixed border-collapse border-b-2 border-[var(--color-divider-tertiary)] text-sm">
              <thead>
                <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
                  <th className={TH}>Description</th>
                  <th className={`${TH} w-[24%] text-right`}>Original amount</th>
                  <th className={`${TH} w-[27%] text-right`}>Open balance</th>
                </tr>
              </thead>
              <tbody>
                {creditRows.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--color-divider-tertiary)]">
                    <td className={TD}><a href={`/billpayment?txnId=${c.id}`} className="text-[var(--color-link-action)] hover:underline">Unapplied payment</a> <span className="text-xs">({usDate(c.date)})</span></td>
                    <td className={`${TD} text-right`}>{money(c.amount)}</td>
                    <td className={`${TD} text-right`}>{money(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
            <p className="flex w-full justify-between"><strong className="text-[var(--color-text-global)]">Amount to Apply</strong><span>{money(cents(amount) / 100)}</span></p>
            <p className="flex w-full justify-between"><strong className="text-[var(--color-text-global)]">Amount to Credit</strong><span>{money(creditCents / 100)}</span></p>
            <Button variant="secondary" className="mt-2 !rounded-md" disabled={Boolean(txnId)} onClick={() => pick(new Set())}>Clear Payment</Button>
            {creditCents > 0 ? <p className="mt-2">This transaction will create an additional credit in the amount of {(creditCents / 100).toFixed(2)}</p> : null}
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
