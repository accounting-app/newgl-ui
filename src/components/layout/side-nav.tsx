"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, Home, LayoutGrid, Wallet } from "lucide-react";
import type { ComponentType } from "react";
import { AppsFlyout } from "@/components/layout/apps-flyout";
import { APP_CATEGORIES } from "@/constants/apps";

type NavSquareItemProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
  active?: boolean;
  onClick?: () => void;
};

function NavSquareItem({ label, icon: Icon, href, active = false, onClick }: NavSquareItemProps) {
  const content = (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-[var(--gbsg-nav-bar-icon-color)]">
      <div className={`side-nav-icon-shell ${active ? "side-nav-icon-shell-active" : ""}`}>
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-[11px] font-[var(--font-weight-body-semibold)] leading-none text-[var(--gbsg-nav-bar-text-color)]">
        {label}
      </span>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" aria-label={label} onClick={onClick} className="group block h-[72px] w-full">
        {content}
      </button>
    );
  }

  return (
    <Link href={href ?? "#"} aria-label={label} className="group block h-[72px] w-full">
      {content}
    </Link>
  );
}

export function SideNav() {
  const pathname = usePathname();
  const [isAppsOpen, setIsAppsOpen] = useState(false);
  const appsRef = useRef<HTMLDivElement>(null);

  const isHomeSelected = pathname === "/";
  const isRegisterSelected = pathname.startsWith("/register");
  const isReportsSelected = pathname.startsWith("/reports");
  // "All apps" reads as active whenever the current page is one of its own
  // categories/items -- e.g. Settings screens, which no longer have their
  // own dedicated rail icon (they're all reachable through here now).
  const isAppsSelected = APP_CATEGORIES.some(
    (category) =>
      (category.href && pathname.startsWith(category.href) && category.id !== "reports") ||
      category.items.some((item) => pathname.startsWith(item.href) && item.href !== "/register")
  );

  useEffect(() => {
    if (!isAppsOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (appsRef.current && event.target instanceof Node && !appsRef.current.contains(event.target)) {
        setIsAppsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isAppsOpen]);

  return (
    <aside className="side-nav relative flex h-full w-[73px] flex-col justify-between bg-[var(--color-sidebar-background)]">
      <div className="flex flex-col">
        <Link href="/" className="mx-[4px] flex h-[72px] items-center justify-center" aria-label="Go to home">
          <Image src="/logo.svg" alt="Quickslike logo" width={26} height={26} priority />
        </Link>

        <div className="mx-[4px] flex flex-col">
          <NavSquareItem label="Home" icon={Home} href="/" active={isHomeSelected} />
          <NavSquareItem label="Register" icon={Wallet} href="/register" active={isRegisterSelected} />
          <NavSquareItem label="Reports" icon={BookOpen} href="/reports" active={isReportsSelected} />
        </div>
      </div>

      <div className="relative mx-[4px] pb-[12px]" ref={appsRef}>
        <NavSquareItem
          label="All apps"
          icon={LayoutGrid}
          active={isAppsOpen || isAppsSelected}
          onClick={() => setIsAppsOpen((open) => !open)}
        />
        {isAppsOpen ? (
          <div className="absolute bottom-[12px] left-full z-50 ml-1">
            <AppsFlyout onNavigate={() => setIsAppsOpen(false)} />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
