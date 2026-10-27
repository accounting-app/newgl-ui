"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AttachmentsField } from "@/components/accounting/attachments-field";
import { FullScreenFormShell, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { AddAccountModal } from "@/components/bank-register/add-account-modal";
import { Button } from "@/components/ui/button";
import { INPUT_BASE_CLASSES, InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { nextAccountCode } from "@/lib/accounting/next-account-code";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFormAttachments } from "@/lib/hooks/use-form-attachments";
import { usePaymentMethods } from "@/lib/hooks/use-payment-methods";
import { listInvoices, payInvoice } from "@/lib/services/invoices-service";
import type { Invoice } from "@/lib/services/invoices-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

const DEPOSIT_CATEGORIES = new Set<Account["category"]>(["BANK", "OTHER_CURRENT_ASSET"]);
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const CARD = "rounded-xl border border-[var(--color-container-border-secondary)] bg-[var(--color-container-background-primary)]";
const CARD_TITLE = "border-b border-[var(--color-divider-tertiary)] px-5 py-4 text-lg text-[var(--color-text-global)]";

const cents = (value: number | string) => Math.round((Number(value) || 0) * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });

// QBO's full-screen Receive Payment (/recvpayment?rtAccountId=...&rt=close).
// rtAccountId is the account the money lands in. Record pays each ticked open
// invoice in full (the ledger has no partial payments): deposit account
// debited, accounts receivable credited.
export function ReceivePaymentFormPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: customers } = useCustomers();
  const methods = usePaymentMethods();
  const attachments = useFormAttachments();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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
    listInvoices().then(setInvoices).catch(() => setInvoices([]));
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

  const depositAccounts = useMemo(() => accounts.filter((a) => a.status === "ACTIVE" && DEPOSIT_CATEGORIES.has(a.category)).sort((a, b) => a.name.localeCompare(b.name)), [accounts]);
  const depositAccount = accounts.find((a) => a.id === depositId);
  useEffect(() => {
    if (accounts.length === 0 || depositAccount) return;
    if (depositAccounts[0]) setDepositId(depositAccounts[0].id);
  }, [accounts, depositAccount, depositAccounts]);

  const customerRecord = customers.find((c) => c.name === customer);
  const customerOptions = useMemo(() => customers.map((c) => ({ value: c.name, label: c.name, rightLabel: "Customer" })), [customers]);
  const depositOptions = useMemo(() => depositAccounts.map((a) => ({ value: a.id, label: a.name })), [depositAccounts]);
  // Oldest due first: that's the order a typed amount is applied in.
  const open = useMemo(() => invoices.filter((i) => i.status === "OPEN" && i.customerId === customerRecord?.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)), [invoices, customerRecord]);
  const customerBalance = open.reduce((sum, i) => sum + i.amount, 0);
  const appliedCents = open.filter((i) => picked.has(i.id)).reduce((sum, i) => sum + cents(i.amount), 0);

  const closePage = () => leaveFormPage(router);
  function chooseCustomer(name: string) {
    setCustomer(name);
    setPicked(new Set());
    setAmount("");
  }
  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
    const total = open.filter((i) => next.has(i.id)).reduce((sum, i) => sum + cents(i.amount), 0);
    setAmount(total > 0 ? (total / 100).toFixed(2) : "");
  }
  function typeAmount(value: string) {
    setAmount(value);
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

  async function save(after: "stay" | "close") {
    setMenuOpen(false);
    if (!depositAccount) return setError("Choose the account to deposit to.");
    if (!customerRecord) return setError("Choose a customer.");
    if (picked.size === 0) return setError("Tick at least one open invoice to pay.");
    if (cents(amount) !== appliedCents) return setError(`The amount received must cover whole invoices (selected invoices total ${money(appliedCents / 100)}). Partial payments aren't supported yet.`);
    setSaving(true);
    setError(null);
    try {
      let lastTransactionId: string | undefined;
      for (const invoice of open.filter((i) => picked.has(i.id))) {
        const paid = await payInvoice(invoice.id, { depositAccountId: depositAccount.id, paymentDate: date });
        lastTransactionId = paid.paymentTransactionId ?? lastTransactionId;
      }
      if (lastTransactionId) await attachments.linkTo(lastTransactionId).catch(() => toast({ variant: "error", title: "Saved, but the attachments could not be linked" }));
      toast({ variant: "success", title: "Payment recorded" });
      if (after === "close") closePage();
      else {
        resetForm();
        reload();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record this payment.");
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

  const footer = (
    <>
      <button type="button" onClick={closePage} className="text-base font-medium text-[var(--color-text-global)] hover:underline">Cancel</button>
      <button type="button" onClick={() => window.print()} className="text-base font-medium text-[var(--color-text-global)] hover:underline">Print</button>
      <div className="flex items-center gap-3">
        <Button variant="secondary" className="!rounded-md" disabled={saving} onClick={() => void save("stay")}>Record</Button>
        <div ref={menuRef} className="relative inline-flex">
          <Button className="!rounded-l-md !rounded-r-none" disabled={saving} onClick={() => void save("close")}>{saving ? "Recording..." : "Record and close"}</Button>
          <Button className="!rounded-l-none !rounded-r-md border-l border-l-white/30 !min-w-0 px-2" aria-label="More record options" disabled={saving} onClick={() => setMenuOpen((v) => !v)}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          {menuOpen ? (
            <div className="absolute bottom-full right-0 mb-1 w-44 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
              <button type="button" onClick={() => void save("stay")} className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Record and new</button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <FullScreenFormShell title="Receive Payment" onClose={closePage} footer={footer}>
      <div className="px-6 pb-8 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className={LABEL}>Customer</span>
            <div className="flex items-start gap-4">
              <div className="w-[400px] max-w-full">
                <Select value={customer} onChange={chooseCustomer} options={customerOptions} placeholder="Choose a customer" allowCustomValue={false} />
                {customerRecord ? (
                  <button type="button" onClick={() => window.open(`/customerdetail?nameId=${encodeURIComponent(customerRecord.id)}`, "_blank")} className="mt-1 block text-sm font-medium text-[var(--color-negative)] underline hover:no-underline">Payee Details</button>
                ) : null}
              </div>
              <Button variant="secondary" className="!rounded-md" onClick={() => setFindOpen(true)}>Find by invoice no.</Button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase text-[var(--color-text-global)]">Amount received</p>
            <p className="text-5xl text-[var(--color-text-global)]">{money(cents(amount) / 100)}</p>
            <p className="mt-3 text-sm"><strong className="text-[var(--color-text-global)]">Customer balance</strong><br />{money(customerBalance)}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-start gap-6">
          <section className={`${CARD} w-[860px] max-w-full`}>
            <h2 className={CARD_TITLE}>Record or charge</h2>
            <div className="flex flex-wrap gap-8 px-5 py-5">
              <div className="w-[340px] space-y-6">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="radio" name="pay-mode" checked={!charge} onChange={() => setCharge(false)} className="mt-1 h-5 w-5 accent-[var(--color-ui-primary)]" />
                  <span><span className="block text-lg text-[var(--color-text-global)]">Record payment</span><span className="text-sm">Received via check, cash, other</span></span>
                </label>
                <label className="flex cursor-not-allowed items-start gap-3 opacity-60" title="Charging cards isn't available yet">
                  <input type="radio" name="pay-mode" checked={charge} disabled className="mt-1 h-5 w-5" />
                  <span><span className="block text-lg text-[var(--color-text-global)]">Charge new payment</span><span className="text-sm">Process a card or ACH bank transfer</span></span>
                </label>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label className={LABEL} htmlFor="rp-date">Payment Date</label>
                  <InputField id="rp-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="rp-ref">Reference no.</label>
                  <InputField id="rp-ref" value={refNo} onChange={(event) => setRefNo(event.target.value)} />
                </div>
                <div>
                  <span className={LABEL}>Payment method</span>
                  <Select value={method} onChange={setMethod} options={methods.options} placeholder="" allowCustomValue={false} onAddNew={() => setMethodModalOpen(true)} addNewLabel="+ Add new" />
                </div>
                <div>
                  <span className={LABEL}>Deposit To</span>
                  <Select value={depositId} onChange={setDepositId} options={depositOptions} placeholder="Select account" allowCustomValue={false} onAddNew={() => setAccountModalOpen(true)} addNewLabel="+ Add new" />
                </div>
              </div>
            </div>
          </section>
          <section className={`${CARD} w-[590px] max-w-full`}>
            <h2 className={CARD_TITLE}>Amount</h2>
            <div className="px-5 py-5">
              <label className={LABEL} htmlFor="rp-amount">Amount received</label>
              <InputField id="rp-amount" type="number" min="0" step="0.01" value={amount} onChange={(event) => typeAmount(event.target.value)} placeholder="$0.00" className="w-[350px] max-w-full" />
            </div>
          </section>
        </div>

        {customerRecord ? (
          <section className="mt-8">
            <h2 className="mb-2 text-2xl text-[var(--color-text-global)]">Outstanding transactions</h2>
            {open.length === 0 ? <p className="py-4">{customer} has no open invoices.</p> : (
              <table className="w-full table-fixed border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]">
                    <th className="w-12 px-2 py-3" />
                    <th className="px-2 py-3">Description</th>
                    <th className="w-[14%] px-2 py-3">Due date</th>
                    <th className="w-[16%] px-2 py-3 text-right">Original amount</th>
                    <th className="w-[16%] px-2 py-3 text-right">Open balance</th>
                    <th className="w-[16%] px-2 py-3 text-right">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {open.map((i) => (
                    <tr key={i.id} className="border-b border-[var(--color-divider-tertiary)]">
                      <td className="px-2 py-3"><input type="checkbox" checked={picked.has(i.id)} onChange={() => toggle(i.id)} aria-label={`Pay invoice ${i.invoiceNumber ?? ""}`} className="h-5 w-5 cursor-pointer accent-[var(--color-ui-primary)]" /></td>
                      <td className="px-2 py-3">Invoice{i.invoiceNumber ? ` # ${i.invoiceNumber}` : ""} ({new Date(`${i.invoiceDate}T00:00:00`).toLocaleDateString("en-US")})</td>
                      <td className="px-2 py-3">{new Date(`${i.dueDate}T00:00:00`).toLocaleDateString("en-US")}</td>
                      <td className="px-2 py-3 text-right">{money(i.amount)}</td>
                      <td className="px-2 py-3 text-right">{money(i.amount)}</td>
                      <td className="px-2 py-3 text-right">{picked.has(i.id) ? money(i.amount) : ""}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold text-[var(--color-text-global)]"><td colSpan={5} className="px-2 py-3 text-right">Amount to apply</td><td className="px-2 py-3 text-right">{money(appliedCents / 100)}</td></tr>
                </tbody>
              </table>
            )}
          </section>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-8">
          <div className="w-[460px] max-w-full">
            <label className={LABEL} htmlFor="rp-memo">Memo</label>
            <textarea id="rp-memo" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="Note" className={`${INPUT_BASE_CLASSES} h-[122px] resize-none rounded px-3 py-2 text-sm`} />
          </div>
          <div className="w-[660px] max-w-full"><AttachmentsField attachments={attachments} formLabel="Payment" /></div>
        </div>
        {error ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error}</p> : null}
        <p className="mt-6 text-center"><a href="https://www.intuit.com/privacy/" target="_blank" rel="noreferrer" className="text-[var(--color-link-action)] hover:underline">Privacy</a></p>
      </div>

      <Modal open={findOpen} onClose={() => setFindOpen(false)} title="Find by invoice no." size="sm">
        <InputField value={findNo} onChange={(event) => setFindNo(event.target.value)} placeholder="Invoice number" aria-label="Invoice number" autoFocus onKeyDown={(event) => event.key === "Enter" && findInvoice()} />
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setFindOpen(false)}>Cancel</Button>
          <Button onClick={findInvoice} disabled={!findNo.trim()}>Find</Button>
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
          <Button onClick={addMethod} disabled={!newMethod.trim()}>Save</Button>
        </div>
      </Modal>
    </FullScreenFormShell>
  );
}
