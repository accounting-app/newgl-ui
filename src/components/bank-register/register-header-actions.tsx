"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// RightTool's "+ Expense" split button. The links are placeholders until
// each destination is decided -- an empty href renders the item inert, so
// wiring one up later is a one-line change here.
const QUICK_ADD_LINKS: { label: string; href: string }[] = [
  { label: "+ Sales Receipt", href: "" },
  { label: "+ Deposit", href: "" },
  { label: "+ Check", href: "" },
  { label: "+ CC Credit", href: "" },
  { label: "+ Journal", href: "" },
  { label: "+ Receive Payment", href: "" },
  { label: "+ Pay Bills", href: "" }
];

export const PILL =
  "inline-flex h-8 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors";
// Quick-add is secondary (outlined); Reconcile stays the one filled action.
const SECONDARY =
  "border border-[var(--color-button-border)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)]";

/** "+ Expense ▾" split button with RightTool's quick-add links; shared by the register and Bank transactions headers. */
export function QuickAddMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button type="button" className={`${PILL} rounded-r-none ${SECONDARY}`} onClick={() => setOpen(false)}>
        + Expense
      </button>
      <button
        type="button"
        aria-label="More quick-add options"
        aria-expanded={open}
        className={`${PILL} w-8 rounded-l-none border-l-0 px-0 ${SECONDARY}`}
        onClick={() => setOpen((current) => !current)}
      >
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {open ? (
        <ul className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 text-left shadow-lg">
          {QUICK_ADD_LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href || "#"}
                onClick={(event) => {
                  if (!link.href) event.preventDefault();
                  setOpen(false);
                }}
                className="block px-3 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function RegisterHeaderActions({ accountId }: { accountId: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <QuickAddMenu />
      <Link
        href={`/all-apps/reconcile?accountId=${encodeURIComponent(accountId)}`}
        className={`${PILL} bg-[var(--color-ui-primary)] text-white hover:opacity-90`}
      >
        Reconcile
      </Link>
    </div>
  );
}
