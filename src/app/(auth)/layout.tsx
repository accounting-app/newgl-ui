"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AuthGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

// No AppShell/sidebar here on purpose -- these are the only pages an
// unauthenticated visitor ever sees. Full-bleed two-panel layout, not a
// centered card: the brand panel (left, 50/50 with the form, hidden below
// lg -- there's no room for it on a phone) is inset with its own padding
// so it reads as a rounded card floating away from the screen edges,
// while the right side runs edge-to-edge -- logo pinned near the top, the
// form centered in the middle, and the "Sign in"/"Sign up" switch link
// pinned to the bottom (hence "use client": needs the pathname to know
// which page it's on, rather than each page rendering its own copy).
export default function AuthGroupLayout({ children }: AuthGroupLayoutProps) {
  const pathname = usePathname();
  const isLogin = pathname?.startsWith("/login");

  return (
    <main className="flex h-screen bg-[var(--color-container-background-primary)]">
      <div className="hidden w-1/2 shrink-0 p-4 lg:block">
        <BrandPanel />
      </div>

      <div className="flex flex-1 flex-col items-center px-6 py-10 text-center">
        <div>
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

        <div className="flex w-full flex-1 flex-col items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <p className="text-sm text-[var(--color-text-primary)]">
          {isLogin ? (
            <>
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-[var(--color-link-action)] hover:underline">
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link href="/login" className="text-[var(--color-link-action)] hover:underline">
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}

function BrandPanel() {
  return (
    <aside className="relative h-full w-full overflow-hidden rounded-3xl text-white">
      <Image src="/login-back.jpeg" alt="" fill sizes="50vw" priority className="object-cover object-top" />

      {/* Brand-color gradient overlay -- the photo alone is too light for
          white text to read on; this darkens it bottom-heavy (where the
          headline sits) and tints it with the product's own green rather
          than a flat black scrim. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b3d1a]/70 via-transparent to-[#2CA01C]/30 mix-blend-multiply" />

      <div className="relative flex h-full flex-col justify-between px-12 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Double-entry, done right</p>

        <div>
          <h2 className="mb-3 max-w-[575px] text-5xl font-semibold leading-[1.05] md:text-6xl">
            Every transaction, perfectly balanced.
          </h2>
          <p className="max-w-sm text-lg text-white/70">The GL of accountants, by accountants, for accountants.</p>
        </div>
      </div>
    </aside>
  );
}
