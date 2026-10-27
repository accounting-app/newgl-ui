import { Banknote, Building2, Car, CreditCard, Database, FileStack, FileText, Handshake, Landmark, LayoutGrid, Package, Receipt, Repeat, ScrollText, ShoppingCart, Sparkles, Users, UsersRound, Wallet } from "lucide-react";
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
      { label: "Bank Rules", href: "/all-apps/bank-rules", icon: Landmark },
      { label: "Recurring Transactions", href: "/all-apps/recurring-transactions", icon: Repeat }
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
      // QBO reaches the same Contractors screen from both Expenses & Bills
      // and Team via the same base URL with a distinguishing query param
      // (?jobId=expenses vs ?jobId=team) -- same underlying data, but only
      // one of the two nav entries is ever active at a time (never both
      // simultaneously), matching that pattern instead of a bare shared
      // href. See the Team category below.
      { label: "Contractors", href: "/all-apps/expenses-bills/contractors?jobId=expenses", icon: Users },
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
      // A real roster/directory -- no Payroll behind it (out of scope),
      // so no pay rate, no paychecks, just name/role/contact info.
      { label: "Employees", href: "/all-apps/team/employees", icon: Users },
      // Same real screen and same underlying contractor list as Expenses &
      // Bills' own Contractors item -- QBO links to the identical
      // Contractors screen from both categories, distinguished only by
      // ?jobId=team vs ?jobId=expenses on the same base URL, not a second
      // copy or a data-level split.
      { label: "Contractors", href: "/all-apps/expenses-bills/contractors?jobId=team", icon: Users }
      // Workers' comp stays out entirely -- a real insurance product,
      // same reasoning as excluding Lending/Business Tax.
    ]
  }
];

// QBO's side rail lists Accounting, Expenses and Sales directly, followed by
// a single "More apps" entry holding every other category. These three ids
// are the ones promoted onto the rail (in rail order); `railLabel` is the
// short label QBO shows under the icon (the full category label -- "Expenses
// & Bills", "Sales & Get Paid" -- doesn't fit there). Each rail item lands on
// the category's first item, the same destination clicking the category
// heading in the /all-apps sidebar goes to.
export const PRIMARY_NAV_CATEGORIES: ReadonlyArray<{ id: string; railLabel: string }> = [
  { id: "accounting", railLabel: "Accounting" },
  { id: "expenses-bills", railLabel: "Expenses" },
  { id: "sales-get-paid", railLabel: "Sales" }
];

const PRIMARY_NAV_CATEGORY_IDS = new Set(PRIMARY_NAV_CATEGORIES.map((entry) => entry.id));

/** Everything that is NOT promoted onto the rail -- the "More apps" menu. */
export const MORE_APPS_CATEGORIES: AppCategory[] = ALL_APPS_CATEGORIES.filter((category) => !PRIMARY_NAV_CATEGORY_IDS.has(category.id));

/** The path part of an item href ("/x/y?jobId=team" -> "/x/y"). */
function hrefPath(href: string): string {
  return href.split("?")[0];
}

function itemQueryMatches(href: string, searchParams: URLSearchParams | null): boolean {
  const query = href.split("?")[1];
  // No query on the item, or the caller has no query to compare against
  // (e.g. the pre-hydration fallback render): the path alone decides.
  if (!query || !searchParams) return true;
  return [...new URLSearchParams(query)].every(([key, value]) => searchParams.get(key) === value);
}

/**
 * Which app category the current URL belongs to, for the side rail's active
 * state. Two passes: an exact page match first (including the item's own
 * query, so Team's `Contractors?jobId=team` and Expenses'
 * `Contractors?jobId=expenses` -- same path -- resolve to different
 * categories), then the longest listed parent path, for pages that live
 * under a listed item without being listed themselves (e.g.
 * /all-apps/reconcile/session under Reconcile). Pages outside /all-apps
 * return null -- the caller decides what those belong to.
 */
export function getActiveAppCategoryId(pathname: string, searchParams: URLSearchParams | null): string | null {
  for (const category of ALL_APPS_CATEGORIES) {
    const exact = category.items.some(
      (item) => !item.locked && hrefPath(item.href) === pathname && itemQueryMatches(item.href, searchParams)
    );
    if (exact) return category.id;
  }

  let bestId: string | null = null;
  let bestLength = -1;
  for (const category of ALL_APPS_CATEGORIES) {
    for (const item of category.items) {
      if (item.locked) continue;
      const path = hrefPath(item.href);
      if (pathname.startsWith(`${path}/`) && path.length > bestLength) {
        bestId = category.id;
        bestLength = path.length;
      }
    }
  }
  return bestId;
}

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
