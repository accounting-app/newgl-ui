"use client";

import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";

// Pieces shared by QBO's Receive Payment and Bill Payment screens.

export const SECTION_TITLE = "text-2xl font-bold text-[var(--color-text-global)]";
export const RT_BUTTON = "rounded-lg border border-[var(--color-negative)] px-3 py-2 text-xs font-bold text-[var(--color-negative)] hover:bg-[var(--color-action-passive-subtle-hover)] disabled:cursor-not-allowed disabled:opacity-60";
export const TH = "border-l border-[var(--color-divider-tertiary)] px-3 py-3";
export const TD = "border-l border-[var(--color-divider-tertiary)] px-3 py-3";
export const CHECKBOX = "h-5 w-5 cursor-pointer accent-[var(--color-ui-primary)] disabled:cursor-not-allowed";
export const PAYMENT_BOX = "ml-auto flex h-9 w-full max-w-[160px] items-center justify-end rounded border border-[var(--color-input-border-primary)] px-2";
export const NO_APPLY = "Applying a saved payment to invoices isn't available yet";

/** QBO's search box and "Filter" row above each of the two lists. */
export function ListTools({ placeholder, value, onChange, children }: { placeholder: string; value: string; onChange: (value: string) => void; children?: React.ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <div className="w-[200px]">
        <InputField value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      </div>
      <Button variant="secondary" className="!rounded-md" disabled title="Filters aren't available yet">
        Filter <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
      <span className="px-2 text-sm">All</span>
      {children}
      <button type="button" disabled aria-label="List settings" title="List settings aren't available yet" className="ml-auto cursor-not-allowed p-2 opacity-60">
        <Settings className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ListCount({ count }: { count: number }) {
  return (
    <div className="mt-3 flex items-center justify-end gap-3 text-sm">
      <span>{count === 0 ? "0 of 0" : `1 - ${count} of ${count} items`}</span>
      <ChevronLeft className="h-4 w-4 opacity-40" aria-hidden="true" />
      <span>Page</span>
      <span className="flex h-9 w-10 items-center justify-center rounded border border-[var(--color-input-border-primary)]">1</span>
      <span>of 1</span>
      <ChevronRight className="h-4 w-4 opacity-40" aria-hidden="true" />
    </div>
  );
}
