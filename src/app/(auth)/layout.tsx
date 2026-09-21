import type { ReactNode } from "react";
import Image from "next/image";

type AuthGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

// No AppShell/sidebar here on purpose -- these are the only pages an
// unauthenticated visitor ever sees. One framed card holds both panels: a
// fixed-dark brand panel (left, larger share, rounded and inset so the
// card's own background shows as a border around it -- hidden below lg,
// there's no room for it on a phone) and a theme-following, centered form
// panel (right). Built entirely from this app's own design tokens and
// wordmark, not a copied template's colors or type.
export default function AuthGroupLayout({ children }: AuthGroupLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-container-background-accent)] p-4 sm:p-6">
      <div className="flex w-full max-w-6xl overflow-hidden rounded-3xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-3 shadow-xl">
        <BrandPanel />

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center sm:px-12">
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
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <aside className="relative hidden w-[58%] flex-col justify-between overflow-hidden rounded-2xl bg-[#0b0f0d] px-12 py-10 text-white lg:flex">
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
