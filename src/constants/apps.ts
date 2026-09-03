import {
  Banknote,
  Boxes,
  Building2,
  Car,
  Clock,
  CreditCard,
  Database,
  FileBadge2,
  FileStack,
  FileText,
  FolderKanban,
  HandCoins,
  Handshake,
  Landmark,
  LayoutGrid,
  Megaphone,
  Package,
  Plug,
  Receipt,
  ScrollText,
  ShoppingCart,
  Sparkles,
  UserCog,
  Users,
  UsersRound,
  Wallet
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AppNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Shown grayed out with a lock badge instead of a real link -- matches
   * a QuickBooks feature we haven't built (or that's paid-tier there),
   * kept for menu fidelity rather than omitted or faked as working. */
  locked?: boolean;
};

export type AppCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: AppNavItem[];
  /** The whole category is a locked placeholder: not expandable, no real
   * screens behind it. Used for QBO categories we have no equivalent for
   * at all (Payroll, Inventory, ...), so the menu still lists every
   * category QBO does without pretending any of them work here. */
  locked?: boolean;
};

// "All apps" (the hover flyout + the /all-apps accordion page) -- Register
// and Reports are deliberately NOT listed here: both already have their own
// top-level rail icon, so repeating them here would be redundant.
//
// Matches QuickBooks Online's own "All apps" menu category-for-category,
// including the categories/items we don't support (shown locked with a
// diamond badge) -- see the screenshots in
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md. QBO
// itself renders 5 of the locked categories below (Sales & Get Paid,
// Customer Hub, Team, Business Tax, Lending) as expandable with a mix of
// free/paid items inside, rather than locked outright -- we don't have
// screenshots of what's inside those, so rather than invent sub-items
// with no basis, all ten unbuilt categories are rendered locked and
// collapsed here. Only Accounting and Expenses & Bills actually expand.
export const ALL_APPS_CATEGORIES: AppCategory[] = [
  {
    id: "accounting",
    label: "Accounting",
    icon: Landmark,
    items: [
      // Order matches QBO's own Accounting section (with "Rules" kept as
      // "Bank Rules" and "Intuit Experts" as the generic "Find an Expert"
      // -- see their comments below). Bank Transactions is items[0] -- the
      // target when the category header itself is clicked (not hovered
      // into) -- since it's the most-used day-to-day screen.
      { label: "Bank Transactions", href: "/all-apps/bank-transactions", icon: Banknote },
      // QBO's live bank-feed import queue -- no real bank feed yet (Phase 1.5).
      { label: "Integration Transactions", href: "/all-apps/bank-transactions", icon: Plug, locked: true },
      { label: "Receipts", href: "/all-apps/receipts", icon: Receipt },
      { label: "Reconcile", href: "/all-apps/reconcile", icon: ScrollText },
      { label: "Chart of Accounts", href: "/all-apps/chart-of-accounts", icon: Building2 },
      { label: "Bank Rules", href: "/all-apps/bank-rules", icon: Landmark },
      { label: "My Accountant", href: "/all-apps/bank-transactions", icon: UserCog, locked: true },
      // QBO calls this "Intuit Experts" -- a named third-party service of
      // theirs, not a generic feature we could offer as our own. Kept as
      // a locked placeholder in the same menu position under a generic
      // name instead of literally branding it as a competitor's product.
      { label: "Find an Expert", href: "/all-apps/bank-transactions", icon: Handshake, locked: true },
      { label: "Fixed Assets", href: "/all-apps/bank-transactions", icon: Boxes, locked: true }
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
  { id: "sales-get-paid", label: "Sales & Get Paid", icon: ShoppingCart, items: [], locked: true },
  { id: "customer-hub", label: "Customer Hub", icon: Users, items: [], locked: true },
  { id: "team", label: "Team", icon: UsersRound, items: [], locked: true },
  { id: "business-tax", label: "Business Tax", icon: FileBadge2, items: [], locked: true },
  { id: "lending", label: "Lending", icon: HandCoins, items: [], locked: true },
  { id: "marketing", label: "Marketing", icon: Megaphone, items: [], locked: true },
  { id: "payroll", label: "Payroll", icon: Wallet, items: [], locked: true },
  { id: "time", label: "Time", icon: Clock, items: [], locked: true },
  { id: "inventory", label: "Inventory", icon: Package, items: [], locked: true },
  { id: "projects", label: "Projects", icon: FolderKanban, items: [], locked: true }
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
