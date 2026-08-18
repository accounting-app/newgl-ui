import type { Metadata } from "next";
import Link from "next/link";
import { REPORT_NAV_ITEMS } from "@/constants/reports";

export const metadata: Metadata = {
  title: "Standard Reports"
};

// Matches QuickBooks Online's own Reports index: a plain list of report
// names with a small trailing icon, not a card grid -- the page itself
// fills the available width (p-5 = 20px edges, no artificial centering),
// the list stays a comfortable reading width without being centered.
export default function ReportsIndexPage() {
  return (
    <main className="h-full overflow-auto bg-[var(--color-container-background-primary)] p-5">
      <h1 className="mb-6 text-2xl font-semibold text-[var(--color-text-global)]">Standard Reports</h1>
      <ul className="flex max-w-xl flex-col divide-y divide-[var(--color-divider-tertiary)]">
        {REPORT_NAV_ITEMS.map(({ href, icon: Icon, label }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center justify-between py-3 text-sm text-[var(--color-text-primary)] transition-colors hover:text-[var(--color-link-action)]"
            >
              {label}
              <Icon className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
