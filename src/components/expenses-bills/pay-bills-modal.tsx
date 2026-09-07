"use client";

import { useState } from "react";
import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import type { Account } from "@/modules/accounting/domain/models";

const today = () => new Date().toISOString().slice(0, 10);

// Matches the reference "Pay Bills" screen. Phase 1: since bill payment
// (writing a real check/transfer against a bill) is deferred along with
// the rest of the transaction forms ("features little by little"), this
// only shows the real empty state when there are no open/unpaid bills --
// once Bills has real OPEN records this will list them for real instead
// of only ever showing "Enter new bill".
export function PayBillsModal({
  accounts,
  openBillCount,
  onEnterNewBill,
  onClose
}: {
  accounts: Account[];
  openBillCount: number;
  onEnterNewBill: () => void;
  onClose: () => void;
}) {
  const bankAccountOptions = accounts.filter((a) => a.category === "BANK").map((a) => ({ value: a.id, label: a.name }));
  const [paymentAccountId, setPaymentAccountId] = useState(bankAccountOptions[0]?.value ?? "");
  const [paymentDate, setPaymentDate] = useState(today());
  const [startingCheckNo, setStartingCheckNo] = useState("1");
  const [printLater, setPrintLater] = useState(false);
  const selectedAccount = accounts.find((a) => a.id === paymentAccountId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-container-background-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-6 py-3">
        <h2 className="text-xl font-semibold text-[var(--color-text-global)]">Pay Bills</h2>
        <div className="flex items-center gap-4">
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)]">
            Give feedback
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-wrap items-end gap-6">
            <div className="w-56">
              <Select label="Payment account" value={paymentAccountId} onChange={setPaymentAccountId} options={bankAccountOptions} placeholder="Select account" allowCustomValue={false} />
              {selectedAccount ? <p className="mt-1 text-xs text-[var(--color-icon-secondary)]">Balance: {selectedAccount.currentBalance.toLocaleString("en-US", { style: "currency", currency: "USD" })}</p> : null}
            </div>
            <div className="w-40">
              <InputField label="Payment date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="w-36">
              <InputField label="Starting check no." value={startingCheckNo} onChange={(e) => setStartingCheckNo(e.target.value)} />
            </div>
            <Checkbox label="Print later" checked={printLater} onChange={(e) => setPrintLater(e.target.checked)} />
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Total payment amount</p>
            <p className="text-2xl font-semibold text-[var(--color-text-global)]">$0.00</p>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Not available yet"
              className="cursor-not-allowed rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]"
            >
              Filters
            </button>
            <span className="rounded-full bg-[var(--color-container-background-accent)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-primary)]">Last 12 months</span>
          </div>
          <IconButton icon={Settings} label="Settings" size="sm" />
        </div>

        {openBillCount === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div>
              <p className="text-lg font-semibold text-[var(--color-text-global)]">Looks like you don&apos;t have any bills to pay.</p>
              <p className="mt-1 rounded bg-[var(--color-container-background-accent)] px-2 py-0.5 text-sm text-[var(--color-text-primary)]">Enter a bill to schedule a payment.</p>
            </div>
            <Button onClick={onEnterNewBill}>Enter new bill</Button>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-[var(--color-text-primary)]">
            {openBillCount} open bill{openBillCount === 1 ? "" : "s"} -- scheduling a payment isn&apos;t wired up yet. See them on the Bills screen for now.
          </p>
        )}
      </div>

      <div className="border-t border-[var(--color-divider-tertiary)] px-6 py-3">
        <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
          Cancel
        </button>
      </div>
    </div>
  );
}
