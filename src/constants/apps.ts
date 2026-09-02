import {
  Banknote,
  Building2,
  Car,
  CreditCard,
  Database,
  FileStack,
  FileText,
  Landmark,
  LayoutGrid,
  Receipt,
  ScrollText,
  Sparkles,
  Users
} from "lucide-react";
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
      // Chart of Accounts stays first -- it's items[0], the target when the
      // category header itself is clicked (not hovered into), and Register
      // already has its own top-level rail icon, so a Register-routing item
      // shouldn't be the category's default destination.
      { label: "Chart of Accounts", href: "/all-apps/chart-of-accounts", icon: Building2 },
      { label: "Bank Transactions", href: "/all-apps/bank-transactions", icon: Banknote },
      { label: "Receipts", href: "/all-apps/receipts", icon: Receipt },
      { label: "Reconcile", href: "/all-apps/reconcile", icon: ScrollText },
      { label: "Bank Rules", href: "/all-apps/bank-rules", icon: Landmark }
    ]
  },
  {
    id: "expenses-bills",
    label: "Expenses & Bills",
    icon: FileText,
    items: [
      { label: "Overview", href: "/all-apps/expenses-bills", icon: LayoutGrid },
      { label: "Expense Transactions", href: "/all-apps/expenses-bills/expense-transactions", icon: Receipt },
      { label: "Vendors", href: "/all-apps/expenses-bills/vendors", icon: Users },
      { label: "Bills", href: "/all-apps/expenses-bills/bills", icon: FileStack },
      { label: "Mileage", href: "/all-apps/expenses-bills/mileage", icon: Car },
      { label: "Contractors", href: "/all-apps/expenses-bills/contractors", icon: Users },
      { label: "1099s", href: "/all-apps/expenses-bills/1099s", icon: FileText }
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
    id: "account",
    label: "Account",
    icon: Users,
    items: [
      { label: "AI", href: "/settings/ai", icon: Sparkles },
      { label: "Billing", href: "/settings/billing", icon: CreditCard },
      { label: "Organization", href: "/settings/organization", icon: Users }
    ]
  },
  {
    id: "books",
    label: "Books",
    icon: Database,
    items: [{ label: "Ledger", href: "/settings/ledger", icon: Database }]
  }
];
