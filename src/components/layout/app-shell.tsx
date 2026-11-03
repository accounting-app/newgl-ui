import type { ReactNode } from "react";
import { SideNav } from "@/components/layout/side-nav";
import { TopHeader } from "@/components/layout/top-header";

type AppShellProps = Readonly<{
  children: ReactNode;
}>;

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="h-screen bg-[var(--color-container-background-accent)] p-[6px] pl-0">
      <div className="flex h-full">
        <SideNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader />
          <div className="min-h-0 flex-1 overflow-auto rounded-b-[var(--radius-x-large)] bg-[var(--color-container-background-primary)]">{children}</div>
        </div>
      </div>
    </div>
  );
}
