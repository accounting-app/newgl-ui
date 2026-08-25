import { Building2, CreditCard, Database, Landmark, Sparkles, Users } from "lucide-react";
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
  items: AppNavItem[];
};

// "All apps" (the hover flyout + the /all-apps accordion page) -- Register
// and Reports are deliberately NOT listed here: both already have their own
// top-level rail icon, so repeating them here would be redundant. Only one
// category exists today (Accounting); the shape supports more without
// touching SideNav/AppsFlyout/the /all-apps layout.
export const ALL_APPS_CATEGORIES: AppCategory[] = [
  {
    id: "accounting",
    label: "Accounting",
    icon: Landmark,
    items: [
      { label: "Chart of Accounts", href: "/all-apps/chart-of-accounts", icon: Building2 },
      { label: "Bank Rules", href: "/all-apps/bank-rules", icon: Landmark }
    ]
  }
];

// Settings (the bottom-pinned rail icon) -- AI, Billing, Organization, and
// anything else about the account/preferences/users rather than the books
// themselves. Ledger lives here (not /all-apps) since it's a file-manager
// over the raw .bean files backing every company, closer to account-level
// configuration than day-to-day bookkeeping.
export const SETTINGS_GROUPS: AppCategory[] = [
  {
    id: "books",
    label: "Books",
    icon: Database,
    items: [{ label: "Ledger", href: "/settings/ledger", icon: Database }]
  },
  {
    id: "account",
    label: "Account",
    icon: Users,
    items: [
      { label: "AI", href: "/settings/ai", icon: Sparkles },
      { label: "Billing", href: "/settings/billing", icon: CreditCard },
      { label: "Organization", href: "/settings/organization", icon: Users }
    ]
  }
];
