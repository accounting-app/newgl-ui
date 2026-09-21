import type { ReactNode } from "react";
import Image from "next/image";

type AuthGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

// No AppShell/sidebar here on purpose -- these are the only pages an
// unauthenticated visitor ever sees. Full-bleed two-panel layout, not a
// centered card: the brand panel (left, larger share, hidden below lg --
// there's no room for it on a phone) is inset with its own padding so it
// reads as a rounded card floating away from the screen edges, while the
// right side runs edge-to-edge and centers its own content (logo + form)
// both horizontally and vertically. Built entirely from this app's own
// design tokens and wordmark, not a copied template's colors or type.
export default function AuthGroupLayout({ children }: AuthGroupLayoutProps) {
  return (
    <main className="flex h-screen bg-[var(--color-container-background-primary)]">
      <div className="hidden w-[45%] max-w-[640px] shrink-0 p-4 lg:block">
        <BrandPanel />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <Image
            className="hidden dark:block"
            style={{ height: "auto", width: "auto" }}
            src="/logo-simple-white.png"
            alt="Simple"
            width={120}
            height={39}
            priority
          />
          <Image
            className="block dark:hidden"
            style={{ height: "auto", width: "auto" }}
            src="/logo-simple-green.png"
            alt="Simple"
            width={120}
            height={39}
            priority
          />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <aside className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-3xl bg-[#0b0f0d] px-12 py-10 text-white">
      {/* Ledger-line motif: faint parallel rules evoking a general ledger's
          rows, in the product's own green -- decorative only, aria-hidden.
          A photo/illustration can replace this background later for more
          contrast against the text. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent, transparent 38px, #2CA01C 39px, transparent 40px)"
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
        style={{ backgroundColor: "#2CA01C" }}
      />

      <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Double-entry, done right</p>

      <div className="relative">
        <h2 className="mb-3 text-4xl font-semibold leading-tight">Every transaction, perfectly balanced.</h2>
        <p className="max-w-sm text-sm text-white/70">The GL of accountants, by accountants, for accountants.</p>
      </div>
    </aside>
  );
}
