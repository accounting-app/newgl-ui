"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Home, Settings2, Wallet } from "lucide-react";
import type { ComponentType } from "react";

type NavSquareItemProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  active?: boolean;
};

function NavSquareItem({ label, icon: Icon, href, active = false }: NavSquareItemProps) {
  return (
    <Link href={href} aria-label={label} className="group block h-[72px] w-full">
      <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-[var(--gbsg-nav-bar-icon-color)]">
        <div className={`side-nav-icon-shell ${active ? "side-nav-icon-shell-active" : ""}`}>
          <Icon className="h-6 w-6" />
        </div>
        <span className="text-[11px] font-[var(--font-weight-body-semibold)] leading-none text-[var(--gbsg-nav-bar-text-color)]">
          {label}
        </span>
      </div>
    </Link>
  );
}

export function SideNav() {
  const pathname = usePathname();
  const isHomeSelected = pathname === "/";
  const isAccountingSelected = pathname.startsWith("/register");
  const isBooksSelected = pathname.startsWith("/reports");

  return (
    <aside className="side-nav flex h-full w-[73px] flex-col justify-between bg-[var(--color-sidebar-background)]">
      <div className="flex flex-col">
        <Link href="/" className="mx-[4px] flex h-[72px] items-center justify-center" aria-label="Go to home">
          <Image src="/logo.svg" alt="Quickslike logo" width={26} height={26} priority />
        </Link>

        <div className="mx-[4px] flex flex-col">
          <NavSquareItem label="Home" icon={Home} href="/" active={isHomeSelected} />
          <NavSquareItem label="Register" icon={Wallet} href="/register" active={isAccountingSelected} />
          <NavSquareItem label="Reports" icon={BookOpen} href="/reports" active={isBooksSelected} />
        </div>
      </div>

      <div className="mx-[4px] pb-[12px]">
        <NavSquareItem label="Customize" icon={Settings2} href="/register" />
      </div>
    </aside>
  );
}
