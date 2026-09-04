"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/toast-context";

const STEPS = ["Print sample", "Set up PDF reader", "Adjust alignment"];

// Matches the reference 3-step "Print checks setup" wizard. Phase 1, UI
// only: only step 1's content is real ("focus mainly on the UI for now"
// -- printing/alignment is real hardware/PDF-reader integration work,
// not something to fake). Steps 2-3 stay visible in the stepper (so the
// flow's shape is honest about what's coming) but aren't built out yet.
export function PrintChecksSetupModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [checkType, setCheckType] = useState<"voucher" | "standard">("voucher");

  function notAvailable() {
    toast({ variant: "info", title: "Not available yet", description: "Print setup isn't wired up yet -- this screen is a UI preview for now." });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-container-background-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-6 py-3">
        <h2 className="text-xl font-semibold text-[var(--color-text-global)]">Print checks setup</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-3 border-b border-[var(--color-divider-tertiary)] px-6 py-4">
        {STEPS.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  index === 0 ? "bg-[var(--color-ui-primary)] text-white" : "border border-[var(--color-divider-tertiary)] text-[var(--color-text-disabled)]"
                }`}
              >
                {index + 1}
              </span>
              <span className={`text-xs uppercase tracking-wide ${index === 0 ? "text-[var(--color-text-global)]" : "text-[var(--color-text-disabled)]"}`}>{step}</span>
            </div>
            {index < STEPS.length - 1 ? <span className="h-px w-16 bg-[var(--color-divider-tertiary)]" /> : null}
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-y-auto px-8 py-8">
        <div className="flex-1">
          <h3 className="mb-6 text-lg font-semibold text-[var(--color-text-global)]">Select a check type and print a sample</h3>

          <div className="mb-6 flex items-start gap-4">
            <span className="pt-1 text-sm text-[var(--color-icon-secondary)]">a</span>
            <div>
              <p className="mb-2 text-sm text-[var(--color-text-primary)]">Select the type of checks you use:</p>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-global)]">
                  <input type="radio" name="check-type" checked={checkType === "voucher"} onChange={() => setCheckType("voucher")} />
                  Voucher
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-global)]">
                  <input type="radio" name="check-type" checked={checkType === "standard"} onChange={() => setCheckType("standard")} />
                  Standard
                </label>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-primary)]">
                You can order{" "}
                <button type="button" onClick={notAvailable} className="text-[var(--color-link-action)] hover:underline">
                  checks
                </button>
                .
              </p>
            </div>
          </div>

          <div className="mb-6 flex items-start gap-4">
            <span className="text-sm text-[var(--color-icon-secondary)]">b</span>
            <p className="text-sm text-[var(--color-text-primary)]">Load blank paper in your printer.</p>
          </div>

          <div className="mb-6 flex items-start gap-4">
            <span className="text-sm text-[var(--color-icon-secondary)]">c</span>
            <div>
              <Button variant="secondary" onClick={notAvailable}>
                View preview and print sample
              </Button>
              <p className="mt-2 text-xs text-[var(--color-text-disabled)]">NOTE: The setup preview will show sample data and not real cheque data.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <span className="text-sm text-[var(--color-icon-secondary)]">d</span>
            <p className="text-sm text-[var(--color-text-primary)]">Place the sample on top of a blank check page. Hold them both up to the light.</p>
          </div>
        </div>

        <div className="w-[340px] shrink-0 self-start rounded-lg bg-[var(--color-container-background-accent)] p-5">
          <p className="mb-3 rounded bg-[var(--color-ui-primary)] px-3 py-1.5 text-sm font-semibold text-white">Why do this?</p>
          <p className="text-sm text-[var(--color-text-primary)]">
            Print a sample on blank paper to see if text lines up correctly on preprinted checks. If you need to make adjustments, you won&apos;t waste any of your actual checks.
          </p>
          <p className="mt-3 text-sm text-[var(--color-text-primary)]">Tip! Most users have the best experience printing from a Chrome browser.</p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-divider-tertiary)] px-6 py-3">
        <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-primary)]">Are the fields lined up properly?</span>
          <Button variant="secondary" onClick={notAvailable}>
            No, continue setup
          </Button>
          <Button onClick={onClose}>Yes, I&apos;m finished with setup</Button>
        </div>
      </div>
    </div>
  );
}
