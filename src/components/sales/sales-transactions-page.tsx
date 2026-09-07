"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import type { Invoice } from "@/lib/services/invoices-service";
import { InvoiceFormDrawer } from "@/components/sales/invoice-form-drawer";
import { useSalesData } from "@/components/sales/use-sales-data";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABEL: Record<Invoice["status"], string> = { DRAFT: "Draft", OPEN: "Unpaid", PAID: "Paid" };

// Phase 1: the combined sales ledger -- every invoice, in one list,
// mirroring how Expense Transactions is the combined view over Bills.
// Shows the reference's first-run hero until there's at least one real
// invoice, then a real table.
export function SalesTransactionsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const { customers, productsServices, invoices, addInvoice, addCustomer } = useSalesData();
  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false);

  const customerNameById = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const sorted = useMemo(() => [...invoices].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)), [invoices]);

  async function handleSaveInvoice(input: Omit<Invoice, "id" | "createdAt" | "status">) {
    try {
      await addInvoice(input);
      setShowInvoiceDrawer(false);
      toast({ variant: "success", title: "Invoice created" });
    } catch (err) {
      toast({ variant: "error", title: "Could not create this invoice", description: err instanceof Error ? err.message : undefined });
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
            <h2 className="text-4xl font-semibold leading-tight text-[var(--color-text-global)]">Create and send invoices — then get paid</h2>
            <ul className="mt-5 flex flex-col gap-2 text-sm text-[var(--color-text-primary)]">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
                Track every invoice you send in one place
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
                Keep customer and item details on hand for next time
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
                See at a glance what&apos;s unpaid and what&apos;s been paid
              </li>
            </ul>
            <div className="mt-6">
              <Button onClick={() => setShowInvoiceDrawer(true)}>Create an invoice</Button>
            </div>
          </div>
          <FileText className="hidden h-28 w-28 shrink-0 text-[var(--color-positive)] lg:block" aria-hidden="true" />
        </div>

        <div className="mt-8 border-t border-[var(--color-divider-tertiary)] pt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Tips &amp; resources</p>
          <ul className="flex flex-col gap-1.5 text-sm">
            <li>
              <button type="button" onClick={() => setShowInvoiceDrawer(true)} className="text-[var(--color-link-action)] hover:underline">
                Create and send invoices
              </button>
            </li>
            <li>
              <button type="button" disabled title="No online payment collection yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">
                Record a customer payment
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
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Sales transactions</h1>
        <Button onClick={() => setShowInvoiceDrawer(true)}>Create an invoice</Button>
      </div>

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">Date</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Customer</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Invoice #</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Amount</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Status</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {sorted.map((invoice) => (
              <tr key={invoice.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                <td className="p-2 align-top text-[13px] text-[var(--color-text-primary)]">{invoice.invoiceDate}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] font-medium text-[var(--color-text-global)]">
                  {customerNameById.get(invoice.customerId) ?? "Unknown customer"}
                </td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{invoice.invoiceNumber || "--"}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">{formatMoney(invoice.amount)}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{STATUS_LABEL[invoice.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvoiceDrawer ? (
        <InvoiceFormDrawer customers={customers} productsServices={productsServices} onAddCustomer={addCustomer} onSave={handleSaveInvoice} onClose={() => setShowInvoiceDrawer(false)} />
      ) : null}
    </>
  );
}
