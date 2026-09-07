"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { ChevronDown, Gem } from "lucide-react";
import { ALL_APPS_CATEGORIES } from "@/constants/apps";
import type { AppCategory } from "@/constants/apps";

type AllAppsLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Exact path match, plus: an item's own query string (if it has one, e.g.
// Contractors' ?jobId=team vs ?jobId=expenses) must match the current
// URL's query too. Two items can share a path and only differ by query --
// they should never both read as active at once, and a plain
// startsWith-only path check would also wrongly mark BOTH "Overview"
// (/all-apps/expenses-bills) and "Expense transactions"
// (/all-apps/expenses-bills/expense-transactions) active while on the
// latter, since its path starts with the former's href.
function isItemActive(href: string, pathname: string, searchParams: URLSearchParams): boolean {
  const [itemPath, itemQuery] = href.split("?");
  if (pathname !== itemPath) return false;
  if (!itemQuery) return true;
  return [...new URLSearchParams(itemQuery)].every(([key, value]) => searchParams.get(key) === value);
}

function categoryContainsPath(category: AppCategory, pathname: string, searchParams: URLSearchParams): boolean {
  return category.items.some((item) => !item.locked && isItemActive(item.href, pathname, searchParams));
}

// Same accordion-sidebar pattern as Settings (src/app/(app)/settings/layout.tsx),
// but a true accordion (one category open at a time, matching QBO's own
// "All apps" menu) rather than every category permanently expanded --
// sourced from ALL_APPS_CATEGORIES so this and the hover flyout
// (AppsFlyout) never drift apart.
//
// Reads useSearchParams (for the Contractors ?jobId= active-state check
// above) -- Next.js requires that behind a Suspense boundary, so the
// interactive part lives in its own component below, rendered inside
// <Suspense> with a static, non-highlighted version of the same nav as
// its fallback (avoids a layout shift during the brief pre-hydration gap).
export default function AllAppsLayout({ children }: AllAppsLayoutProps) {
  return (
    <div className="flex h-full min-h-0">
      <Suspense fallback={<AllAppsSidebarShell />}>
        <AllAppsSidebar />
      </Suspense>
      <div className="min-w-0 flex-1 overflow-y-auto bg-[var(--color-container-background-accent)] p-5">{children}</div>
    </div>
  );
}

function AllAppsSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initiallyOpen = ALL_APPS_CATEGORIES.find((c) => categoryContainsPath(c, pathname, searchParams))?.id ?? ALL_APPS_CATEGORIES[0]?.id ?? null;
  const [openId, setOpenId] = useState<string | null>(initiallyOpen);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-2 py-6">
      <h1 className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">All apps</h1>
      <nav className="flex flex-col gap-0.5">
        {ALL_APPS_CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          const isOpen = openId === category.id;

          if (category.locked) {
            return (
              <div
                key={category.id}
                title="Not available on this plan"
                className="flex cursor-not-allowed items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-medium text-[var(--color-text-disabled)]"
              >
                <span className="flex items-center gap-2.5">
                  <CategoryIcon className="h-4 w-4" aria-hidden="true" />
                  {category.label}
                </span>
                <Gem className="h-3.5 w-3.5" aria-hidden="true" />
              </div>
            );
          }

          return (
            <div key={category.id}>
              <button
                type="button"
                onClick={() => setOpenId((current) => (current === category.id ? null : category.id))}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
              >
                <span className="flex items-center gap-2.5">
                  <CategoryIcon className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                  {category.label}
                </span>
                <ChevronDown className={`h-4 w-4 text-[var(--color-icon-secondary)] transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
              </button>

              {isOpen ? (
                <div className="mb-1 mt-0.5 flex flex-col gap-0.5">
                  {category.items.map((item) => {
                    const ItemIcon = item.icon;
                    if (item.locked) {
                      return (
                        <div
                          key={`${item.href}-${item.label}`}
                          title="Not available on this plan"
                          className="flex cursor-not-allowed items-center justify-between gap-2.5 rounded-lg py-2 pl-8 pr-2 text-sm text-[var(--color-text-disabled)]"
                        >
                          <span className="flex items-center gap-2.5">
                            <ItemIcon className="h-4 w-4" aria-hidden="true" />
                            {item.label}
                          </span>
                          <Gem className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                      );
                    }
                    const active = isItemActive(item.href, pathname, searchParams);
                    return (
                      <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-2.5 rounded-lg py-2 pl-8 pr-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-[var(--color-action-passive-subtle-active)] text-[var(--color-text-global)]"
                            : "text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-global)]"
                        }`}
                      >
                        <ItemIcon className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

// Suspense fallback -- the same categories, first one open, nothing
// marked active (no searchParams-free way to know that yet). Only ever
// visible for the brief pre-hydration gap, so it doesn't need to be
// interactive.
function AllAppsSidebarShell() {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-2 py-6">
      <h1 className="mb-4 px-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">All apps</h1>
      <nav className="flex flex-col gap-0.5">
        {ALL_APPS_CATEGORIES.map((category, index) => {
          const CategoryIcon = category.icon;
          const isOpen = index === 0 && !category.locked;
          return (
            <div key={category.id}>
              <div
                className={`flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[var(--color-text-global)] ${category.locked ? "text-[var(--color-text-disabled)]" : ""}`}
              >
                <span className="flex items-center gap-2.5">
                  <CategoryIcon className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                  {category.label}
                </span>
                {category.locked ? <Gem className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className={`h-4 w-4 text-[var(--color-icon-secondary)] ${isOpen ? "" : "-rotate-90"}`} aria-hidden="true" />}
              </div>
              {isOpen ? (
                <div className="mb-1 mt-0.5 flex flex-col gap-0.5">
                  {category.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={`${item.href}-${item.label}`} className="flex items-center gap-2.5 rounded-lg py-2 pl-8 pr-2 text-sm font-medium text-[var(--color-text-primary)]">
                        <ItemIcon className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                        {item.label}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
