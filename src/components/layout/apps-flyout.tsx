"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Gem } from "lucide-react";
import { ALL_APPS_CATEGORIES } from "@/constants/apps";

type AppsFlyoutProps = {
  onNavigate: () => void;
};

// Two-level hover flyout modeled directly after QuickBooks Online's "All
// apps" menu (screenshots in UI_DESIGN_SYSTEM_PLAN.md Part 3): a category
// list, each expandable to its own sub-items panel to the right. Sourced
// from the same ALL_APPS_CATEGORIES as the /all-apps accordion page, so a
// category/item marked `locked` (a QBO feature we haven't built, or that's
// paid-tier there) renders the same grayed-out, non-navigating treatment
// in both places instead of drifting apart.
export function AppsFlyout({ onNavigate }: AppsFlyoutProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(ALL_APPS_CATEGORIES[0]?.id ?? null);

  return (
    <div role="menu" className="flex items-start">
      <div className="w-64 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-2 shadow-lg">
        <p className="px-4 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
          All apps
        </p>
        {ALL_APPS_CATEGORIES.map((category) => {
          const Icon = category.icon;
          const hasItems = category.items.length > 0;
          const isHovered = hoveredId === category.id;

          if (category.locked) {
            return (
              <div
                key={category.id}
                title="Not available on this plan"
                role="menuitem"
                aria-disabled="true"
                className="flex cursor-not-allowed items-center justify-between gap-3 px-4 py-2.5 text-sm text-[var(--color-text-disabled)]"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {category.label}
                </span>
                <Gem className="h-4 w-4" aria-hidden="true" />
              </div>
            );
          }

          return (
            <div
              key={category.id}
              onMouseEnter={() => setHoveredId(category.id)}
              onFocus={() => setHoveredId(category.id)}
              className="relative"
            >
              <Link
                href={category.items[0]?.href ?? "/all-apps"}
                onClick={onNavigate}
                role="menuitem"
                className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-[var(--color-text-global)] transition-colors ${
                  isHovered ? "bg-[var(--color-action-passive-subtle-hover)]" : ""
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                  {category.label}
                </span>
                {hasItems ? <ChevronRight className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" /> : null}
              </Link>

              {hasItems && isHovered ? (
                <div className="absolute left-full top-0 z-50 ml-1 w-64 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-2 shadow-lg">
                  {category.items.map((item) => {
                    const ItemIcon = item.icon;
                    if (item.locked) {
                      return (
                        <div
                          key={`${item.href}-${item.label}`}
                          title="Not available on this plan"
                          role="menuitem"
                          aria-disabled="true"
                          className="flex cursor-not-allowed items-center justify-between gap-3 px-4 py-2.5 text-sm text-[var(--color-text-disabled)]"
                        >
                          <span className="flex items-center gap-3">
                            <ItemIcon className="h-4 w-4" aria-hidden="true" />
                            {item.label}
                          </span>
                          <Gem className="h-4 w-4" aria-hidden="true" />
                        </div>
                      );
                    }
                    return (
                      <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        onClick={onNavigate}
                        role="menuitem"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text-global)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)]"
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
      </div>
    </div>
  );
}
