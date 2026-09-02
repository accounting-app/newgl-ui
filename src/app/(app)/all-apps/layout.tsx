"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ALL_APPS_CATEGORIES } from "@/constants/apps";

type AllAppsLayoutProps = Readonly<{
  children: ReactNode;
}>;

// Same accordion-sidebar pattern as Settings (src/app/(app)/settings/layout.tsx)
// -- a persistent left panel grouped by category, content on the right that
// swaps based on the matched sub-route. Sourced from ALL_APPS_CATEGORIES so
// this and the hover flyout (AppsFlyout) never drift apart.
export default function AllAppsLayout({ children }: AllAppsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-4 py-8">
        <h1 className="mb-6 px-2 text-xl font-semibold text-[var(--color-text-global)]">All apps</h1>
        <nav className="flex flex-col gap-6">
          {ALL_APPS_CATEGORIES.map((category) => (
            <div key={category.id}>
              <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
                {category.label}
              </p>
              <div className="flex flex-col gap-0.5">
                {category.items.map((item) => {
                  const active = pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-[var(--color-action-passive-subtle-active)] text-[var(--color-text-global)]"
                          : "text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-global)]"
                      }`}
                    >
                      <Icon className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto bg-[var(--color-container-background-accent)] p-5">{children}</div>
    </div>
  );
}
