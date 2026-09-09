"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import type { Invoice, InvoiceStatus } from "@/lib/services/invoices-service";
import { InvoiceFormDrawer } from "@/components/sales/invoice-form-drawer";
import { useSalesData } from "@/components/sales/use-sales-data";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TABS: InvoiceStatus[] = ["OPEN", "PAID"];
const STATUS_LABEL: Record<InvoiceStatus, string> = { DRAFT: "Draft", OPEN: "Unpaid", PAID: "Paid" };

// Phase 1.5, Step 7: real invoices that post real ledger transactions --
// see @/lib/hooks/use-invoices. Collecting a real online payment (the
// reference's "QuickBooks Payments" hero) needs a payments processor
// integration this app doesn't have -- "Compare rates" stays disabled,
// and "Create invoice" is genericized to not brand a feature we don't
// offer as a named third-party product; "Mark paid" here still records a
// real deposit against a bank/credit account you pick, just not via an
// online payments processor.
export function InvoicesPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const { customers, productsServices, invoices, addInvoice, addCustomer, payInvoice, removeInvoice } = useSalesData();
  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false);
  const [tab, setTab] = useState<InvoiceStatus>("OPEN");

  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);

  const customerNameById = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const tabCounts = useMemo(() => Object.fromEntries(TABS.map((s) => [s, invoices.filter((i) => i.status === s).length])), [invoices]);
  const tabInvoices = useMemo(() => invoices.filter((i) => i.status === tab).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)), [invoices, tab]);
  const total = useMemo(() => tabInvoices.reduce((sum, i) => sum + i.amount, 0), [tabInvoices]);

  async function handleSaveInvoice(input: Omit<Invoice, "id" | "createdAt" | "status">) {
    try {
      await addInvoice(input);
      setShowInvoiceDrawer(false);
      toast({ variant: "success", title: "Invoice created" });
    } catch (err) {
      toast({ variant: "error", title: "Could not create this invoice", description: err instanceof Error ? err.message : undefined });
    }
  }

  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  async function handleConfirmPay(depositAccountId: string, paymentDate: string) {
    if (!payingInvoice) return;
    try {
      await payInvoice(payingInvoice.id, { depositAccountId, paymentDate });
      toast({ variant: "success", title: "Invoice marked paid" });
      setPayingInvoice(null);
    } catch (err) {
      toast({ variant: "error", title: "Could not mark this invoice paid", description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleDelete(invoiceId: string) {
    try {
      await removeInvoice(invoiceId);
      toast({ variant: "success", title: "Invoice deleted" });
    } catch (err) {
      toast({ variant: "error", title: "Could not delete this invoice", description: err instanceof Error ? err.message : undefined });
    }
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (invoices.length === 0) {
    return (
      <>
        <div className="flex flex-col gap-8 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-4xl font-semibold leading-tight text-[var(--color-text-global)]">Streamline invoicing so you get paid</h2>
            <ul className="mt-5 flex flex-col gap-2 text-sm text-[var(--color-text-primary)]">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
                <span>
                  <span className="font-medium text-[var(--color-text-global)]">Create invoices in seconds</span>{" "}
                  from customers and items you&apos;ve already saved
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
                <span>
                  <span className="font-medium text-[var(--color-text-global)]">Track what&apos;s unpaid</span> so nothing falls through the cracks
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
                <span>
                  <span className="font-medium text-[var(--color-text-global)]">Mark invoices paid</span>{" "}
                  once the money&apos;s in hand
                </span>
              </li>
            </ul>
            <div className="mt-6 flex gap-3">
              <Button onClick={() => setShowInvoiceDrawer(true)}>Create invoice</Button>
              <button type="button" disabled title="No payments processor integration yet" className="cursor-not-allowed rounded-full border border-[var(--color-button-border)] px-5 py-2 text-sm font-medium text-[var(--color-text-disabled)]">
                Compare rates
              </button>
            </div>
          </div>
          <FileText className="hidden h-28 w-28 shrink-0 text-[var(--color-ui-primary)] lg:block" aria-hidden="true" />
        </div>

        <div className="mt-8 border-t border-[var(--color-divider-tertiary)] pt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Tips &amp; resources</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li>
              <button type="button" disabled title="No online payment collection yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">
                Record a customer payment
              </button>
            </li>
            <li>
              <button type="button" onClick={() => setShowInvoiceDrawer(true)} className="text-[var(--color-link-action)] hover:underline">
                Create and send invoices
              </button>
            </li>
          </ul>
        </div>

        {showInvoiceDrawer ? (
          <InvoiceFormDrawer customers={customers} productsServices={productsServices} onAddCustomer={addCustomer} onSave={handleSaveInvoice} onClose={() => setShowInvoiceDrawer(false)} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Invoices</h1>
        <Button onClick={() => setShowInvoiceDrawer(true)}>Create invoice</Button>
      </div>

      <div className="mb-4 inline-flex gap-1 rounded-lg border border-[var(--color-divider-tertiary)] p-1">
        {TABS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setTab(status)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === status ? "bg-[var(--color-container-background-accent)] text-[var(--color-text-global)]" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
            }`}
          >
            {STATUS_LABEL[status]} {tabCounts[status] ? `(${tabCounts[status]})` : ""}
          </button>
        ))}
      </div>

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">Customer</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Invoice #</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Invoice date</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Due date</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Amount</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {tabInvoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-10 text-center text-sm text-[var(--color-text-disabled)]">
                  No {STATUS_LABEL[tab].toLowerCase()} invoices.
                </td>
              </tr>
            ) : (
              tabInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top text-[13px] font-medium text-[var(--color-text-global)]">{customerNameById.get(invoice.customerId) ?? "Unknown customer"}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{invoice.invoiceNumber || "--"}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{invoice.invoiceDate}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{invoice.dueDate}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">{formatMoney(invoice.amount)}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                    <div className="flex justify-end gap-3 text-[13px]">
                      {invoice.status !== "PAID" ? (
                        <button type="button" onClick={() => setPayingInvoice(invoice)} className="font-medium text-[var(--color-link-action)] hover:underline">
                          Mark paid
                        </button>
                      ) : null}
                      <button type="button" onClick={() => handleDelete(invoice.id)} className="font-medium text-[var(--color-negative)] hover:underline">
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {tabInvoices.length > 0 ? (
        <div className="mt-1 flex justify-end border-t border-[var(--color-divider-tertiary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-global)]">Total: {formatMoney(total)}</div>
      ) : null}

      {showInvoiceDrawer ? (
        <InvoiceFormDrawer customers={customers} productsServices={productsServices} onAddCustomer={addCustomer} onSave={handleSaveInvoice} onClose={() => setShowInvoiceDrawer(false)} />
      ) : null}

      {payingInvoice ? (
        <PayInvoiceDialog
          invoice={payingInvoice}
          customerName={customerNameById.get(payingInvoice.customerId) ?? "this customer"}
          accounts={accounts}
          onConfirm={handleConfirmPay}
          onClose={() => setPayingInvoice(null)}
        />
      ) : null}
    </>
  );
}

// A real bank/credit account is required to post the payment leg (Dr
// Cash-or-Bank, Cr Accounts Receivable) -- mirrors PayBillDialog on the
// Bills screen, the AP side of this exact same need.
function PayInvoiceDialog({
  invoice,
  customerName,
  accounts,
  onConfirm,
  onClose
}: {
  invoice: Invoice;
  customerName: string;
  accounts: Account[];
  onConfirm: (depositAccountId: string, paymentDate: string) => Promise<void>;
  onClose: () => void;
}) {
  const depositAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "BANK" || a.category === "CREDIT_CARD").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const [depositAccountId, setDepositAccountId] = useState(depositAccountOptions[0]?.value ?? "");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!depositAccountId) return;
    setSubmitting(true);
    try {
      await onConfirm(depositAccountId, paymentDate);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="w-full max-w-sm rounded-lg bg-[var(--color-container-background-primary)] p-5 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-[var(--color-text-global)]">Mark invoice paid</h2>
        <p className="mb-4 text-sm text-[var(--color-text-primary)]">
          {formatMoney(invoice.amount)} from {customerName}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Select label="Deposit to" value={depositAccountId} onChange={setDepositAccountId} options={depositAccountOptions} placeholder="Select account" allowCustomValue={false} />
          <InputField label="Payment date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <div className="mt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={!depositAccountId || submitting}>
              {submitting ? "Marking paid…" : "Mark paid"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
