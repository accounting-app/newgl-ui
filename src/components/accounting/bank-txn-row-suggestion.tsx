"use client";

import { useState } from "react";
import { Info, Sparkles, TriangleAlert } from "lucide-react";
import { BankTxnPopover } from "@/components/accounting/bank-txn-popover";
import type { PayeeSuggestion } from "@/lib/services/ai-service";

type Kind = "customer" | "vendor";

const BLUE_BANNER = "mb-3 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-text-global)] bg-[color-mix(in_srgb,var(--color-link-action)_16%,transparent)]";
const ORANGE_BANNER = "mb-3 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-text-global)] bg-[color-mix(in_srgb,var(--color-warning-text)_16%,transparent)]";

function BannerDot({ tone }: { tone: "info" | "warn" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none text-white ${tone === "info" ? "bg-[var(--color-link-action)]" : "bg-[var(--color-warning-text)]"}`}
    >
      {tone === "info" ? "i" : "!"}
    </span>
  );
}

function MerchantDetails({ merchant, kind, onAdd, onDone }: { merchant: PayeeSuggestion; kind: Kind; onAdd: () => void; onDone: () => void }) {
  return (
    <>
      <div className={BLUE_BANNER}>
        <span>New {kind} for you</span>
        <BannerDot tone="info" />
      </div>
      {merchant.description ? <p className="mb-3 text-base leading-relaxed text-[var(--color-text-primary)]">{merchant.description}</p> : null}
      {merchant.website ? (
        <a href={`https://${merchant.website}`} target="_blank" rel="noopener noreferrer" className="mb-3 block text-base text-[var(--color-link-action)] underline">
          {`www.${merchant.website}`}
        </a>
      ) : null}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            onAdd();
            onDone();
          }}
          className="rounded-md border border-[var(--color-divider-tertiary)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
        >
          Add to {kind} list
        </button>
      </div>
    </>
  );
}

// The blue (i) beside From/To: the AI recognised a business that isn't in your
// contacts yet; the card describes it and "Add to vendor list" opens the
// contact form pre-filled.
export function PayeeSuggestionMarker({ merchant, kind, onAdd }: { merchant: PayeeSuggestion; kind: Kind; onAdd: () => void }) {
  return (
    <BankTxnPopover
      label={`New ${kind} suggestion`}
      triggerClassName="shrink-0 text-[var(--color-link-action)]"
      trigger={<Info className="h-5 w-5" aria-hidden="true" />}
    >
      {({ close }) => (
        <>
          <h3 className="mb-3 flex items-center gap-2 pr-8 text-lg font-semibold text-[var(--color-text-global)]">
            <Sparkles className="h-5 w-5 text-[var(--color-link-action)]" aria-hidden="true" />
            {merchant.name}
          </h3>
          <MerchantDetails merchant={merchant} kind={kind} onAdd={onAdd} onDone={close} />
        </>
      )}
    </BankTxnPopover>
  );
}

type CategoryMarkerProps = {
  accountName: string | null;
  confirmed: boolean;
  merchant: PayeeSuggestion | null;
  kind: Kind;
  onAdd: () => void;
  onApply: () => void;
};

// The orange (!) beside Match/Categorize: a category the AI proposed (or that
// is still missing) that you haven't confirmed. Opens the Suggestions bubble.
export function CategorySuggestionMarker({ accountName, confirmed, merchant, kind, onAdd, onApply }: CategoryMarkerProps) {
  const [view, setView] = useState<"summary" | "merchant">("summary");
  return (
    <BankTxnPopover
      label="Suggestions"
      triggerClassName="shrink-0 text-[var(--color-warning-text)]"
      trigger={<TriangleAlert className="h-4 w-4" aria-hidden="true" />}
    >
      {({ close }) => (
        <>
          <h3 className="mb-3 flex items-center gap-2 pr-8 text-lg font-semibold text-[var(--color-text-global)]">
            <Sparkles className="h-5 w-5 text-[var(--color-link-action)]" aria-hidden="true" />
            {view === "merchant" && merchant ? merchant.name : "Suggestions"}
          </h3>
          {view === "merchant" && merchant ? (
            <MerchantDetails merchant={merchant} kind={kind} onAdd={onAdd} onDone={close} />
          ) : (
            <>
              <div className={ORANGE_BANNER}>
                <span>Based on transaction details. No related historical transactions.</span>
                <BannerDot tone="warn" />
              </div>
              {accountName ? (
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-lg text-[var(--color-text-global)]">{accountName}</span>
                  {!confirmed ? (
                    <button type="button" onClick={onApply} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
                      Apply
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="mb-3 text-sm text-[var(--color-text-primary)]">No account suggestion yet. Open the row and switch on Show suggestions.</p>
              )}
              {merchant ? (
                <>
                  <hr className="mb-3 border-[var(--color-divider-tertiary)]" />
                  <div className={BLUE_BANNER}>
                    <span>New {kind} for you</span>
                    <BannerDot tone="info" />
                  </div>
                  <p className="mb-3 text-lg text-[var(--color-text-global)]">{merchant.name}</p>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setView("merchant")} className="rounded-md border border-[var(--color-divider-tertiary)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">
                      More info
                    </button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </>
      )}
    </BankTxnPopover>
  );
}
