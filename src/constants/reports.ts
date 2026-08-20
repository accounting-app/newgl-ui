import { BarChart2, Scale, ListChecks, FileSearch, Users, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ReportType = "profit_loss" | "balance_sheet" | "trial_balance" | "pl_detail" | "by_payee" | "aging";

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
  },
  {
    type: "trial_balance",
    href: "/reports/trial-balance",
    label: "Trial Balance",
    description: "Every account with a balance, debits and credits, as of a date.",
    icon: ListChecks
  },
  {
    type: "pl_detail",
    href: "/reports/pl-detail",
    label: "P&L Detail",
    description: "Every Profit and Loss account fully expanded to its individual transactions.",
    icon: FileSearch
  },
  {
    type: "by_payee",
    href: "/reports/by-payee",
    label: "By Payee",
    description: "Income and expenses grouped by payee instead of account.",
    icon: Users
  },
  {
    type: "aging",
    href: "/reports/aging",
    label: "A/R & A/P Aging",
    description: "Outstanding receivables and payables, bucketed by how overdue they are.",
    icon: Clock
  }
];
