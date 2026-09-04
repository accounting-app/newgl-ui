"use client";

import { Wallet } from "lucide-react";
import { useToast } from "@/components/ui/toast/toast-context";

// Matches the reference's first-run "Get those payouts flowing" screen --
// but QBO's own version is about their in-house payments product
// depositing money it collected on your behalf. This app has no payments
// processor integration, so there's nothing for a payout to ever be a
// deposit of; this stays a single static, honestly non-functional screen
// rather than growing a fake payouts history.
export function PayoutsPage() {
  const { toast } = useToast();

  function notAvailable() {
    toast({ variant: "info", title: "Not available yet", description: "Payouts need a real payments processor integration this app doesn't have." });
  }

  return (
    <div className="flex flex-col gap-8 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] p-10 lg:flex-row lg:items-center lg:justify-between">
      <div className="max-w-xl">
        <h2 className="text-4xl font-semibold leading-tight text-[var(--color-text-global)]">Get those payouts flowing</h2>
        <ol className="mt-6 flex flex-col gap-4">
          {["Send invoices to your customers", "Get paid online once payments are connected", "Track payouts here as they come in"].map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="text-2xl font-semibold text-[var(--color-positive)]">{index + 1}</span>
              <span className="pt-1 text-sm text-[var(--color-text-primary)]">{step}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={notAvailable}
          title="No payments processor integration yet"
          className="mt-6 cursor-not-allowed rounded-full bg-[var(--color-container-background-primary)] px-5 py-2 text-sm font-medium text-[var(--color-text-disabled)]"
        >
          Get started
        </button>
      </div>
      <Wallet className="hidden h-28 w-28 shrink-0 text-[var(--color-positive)] lg:block" aria-hidden="true" />
    </div>
  );
}
