"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Gem, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { ALL_APPS_CATEGORIES, getActiveAppCategoryId } from "@/constants/apps";

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
const SUBMENU_OPEN_KEY = "newgl:all-apps-submenu-open";

// The sub menu starts closed and remembers the user's choice. Storage can be
// unavailable (private window, blocked site data), so every access is
// guarded and the page just falls back to "closed". The stored value is
// read after mount, not during render, so server and first client render agree.
function useSubmenuOpen(): [boolean, (open: boolean) => void, boolean] {
  const [open, setOpen] = useState(false);
  // Transitions only switch on after the stored value has been applied, so a
  // remembered "open" doesn't visibly slide in on every page load.
  const [animate, setAnimate] = useState(false);
  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(SUBMENU_OPEN_KEY) === "1");
    } catch {
      // keep the closed default
    }
    const timer = window.setTimeout(() => setAnimate(true), 50);
    return () => window.clearTimeout(timer);
  }, []);
  function update(next: boolean) {
    setOpen(next);
    try {
      window.localStorage.setItem(SUBMENU_OPEN_KEY, next ? "1" : "0");
    } catch {
      // not persisted, still works for this visit
    }
  }
  return [open, update, animate];
}

export default function AllAppsLayout({ children }: AllAppsLayoutProps) {
  const [submenuOpen, setSubmenuOpen, animate] = useSubmenuOpen();
  const motion = animate ? "transition-all duration-300 ease-out motion-reduce:transition-none" : "";
  return (
    <div className="flex h-full min-h-0">
      {/* The sidebar stays mounted so it can slide: the wrapper animates its
          width (pushing the content) while the aside inside slides left. */}
      <div
        className={`shrink-0 overflow-hidden ${motion} ${submenuOpen ? "w-64" : "w-0"}`}
        aria-hidden={!submenuOpen}
        inert={!submenuOpen}
      >
        <div className={`h-full w-64 ${motion} ${submenuOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <Suspense fallback={null}>
            <AllAppsSidebar onCollapse={() => setSubmenuOpen(false)} />
          </Suspense>
        </div>
      </div>
      <div className={`relative min-w-0 flex-1 overflow-y-auto bg-[var(--color-container-background-accent)] p-5 ${motion} ${submenuOpen ? "" : "pl-12"}`}>
        {/* Floating toggle: slides out to the left when the sub menu opens
            and back in from the left when it closes. */}
        <button
          type="button"
          onClick={() => setSubmenuOpen(true)}
          aria-label="Show sub menu"
          title="Show sub menu"
          tabIndex={submenuOpen ? -1 : 0}
          className={`absolute left-0 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-r-lg border border-l-0 border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] text-[var(--color-icon-secondary)] shadow-md hover:text-[var(--color-text-global)] ${motion} ${
            submenuOpen ? "pointer-events-none -translate-x-full opacity-0" : "translate-x-0 opacity-100"
          }`}
        >
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  );
}

function AllAppsSidebar({ onCollapse }: { onCollapse: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategoryId = getActiveAppCategoryId(pathname, searchParams);
  const [openId, setOpenId] = useState<string | null>(activeCategoryId ?? ALL_APPS_CATEGORIES[0]?.id ?? null);

  // This layout stays mounted while you move between /all-apps pages, so the
  // initial state above only covers the first load. Landing on another
  // category -- e.g. clicking Sales on the side rail while Expenses is open
  // here -- must open that category too. Tracked during render (React's
  // "adjust state when a prop changes" pattern) rather than in an effect, so
  // there's no frame showing the wrong section open. Manually collapsing or
  // expanding a section is untouched: this only fires when the active
  // category itself changes.
  const [syncedCategoryId, setSyncedCategoryId] = useState(activeCategoryId);
  if (activeCategoryId !== syncedCategoryId) {
    setSyncedCategoryId(activeCategoryId);
    if (activeCategoryId) setOpenId(activeCategoryId);
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-2 py-6">
      <div className="mb-4 flex items-center justify-between px-2">
        <h1 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">All apps</h1>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Hide sub menu"
          title="Hide sub menu"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-icon-secondary)] hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-global)]"
        >
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
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
