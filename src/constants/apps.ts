import { BookOpen, Building2, CreditCard, Database, Landmark, Sparkles, Users, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type AppCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Set when the category itself is a direct destination (e.g. Reports has its own established sub-nav, REPORT_NAV_ITEMS -- not duplicated here). */
  href?: string;
  items: AppNavItem[];
};

// Single source of truth for every screen in the app, organized the way
// QuickBooks Online organizes its "All apps" menu -- categories with
// expandable sub-items (UI_DESIGN_SYSTEM_PLAN.md Part 3). Every existing
// screen is placed here exactly once; SideNav's Apps flyout, the Settings
// sidebar, and the home dashboard's pill row all read from this instead of
// each maintaining their own copy of the same list.
export const APP_CATEGORIES: AppCategory[] = [
  {
    id: "accounting",
    label: "Accounting",
    icon: Landmark,
    items: [
      { label: "Register", href: "/register", icon: Wallet },
      { label: "Chart of Accounts", href: "/settings/chart-of-accounts", icon: Building2 },
      { label: "Bank Rules", href: "/settings/bank-rules", icon: Landmark },
      { label: "Ledger", href: "/settings/ledger", icon: Database }
    ]
  },
  {
    id: "reports",
    label: "Reports",
    icon: BookOpen,
    href: "/reports",
    items: []
  },
  {
    id: "ai",
    label: "AI",
    icon: Sparkles,
    items: [{ label: "AI", href: "/settings/ai", icon: Sparkles }]
  },
  {
    id: "account",
    label: "Account",
    icon: Users,
    items: [
      { label: "Billing", href: "/settings/billing", icon: CreditCard },
      { label: "Organization", href: "/settings/organization", icon: Users }
    ]
  }
];
