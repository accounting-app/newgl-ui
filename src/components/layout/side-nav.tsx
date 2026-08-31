"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { forwardRef, useEffect, useRef, useState } from "react";
import { BookOpen, Home, LayoutGrid, Settings2, Wallet } from "lucide-react";
import type { ComponentType, FocusEvent, KeyboardEvent } from "react";
import { AppsFlyout } from "@/components/layout/apps-flyout";

// Hover-intent delay before the flyout opens -- long enough that just
// passing over the icon on the way to something else doesn't pop it open.
const HOVER_OPEN_DELAY_MS = 350;

type NavSquareItemProps = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  href: string;
  active?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

// forwardRef so SideNav can return keyboard focus to this exact trigger
// when the flyout it opens is dismissed via Escape. Focus/blur on the
// trigger itself is handled by the wrapping div's capture handlers in
// SideNav (focus/blur bubble up as focusin/focusout), so no dedicated
// prop is needed here.
const NavSquareItem = forwardRef<HTMLAnchorElement, NavSquareItemProps>(function NavSquareItem(
  { label, icon: Icon, href, active = false, onMouseEnter, onMouseLeave },
  ref
) {
  return (
    <Link
      ref={ref}
      href={href}
      aria-label={label}
      className="group block h-[72px] w-full"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
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
});

export function SideNav() {
  const pathname = usePathname();
  const [isFlyoutOpen, setIsFlyoutOpen] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allAppsTriggerRef = useRef<HTMLAnchorElement>(null);
  const allAppsWrapperRef = useRef<HTMLDivElement>(null);

  const isHomeSelected = pathname === "/";
  const isRegisterSelected = pathname.startsWith("/register");
  const isReportsSelected = pathname.startsWith("/reports");
  const isAllAppsSelected = pathname.startsWith("/all-apps");
  const isSettingsSelected = pathname.startsWith("/settings");

  function scheduleOpen() {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => setIsFlyoutOpen(true), HOVER_OPEN_DELAY_MS);
  }

  function cancelOpenAndClose() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setIsFlyoutOpen(false);
  }

  function openImmediately() {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    setIsFlyoutOpen(true);
  }

  // Keyboard-focus equivalent of the hover-intent open above: opens
  // instantly (no hover delay -- delay only makes sense for a mouse
  // passing through) and stays open as long as focus is anywhere inside
  // the trigger + flyout, closing only once focus actually leaves both.
  function handleFocusCapture() {
    openImmediately();
  }

  function handleBlurCapture(event: FocusEvent) {
    if (allAppsWrapperRef.current?.contains(event.relatedTarget as Node)) return;
    cancelOpenAndClose();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    cancelOpenAndClose();
    allAppsTriggerRef.current?.focus();
  }

  useEffect(() => {
    return () => {
      if (openTimerRef.current) clearTimeout(openTimerRef.current);
    };
  }, []);

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

          {/* Hovering opens the flyout after a short delay; clicking navigates
              straight to the /all-apps accordion page (its own submenu view,
              same pattern as Settings) -- see UI_DESIGN_SYSTEM_PLAN.md Part 3.
              Keyboard-focus anywhere inside this wrapper (the trigger or,
              once open, the flyout's own links) opens it instantly and keeps
              it open; Escape closes it and returns focus to the trigger. */}
          <div
            ref={allAppsWrapperRef}
            className="relative"
            onMouseEnter={scheduleOpen}
            onMouseLeave={cancelOpenAndClose}
            onFocusCapture={handleFocusCapture}
            onBlurCapture={handleBlurCapture}
            onKeyDown={handleKeyDown}
          >
            <NavSquareItem
              ref={allAppsTriggerRef}
              label="All apps"
              icon={LayoutGrid}
              href="/all-apps"
              active={isAllAppsSelected || isFlyoutOpen}
            />
            {isFlyoutOpen ? (
              <div className="absolute left-full top-0 z-50 ml-1">
                <AppsFlyout onNavigate={cancelOpenAndClose} />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-[4px] pb-[12px]">
        <NavSquareItem label="Settings" icon={Settings2} href="/settings/ai" active={isSettingsSelected} />
      </div>
    </aside>
  );
}
