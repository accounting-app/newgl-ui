"use client";

import { useMemo, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import type { Account } from "@/modules/accounting/domain/models";
import type { Bill } from "@/lib/services/bills-service";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const today = () => new Date().toISOString().slice(0, 10);

type PayOutcome = { billId: string; label: string; error?: string };

// Real batch "Pay Bills" screen -- lists actual open bills with
// checkboxes, same reference layout as before, but now really posts a
// Dr Accounts Payable / Cr Cash-or-Bank transaction per selected bill via
// the same /api/bills/{id}/pay endpoint PayBillDialog (the single-bill
// "Mark paid" flow) already uses. "Starting check no."/"Print later"
// stay display-only -- check printing itself is a real feature this app
// doesn't have, same reasoning as everywhere else checks are mentioned.
export function PayBillsModal({
  bills,
  vendorNameById,
  accounts,
  onPay,
  onEnterNewBill,
  onClose
}: {
  bills: Bill[];
  vendorNameById: Map<string, string>;
  accounts: Account[];
  onPay: (billId: string, input: { paymentAccountId: string; paymentDate: string }) => Promise<Bill>;
  onEnterNewBill: () => void;
  onClose: () => void;
}) {
  const bankAccountOptions = accounts.filter((a) => a.category === "BANK" || a.category === "CREDIT_CARD").map((a) => ({ value: a.id, label: a.name }));
  const [paymentAccountId, setPaymentAccountId] = useState(bankAccountOptions[0]?.value ?? "");
  const [paymentDate, setPaymentDate] = useState(today());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const [results, setResults] = useState<PayOutcome[] | null>(null);
  const selectedAccount = accounts.find((a) => a.id === paymentAccountId);

  const selectedBills = useMemo(() => bills.filter((b) => selectedIds.has(b.id)), [bills, selectedIds]);
  const totalAmount = useMemo(() => selectedBills.reduce((sum, b) => sum + b.amount, 0), [selectedBills]);
  const allSelected = bills.length > 0 && selectedIds.size === bills.length;

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(bills.map((b) => b.id)) : new Set());
  }
  function toggleOne(billId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(billId);
      else next.delete(billId);
      return next;
    });
  }

  async function handlePaySelected() {
    if (!paymentAccountId || selectedBills.length === 0) return;
    setPaying(true);
    const outcomes: PayOutcome[] = [];
    for (const bill of selectedBills) {
      const label = vendorNameById.get(bill.vendorId) ?? "Unknown vendor";
      try {
        await onPay(bill.id, { paymentAccountId, paymentDate });
        outcomes.push({ billId: bill.id, label });
      } catch (err) {
        outcomes.push({ billId: bill.id, label, error: err instanceof Error ? err.message : "Could not pay this bill." });
      }
    }
    setResults(outcomes);
    setSelectedIds(new Set());
    setPaying(false);
  }

  const succeededCount = results?.filter((r) => !r.error).length ?? 0;
  const failedCount = results?.filter((r) => r.error).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-container-background-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-6 py-3">
        <h2 className="text-xl font-semibold text-[var(--color-text-global)]">Pay Bills</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {results ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <p className="text-lg font-semibold text-[var(--color-text-global)]">
              {succeededCount} bill{succeededCount === 1 ? "" : "s"} paid{failedCount > 0 ? `, ${failedCount} failed` : ""}
            </p>
            {failedCount > 0 ? (
              <div className="w-full max-w-md rounded-lg border border-[var(--color-divider-tertiary)] text-left">
                {results
                  .filter((r) => r.error)
                  .map((r) => (
                    <div key={r.billId} className="flex items-start gap-2 border-b border-[var(--color-divider-tertiary)] px-4 py-2 text-sm last:border-b-0">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-negative)]" aria-hidden="true" />
                      <span className="text-[var(--color-text-primary)]">
                        {r.label}: {r.error}
                      </span>
                    </div>
                  ))}
              </div>
            ) : null}
            <Button onClick={onClose}>Done</Button>
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-wrap items-end gap-6">
                <div className="w-56">
                  <Select label="Payment account" value={paymentAccountId} onChange={setPaymentAccountId} options={bankAccountOptions} placeholder="Select account" allowCustomValue={false} />
                  {selectedAccount ? <p className="mt-1 text-xs text-[var(--color-icon-secondary)]">Balance: {formatMoney(selectedAccount.currentBalance)}</p> : null}
                </div>
                <div className="w-40">
                  <InputField label="Payment date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Total payment amount</p>
                <p className="text-2xl font-semibold text-[var(--color-text-global)]">{formatMoney(totalAmount)}</p>
              </div>
            </div>

            {bills.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <div>
                  <p className="text-lg font-semibold text-[var(--color-text-global)]">Looks like you don&apos;t have any bills to pay.</p>
                  <p className="mt-1 rounded bg-[var(--color-container-background-accent)] px-2 py-0.5 text-sm text-[var(--color-text-primary)]">Enter a bill to schedule a payment.</p>
                </div>
                <Button onClick={onEnterNewBill}>Enter new bill</Button>
              </div>
            ) : (
              <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
                <table className="w-full min-w-[700px] border-collapse text-sm">
                  <thead className="header-table text-left uppercase tracking-wide">
                    <tr>
                      <th className="w-10 px-2 pb-[5px] pt-2 text-left align-middle">
                        <Checkbox checked={allSelected} onChange={(e) => toggleAll(e.target.checked)} aria-label="Select all bills" />
                      </th>
                      <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Vendor</th>
                      <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Bill No</th>
                      <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Due date</th>
                      <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Open balance</th>
                    </tr>
                  </thead>
                  <tbody className="content-table">
                    {bills.map((bill) => (
                      <tr key={bill.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                        <td className="p-2 align-top">
                          <Checkbox checked={selectedIds.has(bill.id)} onChange={(e) => toggleOne(bill.id, e.target.checked)} aria-label={`Select bill ${bill.billNumber ?? bill.id}`} />
                        </td>
                        <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] font-medium text-[var(--color-text-global)]">
                          {vendorNameById.get(bill.vendorId) ?? "Unknown vendor"}
                        </td>
                        <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{bill.billNumber || "--"}</td>
                        <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{bill.dueDate}</td>
                        <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">{formatMoney(bill.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {!results ? (
        <div className="flex items-center justify-between border-t border-[var(--color-divider-tertiary)] px-6 py-3">
          <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
            Cancel
          </button>
          {bills.length > 0 ? (
            <Button onClick={handlePaySelected} disabled={selectedBills.length === 0 || !paymentAccountId || paying}>
              {paying ? "Paying…" : `Pay ${selectedBills.length || ""} bill${selectedBills.length === 1 ? "" : "s"}`.trim()}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
