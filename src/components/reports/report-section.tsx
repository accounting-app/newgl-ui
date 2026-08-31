"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

type ReportSectionProps = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Extra classes applied to the header <tr>. Defaults to the alt-row background. */
  headerClassName?: string;
  /** Number of value columns to the right of the label (default 1, e.g. compare/columnar reports). */
  valueColumnCount?: number;
  /** Rows rendered below the header when the section is open. */
  children?: ReactNode;
};

/**
 * Renders a collapsible report section inside a <tbody>.
 *
 * The component returns a React Fragment containing:
 *   1. A clickable header <tr> with a chevron icon.
 *   2. The children rows (only when isOpen is true — not just hidden).
 *
 * Usage:
 *   <tbody>
 *     <ReportSection label="Income" isOpen={open} onToggle={toggle}>
 *       {accountRows}
 *       <tr>...</tr>  ← total row
 *     </ReportSection>
 *   </tbody>
 */
export function ReportSection({
  label,
  isOpen,
  onToggle,
  headerClassName = "bg-[var(--color-report-row-alt)]",
  valueColumnCount = 1,
  children
}: ReportSectionProps) {
  return (
    <>
      <tr
        className={`cursor-pointer select-none border-b border-[var(--color-container-background-secondary)] ${headerClassName} hover:opacity-90`}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          onToggle();
        }}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
      >
        <td className="px-3 py-1 font-medium text-[var(--color-text-primary)]">
          <span className="flex items-center gap-1.5">
            {isOpen
              ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-icon-secondary)]" />
              : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-icon-secondary)]" />
            }
            {label}
          </span>
        </td>
        <td className="px-3 py-1" colSpan={valueColumnCount} />
      </tr>
      {isOpen ? children : null}
    </>
  );
}
