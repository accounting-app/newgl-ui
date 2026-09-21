import type { ReactNode } from "react";
import Image from "next/image";

type AuthGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

// No AppShell/sidebar here on purpose -- these are the only pages an
// unauthenticated visitor ever sees. Two-panel layout: a fixed-dark brand
// panel (left, hidden below lg -- there's no room for it on a phone) and a
// theme-following form panel (right) so inputs/text stay correct whatever
// light/dark/palette the visitor's browser or a returning user's saved
// preference resolves to. Built entirely from this app's own design tokens
// and wordmark, not a copied template's colors/type.
export default function AuthGroupLayout({ children }: AuthGroupLayoutProps) {
  return (
    <main className="flex min-h-screen bg-[var(--color-container-background-primary)]">
      <BrandPanel />

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center lg:hidden">
            {/* Small dark chip regardless of the active theme -- the white
                wordmark needs a dark surface to read on, but this sits on
                the theme-following panel (light in the default theme). */}
            <div className="inline-flex items-center rounded-lg bg-[#0b0f0d] px-4 py-3">
              <Image
                style={{ height: "auto", width: "auto" }}
                src="/logo-simple-white.png"
                alt="Simple"
                width={120}
                height={39}
                priority
              />
            </div>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden w-[42%] max-w-[560px] flex-col justify-between overflow-hidden bg-[#0b0f0d] px-12 py-10 text-white lg:flex">
      {/* Ledger-line motif: faint parallel rules evoking a general ledger's
          rows, in the product's own green -- decorative only, aria-hidden. */}
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

      <div className="relative">
        <Image style={{ height: "auto", width: "auto" }} src="/logo-simple-white.png" alt="Simple" width={150} height={49} priority />
      </div>

      <div className="relative">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#7fd68a]">Double-entry, done right</p>
        <h2 className="mb-3 text-4xl font-semibold leading-tight">Every transaction, perfectly balanced.</h2>
        <p className="max-w-sm text-sm text-white/70">The GL of accountants, by accountants, for accountants.</p>
      </div>
    </aside>
  );
}
