"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, FilePlus2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input-field";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { useSalesData } from "@/components/sales/use-sales-data";
import { InvoiceFormDrawer } from "@/components/sales/invoice-form-drawer";
import { EstimateFormDrawer } from "@/components/customer-hub/estimate-form-drawer";
import { ImportCustomersModal } from "@/components/customer-hub/import-customers-modal";
import type { Estimate, Invoice } from "@/lib/local-store/sales-types";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function FunnelStage({ label, value, tooltip, last = false }: { label: string; value: string; tooltip?: string; last?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-[150px] flex-1 rounded-lg border border-[var(--color-divider-tertiary)] p-4" title={tooltip}>
        <p className="text-sm text-[var(--color-text-global)]">{label}</p>
        <p className="mt-1 text-lg font-semibold text-[var(--color-text-global)]">{value}</p>
      </div>
      {!last ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-icon-secondary)]" aria-hidden="true" /> : null}
    </div>
  );
}

// Phase 1: real local data for the pieces this app actually tracks
// (estimates, invoices, customers). Open opportunities/contracts, in-
// progress projects, and reviews are QBO features with no equivalent
// here at all (CRM pipeline, project tracking, review collection) --
// shown honestly as "--" rather than fabricated, same as Reviews/
// Opportunities in the reference having no real backing data either
// without their own paid add-ons.
export function CustomerHubOverviewPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const { customers, productsServices, invoices, estimates, addInvoice, addEstimate, addCustomer, addCustomerRecord } = useSalesData();

  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false);
  const [showEstimateDrawer, setShowEstimateDrawer] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");

  const openEstimates = useMemo(() => estimates.filter((e) => e.status === "OPEN"), [estimates]);
  const overdueInvoices = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return invoices.filter((i) => i.status === "OPEN" && i.dueDate < today);
  }, [invoices]);
  const overdueTotal = useMemo(() => overdueInvoices.reduce((sum, i) => sum + i.amount, 0), [overdueInvoices]);
  const unpaidInvoices = useMemo(() => invoices.filter((i) => i.status === "OPEN"), [invoices]);

  function handleSaveInvoice(input: Omit<Invoice, "id" | "createdAt" | "status">) {
    addInvoice(input);
    setShowInvoiceDrawer(false);
    toast({ variant: "success", title: "Invoice created" });
  }

  function handleSaveEstimate(input: Omit<Estimate, "id" | "createdAt" | "status">) {
    addEstimate(input);
    setShowEstimateDrawer(false);
    toast({ variant: "success", title: "Estimate created" });
  }

  async function handleQuickAddCustomer() {
    if (!quickCustomerName.trim()) return;
    try {
      await addCustomerRecord({ name: quickCustomerName.trim() });
      toast({ variant: "success", title: "Customer added" });
      setQuickCustomerName("");
      setShowQuickAddCustomer(false);
    } catch (err) {
      toast({ variant: "error", title: "Could not add this customer", description: err instanceof Error ? err.message : undefined });
    }
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text-global)]">Customer Hub overview</h1>

      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--color-text-global)]">Customers at a glance</h2>
        <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)]">
          Give us feedback
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-[var(--color-divider-tertiary)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Customers funnel</p>
          <span className="text-sm text-[var(--color-text-disabled)]">Last 365 days</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FunnelStage label="Open opportunities" value="--" tooltip="No sales-pipeline tracking in this app yet" />
          <FunnelStage label="Open estimates" value={String(openEstimates.length)} />
          <FunnelStage label="Open contracts" value="--" tooltip="No contracts feature in this app" />
          <FunnelStage label="In progress projects" value="--" tooltip="No project tracking in this app" />
          <FunnelStage label="Unpaid invoices" value={String(unpaidInvoices.length)} />
          <FunnelStage label="Reviews" value="--" tooltip="No review collection in this app" last />
        </div>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col rounded-lg border border-[var(--color-divider-tertiary)] p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Overdue invoices</p>
          <p className="text-lg font-semibold text-[var(--color-text-global)]">You have {formatMoney(overdueTotal)} in invoices that are overdue.</p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">Create an invoice for your next job!</p>
          <Button className="mt-6 w-full" variant="secondary" onClick={() => setShowInvoiceDrawer(true)}>
            Create an invoice
          </Button>
        </div>
        <div className="flex flex-col rounded-lg border border-[var(--color-divider-tertiary)] p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Open estimates</p>
          <p className="text-lg font-semibold text-[var(--color-text-global)]">
            {openEstimates.length === 0 ? "You have no open estimates." : `You have ${openEstimates.length} open estimate${openEstimates.length === 1 ? "" : "s"}.`}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">Create an estimate to win more jobs!</p>
          <Button className="mt-6 w-full" variant="secondary" onClick={() => setShowEstimateDrawer(true)}>
            Create an estimate
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-[var(--color-divider-tertiary)] p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Needs attention</p>
          <div className="flex items-center gap-4 border-b border-[var(--color-divider-tertiary)] pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
            <span className="flex-1">Task</span>
            <span className="w-24 text-right">Assigned to</span>
            <span className="w-24 text-right">Due date</span>
            <span className="w-16 text-right">Actions</span>
          </div>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <CheckCircle2 className="h-6 w-6 text-[var(--color-positive)]" aria-hidden="true" />
            <p className="font-semibold text-[var(--color-text-global)]">You&apos;re caught up!</p>
            <p className="text-sm text-[var(--color-text-disabled)]">There&apos;s no task list in this app yet, so nothing to check back on here.</p>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-divider-tertiary)] p-5">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Shortcuts</p>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => setShowQuickAddCustomer(true)} className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-container-background-accent)] text-[var(--color-icon-secondary)]">
                <UserPlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-[var(--color-text-global)]">New Customer</span>
            </button>
            <button type="button" onClick={() => setShowImportModal(true)} className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-container-background-accent)] text-[var(--color-icon-secondary)]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-[var(--color-text-global)]">Import Customers</span>
            </button>
            <button type="button" onClick={() => setShowInvoiceDrawer(true)} className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-container-background-accent)] text-[var(--color-icon-secondary)]">
                <FilePlus2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-[var(--color-text-global)]">Create Invoice</span>
            </button>
            <Link href="/all-apps/customer-hub/customers" className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-container-background-accent)] text-[var(--color-icon-secondary)]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-[var(--color-text-global)]">View Customers</span>
            </Link>
          </div>
        </div>
      </div>

      {showQuickAddCustomer ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4" onClick={() => setShowQuickAddCustomer(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm">
            <Card title="New customer">
              <InputField label="Customer name" placeholder="e.g. Jane Smith" value={quickCustomerName} onChange={(e) => setQuickCustomerName(e.target.value)} />
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowQuickAddCustomer(false)}>
                  Cancel
                </Button>
                <Button onClick={handleQuickAddCustomer} disabled={quickCustomerName.trim() === ""}>
                  Add customer
                </Button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {showInvoiceDrawer ? (
        <InvoiceFormDrawer customers={customers} productsServices={productsServices} onAddCustomer={addCustomer} onSave={handleSaveInvoice} onClose={() => setShowInvoiceDrawer(false)} />
      ) : null}
      {showEstimateDrawer ? (
        <EstimateFormDrawer customers={customers} productsServices={productsServices} onAddCustomer={addCustomer} onSave={handleSaveEstimate} onClose={() => setShowEstimateDrawer(false)} />
      ) : null}
      {showImportModal ? <ImportCustomersModal onClose={() => setShowImportModal(false)} /> : null}
    </>
  );
}
