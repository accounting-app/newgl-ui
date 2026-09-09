"use client";

import { useMemo, useState } from "react";
import { Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import type { Estimate, EstimateStatus } from "@/lib/services/estimates-service";
import { useSalesData } from "@/components/sales/use-sales-data";
import { EstimateFormDrawer } from "@/components/customer-hub/estimate-form-drawer";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABEL: Record<EstimateStatus, string> = { OPEN: "Open", ACCEPTED: "Accepted", DECLINED: "Declined" };

// Phase 1.5, Step 8: real estimates -- metadata-only, no ledger impact
// (see @/lib/hooks/use-estimates). The reference's "ask for approvals
// directly on your estimate" needs a real e-signature/online-approval
// integration this app doesn't have, so accept/decline here is just a
// status you set yourself, not something a customer confirms online.
export function EstimatesPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const { customers, productsServices, estimates, addEstimate, addCustomer, updateEstimate, removeEstimate } = useSalesData();
  const [showDrawer, setShowDrawer] = useState(false);

  const customerNameById = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const sorted = useMemo(() => [...estimates].sort((a, b) => b.estimateDate.localeCompare(a.estimateDate)), [estimates]);

  async function handleSave(input: Omit<Estimate, "id" | "createdAt" | "status">) {
    try {
      await addEstimate(input);
      setShowDrawer(false);
      toast({ variant: "success", title: "Estimate created" });
    } catch (err) {
      toast({ variant: "error", title: "Could not create this estimate", description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleSetStatus(estimateId: string, status: EstimateStatus) {
    try {
      await updateEstimate(estimateId, { status });
    } catch (err) {
      toast({ variant: "error", title: "Could not update this estimate", description: err instanceof Error ? err.message : undefined });
    }
  }

  async function handleDelete(estimateId: string) {
    try {
      await removeEstimate(estimateId);
      toast({ variant: "success", title: "Estimate deleted" });
    } catch (err) {
      toast({ variant: "error", title: "Could not delete this estimate", description: err instanceof Error ? err.message : undefined });
    }
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (estimates.length === 0) {
    return (
      <>
        <div className="flex flex-col gap-8 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] p-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 className="text-4xl font-semibold leading-tight text-[var(--color-text-global)]">Request approvals and more with estimates</h2>
            <ul className="mt-5 flex flex-col gap-2 text-sm text-[var(--color-text-primary)]">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
                Send a customer a clear, itemized quote before the work starts
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
                Track whether it&apos;s open, accepted, or declined
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
                Reuse the same customers and items you already track here
              </li>
            </ul>
            <div className="mt-6">
              <Button onClick={() => setShowDrawer(true)}>Create an estimate</Button>
            </div>
          </div>
          <Handshake className="hidden h-28 w-28 shrink-0 text-[var(--color-ui-primary)] lg:block" aria-hidden="true" />
        </div>

        {showDrawer ? (
          <EstimateFormDrawer customers={customers} productsServices={productsServices} onAddCustomer={addCustomer} onSave={handleSave} onClose={() => setShowDrawer(false)} />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Estimates</h1>
        <Button onClick={() => setShowDrawer(true)}>Create an estimate</Button>
      </div>

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">Customer</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Estimate #</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Estimate date</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Expiration</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Amount</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Status</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {sorted.map((estimate) => (
              <tr key={estimate.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                <td className="p-2 align-top text-[13px] font-medium text-[var(--color-text-global)]">{customerNameById.get(estimate.customerId) ?? "Unknown customer"}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{estimate.estimateNumber || "--"}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{estimate.estimateDate}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{estimate.expirationDate || "--"}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">{formatMoney(estimate.amount)}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{STATUS_LABEL[estimate.status]}</td>
                <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                  <div className="flex justify-end gap-3 text-[13px]">
                    {estimate.status === "OPEN" ? (
                      <>
                        <button type="button" onClick={() => handleSetStatus(estimate.id, "ACCEPTED")} className="font-medium text-[var(--color-link-action)] hover:underline">
                          Accept
                        </button>
                        <button type="button" onClick={() => handleSetStatus(estimate.id, "DECLINED")} className="font-medium text-[var(--color-text-primary)] hover:underline">
                          Decline
                        </button>
                      </>
                    ) : null}
                    <button type="button" onClick={() => handleDelete(estimate.id)} className="font-medium text-[var(--color-negative)] hover:underline">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDrawer ? (
        <EstimateFormDrawer customers={customers} productsServices={productsServices} onAddCustomer={addCustomer} onSave={handleSave} onClose={() => setShowDrawer(false)} />
      ) : null}
    </>
  );
}
