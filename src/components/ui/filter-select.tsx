"use client";

import { ChevronDown } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

// A bordered native <select> with QBO's chevron (and an optional leading
// icon in its place). Shared by the list screens' toolbars (Bank
// transactions, Chart of accounts) so their filters look identical.
export function FilterSelect({ value, onChange, children, icon: Icon, label, className = "", disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-[38px] w-full appearance-none rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] pl-3 pr-14 text-sm text-[var(--color-input-text)] focus:outline-none focus-visible:border-[var(--override-focus)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2 text-[var(--color-icon-secondary)]">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </span>
    </div>
  );
}
