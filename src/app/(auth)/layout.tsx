import type { ReactNode } from "react";
import Image from "next/image";

type AuthGroupLayoutProps = Readonly<{
  children: ReactNode;
}>;

// No AppShell/sidebar here on purpose -- these are the only pages an
// unauthenticated visitor ever sees.
export default function AuthGroupLayout({ children }: AuthGroupLayoutProps) {
  return (
    <main className="flex h-screen items-center justify-center bg-[var(--color-container-background-accent)] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Image
            style={{ height: "auto", width: "auto" }}
            src="/logo-big.png"
            alt="New GL"
            width={64}
            height={64}
            priority
          />
        </div>
        <div className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-8">
          {children}
        </div>
      </div>
    </main>
  );
}
