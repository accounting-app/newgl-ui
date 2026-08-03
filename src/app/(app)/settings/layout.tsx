"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const SETTINGS_TABS = [
  { label: "AI", href: "/settings/ai" },
  { label: "Ledger", href: "/settings/ledger" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Organization", href: "/settings/organization" }
];

type SettingsLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="h-full overflow-auto bg-[var(--color-container-background-accent)] px-6 py-8 md:px-10">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-6 text-2xl font-semibold text-[var(--color-text-global)]">Settings</h1>

        <nav className="mb-6 flex gap-1 border-b border-[var(--color-divider-tertiary)]">
          {SETTINGS_TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-[var(--color-link-action)] text-[var(--color-text-global)]"
                    : "border-transparent text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </div>
  );
}
