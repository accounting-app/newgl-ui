import { Banknote, Building2, Car, CreditCard, Database, FileStack, FileText, Handshake, Landmark, LayoutGrid, Package, Receipt, ScrollText, ShoppingCart, Sparkles, Users, UsersRound, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown grayed out with a lock badge instead of a real link -- for a
   * QuickBooks feature we haven't built (or that's paid-tier there).
   * Unused for now: per the user's call, the menu only lists free,
   * working sections -- no locked placeholders -- but the rendering
   * support for this stays in the layout/flyout in case that changes. */
  locked?: boolean;
};

export type AppCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: AppNavItem[];
  /** The whole category is a locked placeholder. Unused for now -- see
   * AppNavItem.locked above. */
  locked?: boolean;
};

// "All apps" (the hover flyout + the /all-apps accordion page) -- Register
// and Reports are deliberately NOT listed here: both already have their own
// top-level rail icon, so repeating them here would be redundant. Every
// category/item here is real and working -- no locked/"coming soon"
// placeholders for QBO features we haven't built, per the confirmed
// decision.
export const ALL_APPS_CATEGORIES: AppCategory[] = [
  {
    id: "accounting",
    label: "Accounting",
    icon: Landmark,
    items: [
      // Order matches QBO's own Accounting section. Bank Transactions is
      // items[0] -- the target when the category header itself is clicked
      // (not hovered into) -- since it's the most-used day-to-day screen.
      { label: "Bank Transactions", href: "/all-apps/bank-transactions", icon: Banknote },
      { label: "Receipts", href: "/all-apps/receipts", icon: Receipt },
      { label: "Reconcile", href: "/all-apps/reconcile", icon: ScrollText },
      { label: "Chart of Accounts", href: "/all-apps/chart-of-accounts", icon: Building2 },
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
  },
  {
    id: "sales-get-paid",
    label: "Sales & Get Paid",
    icon: ShoppingCart,
    items: [
      // Payment links and Sales channels stay out entirely (QBO's own
      // premium items in this category) -- see QBO_FREE_FEATURES_PLAN.md.
      { label: "Overview", href: "/all-apps/sales-get-paid", icon: LayoutGrid },
      { label: "Sales Transactions", href: "/all-apps/sales-get-paid/sales-transactions", icon: Receipt },
      { label: "Invoices", href: "/all-apps/sales-get-paid/invoices", icon: FileText },
      // QBO calls this "QuickBooks payouts" -- their own named payments
      // product, not something we can brand as ours (same reasoning as
      // "Find an Expert" standing in for "Intuit Experts").
      { label: "Payouts", href: "/all-apps/sales-get-paid/payouts", icon: Wallet },
      { label: "Products & Services", href: "/all-apps/sales-get-paid/products-services", icon: Package }
    ]
  },
  {
    id: "customer-hub",
    label: "Customer Hub",
    icon: Users,
    items: [
      { label: "Overview", href: "/all-apps/customer-hub", icon: LayoutGrid },
      { label: "Customers", href: "/all-apps/customer-hub/customers", icon: Users },
      { label: "Estimates", href: "/all-apps/customer-hub/estimates", icon: Handshake }
    ]
  },
  {
    id: "team",
    label: "Team",
    icon: UsersRound,
    items: [
      // Same real screen as Expenses & Bills' own Contractors item, not a
      // second copy -- QBO itself links to the identical Contractors
      // screen from both categories (?jobId=expenses vs ?jobId=team just
      // tags which nav path was used). Employees/Workers' comp are still
      // an open scoping question -- see QBO_FREE_FEATURES_PLAN.md.
      { label: "Contractors", href: "/all-apps/expenses-bills/contractors", icon: Users }
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
