import type { ReactNode } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/card";

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
        <Card padding="lg">{children}</Card>
      </div>
    </main>
  );
}
