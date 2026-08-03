import type { Metadata } from "next";
import Link from "next/link";
import { REPORT_NAV_ITEMS } from "@/constants/reports";

export const metadata: Metadata = {
  title: "Standard Reports"
};

export default function ReportsIndexPage() {
  return (
    <main className="tw-override main bg-[var(--color-container-background-primary)] text-sm text-[var(--color-text-primary)]">
      <header className="header mb-4">
        <div className="w-full">
          <h1 className="page-title"> Standard Reports</h1>
        </div>
      </header>

      <section className="page-content">
        <div className="mx-auto mt-8 w-full max-w-[840px]">
          <ul className="grid gap-3 sm:grid-cols-2">
            {REPORT_NAV_ITEMS.map(({ href, icon: Icon, label, description }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-start gap-4 rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-icon-secondary)]" />
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{label}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-icon-secondary)]">{description}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
