import { BarChart2, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ReportType = "profit_loss" | "balance_sheet";

export type ReportNavItem = {
  type: ReportType;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

/**
 * Single source of truth for every standard report: used by the reports
 * index page (card grid) and by the in-report tab switcher, so adding a new
 * report type here makes it show up in both places automatically.
 */
export const REPORT_NAV_ITEMS: ReportNavItem[] = [
  {
    type: "profit_loss",
    href: "/reports/profit-loss",
    label: "Profit and Loss",
    description: "Income, expenses, and net income over a period.",
    icon: BarChart2
  },
  {
    type: "balance_sheet",
    href: "/reports/balance-sheet",
    label: "Balance Sheet",
    description: "Assets, liabilities, and equity as of a date.",
    icon: Scale
  }
];
