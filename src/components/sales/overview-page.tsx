"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye, EyeOff, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, usePersistedJSON } from "@/lib/local-store/use-local-collection";
import type { Invoice } from "@/lib/services/invoices-service";
import { InvoiceFormDrawer } from "@/components/sales/invoice-form-drawer";
import { useSalesData } from "@/components/sales/use-sales-data";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type CreateAction = { label: string; disabledReason?: string; onClick?: () => void };

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

// Phase 1: UI-only, local data. Real payment collection ("Activate
// payments", online invoices customers can pay directly, deposits landing
// in a bank feed) needs a payments processor integration this app doesn't
// have, so those stay honestly disabled -- see SALES_CREATE_ACTIONS below
// and the funnel's "Create a new payment request" stage.
export function SalesOverviewPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const { customers, productsServices, invoices, addInvoice, addCustomer, loading } = useSalesData();

  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showInvoiceDrawer, setShowInvoiceDrawer] = useState(false);
  const [showAllActions, setShowAllActions] = useState(false);
  const [glanceHidden, setGlanceHidden] = useState(false);

  const visibleKey = activeCompany ? companyScopedKey(activeCompany.name, "sales-overview-hidden") : "newgl:phase1:pending:sales-overview-hidden";
  const [funnelRange, setFunnelRange] = useState("30");
  const [duration, setDuration] = useState<"month" | "quarter" | "year">("month");
  const [compareToPrevYear, setCompareToPrevYear] = usePersistedJSON(visibleKey, false);

  const notPaidTotal = useMemo(() => invoices.filter((i) => i.status === "OPEN").reduce((sum, i) => sum + i.amount, 0), [invoices]);
  const paidTotal = useMemo(() => invoices.filter((i) => i.status === "PAID").reduce((sum, i) => sum + i.amount, 0), [invoices]);

  const now = new Date();
  const monthlyIncome = useMemo(() => {
    const totals = new Array(12).fill(0);
    invoices
      .filter((i) => i.status === "PAID" && i.invoiceDate.startsWith(String(now.getFullYear())))
      .forEach((i) => {
        totals[Number(i.invoiceDate.slice(5, 7)) - 1] += i.amount;
      });
    return totals;
  }, [invoices, now]);
  const thisMonthIncome = monthlyIncome[now.getMonth()];
  const maxMonthlyIncome = Math.max(...monthlyIncome, 1);

  const SALES_CREATE_ACTIONS: CreateAction[] = [
    { label: "Get paid online", disabledReason: "No online payment collection yet" },
    { label: "Create invoice", onClick: () => setShowInvoiceDrawer(true) },
    { label: "Create payment link", disabledReason: "No online payment collection yet" },
    { label: "Create recurring payment", disabledReason: "No online payment collection yet" },
    { label: "Create sales receipt", disabledReason: "Not available yet" }
  ];

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

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text-global)]">Sales &amp; Get Paid overview</h1>

      {!bannerDismissed ? (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] p-4">
          <div>
            <span className="mr-2 rounded bg-[var(--color-highlight-badge-background)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-highlight-badge-text)]">Tip</span>
            <span className="text-sm font-medium text-[var(--color-text-global)]">Give customers flexibility to pay over time</span>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">Sending invoices customers can pay online tends to get paid faster than paper checks or manual reminders.</p>
            <button type="button" disabled title="Not available yet" className="mt-1 cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)]">
              Learn more
            </button>
          </div>
          <button type="button" onClick={() => setBannerDismissed(true)} aria-label="Dismiss" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-base font-semibold text-[var(--color-text-global)]">Create actions</span>
        {SALES_CREATE_ACTIONS.map((action) =>
          action.disabledReason ? (
            <button
              key={action.label}
              type="button"
              disabled
              title={action.disabledReason}
              className="cursor-not-allowed whitespace-nowrap rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]"
            >
              {action.label}
            </button>
          ) : (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className="whitespace-nowrap rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)] hover:text-[var(--color-text-global)]"
            >
              {action.label}
            </button>
          )
        )}
        <button type="button" onClick={() => setShowAllActions(true)} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
          Show all
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--color-text-global)]">Sales &amp; Get Paid at a glance</h2>
        <div className="flex items-center gap-1">
          <IconButton icon={SlidersHorizontal} label="Customize" size="sm" onClick={() => toast({ variant: "info", title: "Not available yet" })} />
          <IconButton icon={glanceHidden ? EyeOff : Eye} label={glanceHidden ? "Show this section" : "Hide this section"} size="sm" onClick={() => setGlanceHidden((v) => !v)} />
        </div>
      </div>

      {glanceHidden ? null : (
        <>
          <div className="mb-4 rounded-lg border border-[var(--color-divider-tertiary)] p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Sales &amp; Get Paid funnel</p>
              <div className="w-36">
                <Select value={funnelRange} onChange={setFunnelRange} options={[{ value: "30", label: "Last 30 days" }]} placeholder="Range" allowCustomValue={false} optionSize="sm" />
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-24 w-full rounded-lg" />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="min-w-[190px] flex-1 rounded-lg border border-[var(--color-divider-tertiary)] p-4">
                    <p className="font-semibold text-[var(--color-text-global)]">Create a new payment request</p>
                    <p className="mt-1 text-sm text-[var(--color-text-primary)]">Start getting paid faster.</p>
                    <button type="button" disabled title="No online payment collection yet" className="mt-2 cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)] underline">
                      Activate payments
                    </button>
                    <div className="mt-3">
                      <Button size="sm" onClick={() => setShowInvoiceDrawer(true)}>
                        Request payment
                      </Button>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                </div>
                <FunnelStage label="Not Paid" value={formatMoney(notPaidTotal)} />
                <FunnelStage label="Paid" value={formatMoney(paidTotal)} />
                <FunnelStage label="Deposited" value={formatMoney(paidTotal)} tooltip="Same as Paid -- this app doesn't track bank deposits separately yet" last />
              </div>
            )}
          </div>

          <div className="mb-4 rounded-lg border border-[var(--color-divider-tertiary)] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Income over time</p>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--color-text-primary)]">Duration:</span>
                  <div className="w-32">
                    <Select
                      value={duration}
                      onChange={(v) => setDuration(v as "month" | "quarter" | "year")}
                      options={[
                        { value: "month", label: "This month" },
                        { value: "quarter", label: "This quarter" },
                        { value: "year", label: "This year" }
                      ]}
                      placeholder="Duration"
                      allowCustomValue={false}
                      optionSize="sm"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                  Compare to previous year:
                  <button
                    type="button"
                    role="switch"
                    aria-checked={compareToPrevYear}
                    onClick={() => setCompareToPrevYear((v) => !v)}
                    className={`relative h-5 w-9 rounded-full transition-colors ${compareToPrevYear ? "bg-[var(--color-ui-primary)]" : "bg-[var(--color-container-background-accent)]"}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${compareToPrevYear ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </label>
              </div>
            </div>

            {loading ? (
              <Skeleton className="h-40 w-full rounded" />
            ) : (
              <>
                <p className="text-2xl font-semibold text-[var(--color-text-global)]">
                  {formatMoney(thisMonthIncome)} <span className="text-sm font-normal text-[var(--color-text-primary)]">This month</span>
                </p>
                {compareToPrevYear ? <p className="mt-1 text-sm text-[var(--color-positive)]">↑ {formatMoney(0)} more than {MONTH_LABELS[now.getMonth()]}, {now.getFullYear() - 1}</p> : null}
                <div className="mt-4 flex h-[144px] items-end gap-2">
                  {monthlyIncome.map((value, i) => (
                    <div key={MONTH_LABELS[i]} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-t bg-[var(--color-positive)]" style={{ height: `${Math.max((value / maxMonthlyIncome) * 128, value > 0 ? 4 : 0)}px` }} title={formatMoney(value)} />
                      <span className="text-[10px] text-[var(--color-icon-secondary)]">{MONTH_LABELS[i]}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border border-[var(--color-divider-tertiary)] p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Suggestions for you</p>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-[var(--color-text-global)]">Get paid faster with online payments</p>
                <p className="mt-1 text-sm text-[var(--color-text-primary)]">Customers who can pay an invoice online, by card or bank transfer, tend to pay sooner than by mail.</p>
              </div>
              <button type="button" disabled title="No payments processor integration yet" className="shrink-0 cursor-not-allowed rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
                Get started
              </button>
            </div>
          </div>
        </>
      )}

      {showInvoiceDrawer ? (
        <InvoiceFormDrawer customers={customers} productsServices={productsServices} onAddCustomer={addCustomer} onSave={handleSaveInvoice} onClose={() => setShowInvoiceDrawer(false)} />
      ) : null}

      {showAllActions ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowAllActions(false)} />
          <div className="relative flex h-full w-[360px] max-w-full flex-col bg-[var(--color-container-background-primary)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-5 py-4">
              <h2 className="text-lg font-semibold text-[var(--color-text-global)]">Create actions</h2>
              <button type="button" onClick={() => setShowAllActions(false)} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto px-2 py-3">
              {[...SALES_CREATE_ACTIONS, { label: "Products & services", onClick: undefined }].map((action) =>
                "onClick" in action && action.onClick ? (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => {
                      setShowAllActions(false);
                      action.onClick?.();
                    }}
                    className="rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                  >
                    {action.label}
                  </button>
                ) : action.label === "Products & services" ? (
                  <Link key={action.label} href="/all-apps/sales-get-paid/products-services" onClick={() => setShowAllActions(false)} className="rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">
                    {action.label}
                  </Link>
                ) : (
                  <div key={action.label} title={"disabledReason" in action ? action.disabledReason : undefined} className="cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm text-[var(--color-text-disabled)]">
                    {action.label}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
