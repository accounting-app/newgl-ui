"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ComponentType } from "react";
import { BookOpen, Building2, FilePlus2, PlusCircle, Upload, Wallet } from "lucide-react";
import { DashboardMetrics } from "@/components/home/dashboard-metrics";
import { ALL_APPS_CATEGORIES } from "@/constants/apps";
import type { AppNavItem } from "@/constants/apps";
import { createClient } from "@/lib/supabase/client";

// Modeled after QuickBooks Online's dashboard top nav (a horizontal row of
// product-area pills) -- Register and Reports are their own top-level rail
// items, added here explicitly since they aren't part of the All apps menu
// at all. Everything else is one pill per All apps CATEGORY (Accounting,
// Expenses & Bills, ...), not one per individual sub-page -- exploding
// every category's items out flat made this row a dozen-plus pills long
// and impossible to scan. Each category pill goes to its first item, same
// destination clicking the category heading itself in All apps goes to.
const NAV_PILLS: AppNavItem[] = [
  { label: "Register", href: "/register", icon: Wallet },
  { label: "Reports", href: "/reports", icon: BookOpen },
  ...ALL_APPS_CATEGORIES.filter((category) => !category.locked && category.items.length > 0).map((category) => ({
    label: category.label,
    href: category.items[0].href,
    icon: category.icon
  }))
];

type CreateActionItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

const CREATE_ACTIONS: CreateActionItem[] = [
  { label: "Add Check", href: "/register", icon: PlusCircle },
  { label: "New Journal Entry", href: "/register", icon: FilePlus2 },
  { label: "Add an account", href: "/all-apps/chart-of-accounts", icon: Building2 },
  { label: "Bulk paste import", href: "/settings/ledger?bulkPaste=1", icon: Upload }
];

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const firstSegment = local.split(/[.\-_+]/)[0] ?? local;
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
}

export function HomeGreetingScreen() {
  const [greeting, setGreeting] = useState("Welcome");
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (!user) return;
      const fullName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null;
      const firstName = fullName ? fullName.split(" ")[0] : user.email ? displayNameFromEmail(user.email) : null;
      setDisplayName(firstName);
    });
  }, []);

  return (
    <main className="h-full overflow-auto bg-[var(--color-container-background-accent)] p-5">
      <h1 className="mb-6 text-center text-4xl font-semibold text-[var(--color-text-global)] md:text-5xl">
        {greeting}
        {displayName ? `, ${displayName}` : ""}!
      </h1>

      <nav aria-label="Quick sections" className="mb-8 flex flex-wrap items-center justify-center gap-3">
        {NAV_PILLS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="flex items-center gap-2 rounded-full border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-4 py-2 text-sm font-medium text-[var(--color-text-global)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-container-background-accent)] text-[var(--color-link-action)]">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mb-8">
        <p className="mb-3 text-sm font-semibold text-[var(--color-text-global)]">Create actions</p>
        <div className="flex flex-wrap items-center gap-2">
          {CREATE_ACTIONS.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              className="rounded-full border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-3.5 py-1.5 text-sm text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-global)]"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <DashboardMetrics />
    </main>
  );
}
