"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { filterCollapsed } from "@/lib/accounting/account-hierarchy";
import type { HierarchyRow, HierarchyRowWithValues } from "@/lib/accounting/account-hierarchy";

export type ReportValueColumn = { key: string; format: "money" | "percent" };

type ReportAccountRowsProps = {
  rows: HierarchyRow[] | HierarchyRowWithValues[];
  collapsedNames: Set<string>;
  rowKeyPrefix: string;
  /** Left padding for depth-0 rows in rem (default 1.5 = px-6). */
  baseIndentRem?: number;
  /** Additional left padding per depth level in rem (default 1.5). */
  indentStepRem?: number;
  onToggleCollapse: (fullName: string) => void;
  onDrillAmount: (row: HierarchyRow) => void;
  /**
   * When provided, renders one <td> per column reading from row.values[i]
   * (compare / columnar reports) instead of the single row.amount column.
   * Only the first column stays clickable for drill-down.
   */
  columns?: ReportValueColumn[];
};

function formatMoney(value: number): string {
  return Math.abs(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value: number): string {
  return `${value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function formatCell(value: number, format: "money" | "percent"): string {
  return format === "percent" ? formatPercent(value) : formatMoney(value);
}

/**
 * Renders a DFS-ordered list of HierarchyRows as <tr> elements inside a
 * <tbody>. Returns a React Fragment so it can be placed directly inside any
 * <tbody> without breaking table semantics.
 *
 * - Rows with children show a ▼/▶ chevron; clicking the name cell
 *   toggles their subtree (calls onToggleCollapse).
 * - Clicking the amount cell triggers drill-down (calls onDrillAmount).
 */
export function ReportAccountRows({
  rows,
  collapsedNames,
  rowKeyPrefix,
  baseIndentRem = 1.5,
  indentStepRem = 1.5,
  onToggleCollapse,
  onDrillAmount,
  columns,
}: ReportAccountRowsProps) {
  const visible = filterCollapsed(rows, collapsedNames);

  return (
    <>
      {visible.map((row) => {
        const isCollapsed = row.hasChildren && collapsedNames.has(row.fullName);
        const paddingLeft = `${baseIndentRem + row.depth * indentStepRem}rem`;
        const values = (row as HierarchyRowWithValues).values;

        return (
          <tr
            key={`${rowKeyPrefix}-${row.fullName}`}
            className="border-b border-[var(--color-container-background-secondary)]"
          >
            <td className="py-1 pr-3 text-[var(--color-text-primary)]" style={{ paddingLeft }}>
              {row.hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggleCollapse(row.fullName)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center gap-1 text-left"
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 shrink-0 text-[var(--color-icon-secondary)]" />
                  ) : (
                    <ChevronDown className="h-3 w-3 shrink-0 text-[var(--color-icon-secondary)]" />
                  )}
                  {row.label}
                </button>
              ) : (
                <span className="flex items-center gap-1">{row.label}</span>
              )}
            </td>
            {columns ? (
              columns.map((column, index) =>
                index === 0 ? (
                  <td key={column.key} className="px-3 py-1 text-right">
                    <button
                      type="button"
                      onClick={() => onDrillAmount(row)}
                      aria-label={`View transactions for ${row.label}`}
                      className="text-[var(--color-link-text)] hover:underline"
                    >
                      {formatCell(values?.[index] ?? 0, column.format)}
                    </button>
                  </td>
                ) : (
                  <td key={column.key} className="px-3 py-1 text-right text-[var(--color-text-primary)]">
                    {formatCell(values?.[index] ?? 0, column.format)}
                  </td>
                )
              )
            ) : (
              <td className="px-3 py-1 text-right">
                <button
                  type="button"
                  onClick={() => onDrillAmount(row)}
                  aria-label={`View transactions for ${row.label}`}
                  className="text-[var(--color-link-text)] hover:underline"
                >
                  {formatMoney(row.amount)}
                </button>
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}
