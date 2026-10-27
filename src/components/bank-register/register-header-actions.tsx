"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// RightTool's "+ Expense" split button. The links are placeholders until
// each destination is decided -- an empty href renders the item inert, so
// wiring one up later is a one-line change here.
const QUICK_ADD_LINKS: { label: string; href: string }[] = [
  { label: "+ Sales Receipt", href: "/salesreceipt" },
  { label: "+ Deposit", href: "/deposit" },
  { label: "+ Check", href: "/check" },
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

const SPLIT_BASE = "inline-flex h-8 items-center justify-center text-sm font-semibold transition-colors border border-[var(--color-button-border)] bg-transparent text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)]";

/**
 * The outlined pill with a label and a chevron half ("+ Expense ▾",
 * "Link account ▾"). One component so every header action has the same shape;
 * `children` is the menu that opens under the chevron, if any.
 */
export function SplitButton({
  label,
  onMainClick,
  onToggle,
  expanded = false,
  toggleLabel,
  children
}: {
  label: string;
  onMainClick: () => void;
  onToggle: () => void;
  expanded?: boolean;
  toggleLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative inline-flex">
      <button type="button" className={`${SPLIT_BASE} rounded-l-full rounded-r-none pl-5 pr-4`} onClick={onMainClick}>
        {label}
      </button>
      <button type="button" aria-label={toggleLabel} aria-expanded={expanded} className={`${SPLIT_BASE} w-10 rounded-l-none rounded-r-full border-l-0`} onClick={onToggle}>
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

/** "+ Expense ▾" split button with RightTool's quick-add links; shared by the register and Bank transactions headers. */
export function QuickAddMenu({ accountId }: { accountId?: string }) {
  const router = useRouter();
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
      <SplitButton
        label="+ Expense"
        onMainClick={() => {
          setOpen(false);
          // QBO opens the full-screen Expense form with the payment account in the URL.
          router.push(accountId ? `/expense?rtAccountId=${encodeURIComponent(accountId)}&rt=close` : "/expense?rt=close");
        }} onToggle={() => setOpen((current) => !current)} expanded={open} toggleLabel="More quick-add options">
        {open ? (
          <ul className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 text-left shadow-lg">
            {QUICK_ADD_LINKS.map((link) => (
              <li key={link.label}>
                <a
                  target="_blank"
                  href={link.href ? (accountId ? `${link.href}?rtAccountId=${encodeURIComponent(accountId)}&rt=close` : `${link.href}?rt=close`) : "#"}
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
      </SplitButton>
    </div>
  );
}

export function RegisterHeaderActions({ accountId }: { accountId: string }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <QuickAddMenu accountId={accountId} />
      <Link
        href={`/all-apps/reconcile?accountId=${encodeURIComponent(accountId)}`}
        className={`${PILL} bg-[var(--color-ui-primary)] text-white hover:opacity-90`}
      >
        Reconcile
      </Link>
    </div>
  );
}
