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
export const PAYMENT_BOX = "ml-auto block h-9 w-full max-w-[160px] rounded border border-[var(--color-input-border-primary)] bg-transparent px-2 text-right leading-9";

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

const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const usDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const typed = (value: string) => value.replace(/[^0-9.]/g, "");
const HEAD_ROW = "border-b-2 border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase text-[var(--color-text-global)]";
const TABLE = "mt-4 w-full table-fixed border-collapse border-b-2 border-[var(--color-divider-tertiary)] text-sm";

export type DocumentRow = {
  id: string;
  label: string;
  dueDate: string;
  original: number;
  open: number;
  /** What the payment being edited has already put on this document. */
  appliedHere: number;
};

/** The open invoices or bills, each with a tick and an editable payment. */
export function OpenDocumentsTable({
  rows,
  payments,
  noun,
  dueHeading,
  emptyText,
  onToggle,
  onToggleAll,
  onPayment
}: {
  rows: DocumentRow[];
  payments: Record<string, string>;
  noun: "invoice" | "bill";
  dueHeading: string;
  emptyText: string;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onPayment: (id: string, value: string) => void;
}) {
  const payable = rows.filter((row) => row.open > 0);
  return (
    <table className={TABLE}>
      <thead>
        <tr className={HEAD_ROW}>
          <th className="w-14 px-3 py-3 text-center">
            <input type="checkbox" aria-label={`Select all ${noun}s`} checked={payable.length > 0 && payable.every((row) => row.id in payments)} disabled={payable.length === 0} onChange={() => onToggleAll(payable.map((row) => row.id))} className={CHECKBOX} />
          </th>
          <th className={TH}>Description</th>
          <th className={`${TH} w-[16%]`}>{dueHeading}</th>
          <th className={`${TH} w-[19%] text-right`}>Original amount</th>
          <th className={`${TH} w-[19%] text-right`}>Open balance</th>
          <th className={`${TH} w-[16%] text-right`}>Payment</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const canPay = row.open > 0;
          return (
            <tr key={row.id} className="border-b border-[var(--color-divider-tertiary)]">
              <td className="px-3 py-3 text-center">
                <input type="checkbox" aria-label={`Pay ${row.label}`} checked={canPay ? row.id in payments : true} disabled={!canPay} onChange={() => onToggle(row.id)} className={CHECKBOX} />
              </td>
              <td className={TD}>
                {row.label}
                {row.appliedHere > 0 ? <span className="block text-xs">{money(row.appliedHere)} applied by this payment</span> : null}
              </td>
              <td className={TD}>{usDate(row.dueDate)}</td>
              <td className={`${TD} text-right`}>{money(row.original)}</td>
              <td className={`${TD} text-right`}>{money(row.open)}</td>
              <td className={TD}>
                {canPay ? (
                  <input inputMode="decimal" aria-label={`Payment for ${row.label}`} value={payments[row.id] ?? ""} onChange={(event) => onPayment(row.id, typed(event.target.value))} className={PAYMENT_BOX} />
                ) : (
                  <span className={PAYMENT_BOX}>{row.appliedHere.toFixed(2)}</span>
                )}
              </td>
            </tr>
          );
        })}
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-14 text-center">{emptyText}</td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}

/** Unapplied payments that can be put toward the invoices or bills above. */
export function CreditsTable({
  rows,
  used,
  href,
  onToggle,
  onAmount
}: {
  rows: { id: string; date: string; original: number; amount: number }[];
  used: Record<string, string>;
  href: (id: string) => string;
  onToggle: (id: string) => void;
  onAmount: (id: string, value: string) => void;
}) {
  return (
    <table className={TABLE}>
      <thead>
        <tr className={HEAD_ROW}>
          <th className="w-14 px-3 py-3" />
          <th className={TH}>Description</th>
          <th className={`${TH} w-[22%] text-right`}>Original amount</th>
          <th className={`${TH} w-[24%] text-right`}>Open balance</th>
          <th className={`${TH} w-[16%] text-right`}>Payment</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-[var(--color-divider-tertiary)]">
            <td className="px-3 py-3 text-center">
              <input type="checkbox" aria-label={`Use credit from ${usDate(row.date)}`} checked={row.id in used} onChange={() => onToggle(row.id)} className={CHECKBOX} />
            </td>
            <td className={TD}>
              <a href={href(row.id)} className="text-[var(--color-link-action)] hover:underline">Unapplied payment</a> <span className="text-xs">({usDate(row.date)})</span>
            </td>
            <td className={`${TD} text-right`}>{money(row.original)}</td>
            <td className={`${TD} text-right`}>{money(row.amount)}</td>
            <td className={TD}>
              <input inputMode="decimal" aria-label={`Credit used from ${usDate(row.date)}`} value={used[row.id] ?? ""} onChange={(event) => onAmount(row.id, typed(event.target.value))} className={PAYMENT_BOX} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
