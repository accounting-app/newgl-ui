import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

// Compound primitives, NOT a data-driven <Table columns rows> --
// register-table.tsx's column-group sub-components and inline-editable
// cells don't map cleanly onto a generic columns config (see
// UI_DESIGN_SYSTEM_PLAN.md Part 1 for the full reasoning). These are opt-in
// building blocks: the 12 hand-rolled tables in the app keep their own
// .map() loops but adopt consistent borders/headers/dividers from here.

function Root({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div
      {...props}
      className={`overflow-auto rounded border border-[var(--color-divider-tertiary)] ${className}`.trim()}
    >
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

function Head({ children, className = "", sticky = false, ...props }: HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode; sticky?: boolean }) {
  return (
    <thead
      {...props}
      className={`bg-[var(--color-container-background-accent)] ${sticky ? "sticky top-0 z-10" : ""} ${className}`.trim()}
    >
      {children}
    </thead>
  );
}

type CellAlign = "left" | "right" | "center";

const ALIGN_CLASSES: Record<CellAlign, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center"
};

function HeaderCell({
  children,
  align = "left",
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode; align?: CellAlign }) {
  return (
    <th
      {...props}
      className={`px-3 py-2 font-medium text-[var(--color-text-primary)] ${ALIGN_CLASSES[align]} ${className}`.trim()}
    >
      {children}
    </th>
  );
}

function Body({ children, className = "", ...props }: HTMLAttributes<HTMLTableSectionElement> & { children: ReactNode }) {
  return (
    <tbody {...props} className={className}>
      {children}
    </tbody>
  );
}

function Row({
  children,
  className = "",
  selected = false,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { children: ReactNode; selected?: boolean }) {
  return (
    <tr
      {...props}
      className={`border-b border-[var(--color-container-background-secondary)] transition-colors hover:bg-[var(--color-table-row-hover)] ${
        selected ? "bg-[var(--color-action-passive-subtle-active)]" : ""
      } ${className}`.trim()}
    >
      {children}
    </tr>
  );
}

function Cell({
  children,
  align = "left",
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode; align?: CellAlign }) {
  return (
    <td {...props} className={`px-3 py-2 align-top ${ALIGN_CLASSES[align]} ${className}`.trim()}>
      {children}
    </td>
  );
}

export const Table = { Root, Head, HeaderCell, Body, Row, Cell };
