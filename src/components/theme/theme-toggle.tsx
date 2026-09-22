"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { useTheme } from "next-themes";

type ThemeOption = { value: "light" | "dark" | "modern" | "america250" | "pretty"; label: string };

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "modern", label: "Modern" },
  { value: "america250", label: "America 250" },
  { value: "pretty", label: "Pretty" }
];

type ThemeToggleProps = {
  /** Which edge of the button the menu opens from -- "bottom" (default, the
   * top header's own placement) or "top" for a trigger sitting in a bottom
   * corner (e.g. the auth pages), where a downward menu would run off-screen. */
  menuAlign?: "top" | "bottom";
  /** "compact" (default) is the header's own small icon-only button.
   * "standalone" is bigger with a visible border and background -- for a
   * trigger sitting on its own away from other controls (e.g. the auth
   * pages' bottom corner), where a bare icon reads as too easy to miss. */
  variant?: "compact" | "standalone";
};

// Was a two-state light/dark toggle button; now a dropdown since the app
// has more than two skins (PlainGL parity #10 -- PlainGL ships 5 cosmetic
// skins via a <select>, this mirrors that with the app's own menu pattern
// instead of a native select).
export function ThemeToggle({ menuAlign = "bottom", variant = "compact" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const sizeClasses = variant === "standalone" ? "h-11 w-11" : "h-8 w-8";

  if (!mounted) {
    return <div className={sizeClasses} aria-hidden="true" />;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Choose theme"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`flex items-center justify-center rounded-full transition-colors ${sizeClasses} ${
          variant === "standalone"
            ? "border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] text-[var(--color-icon-secondary)] shadow-sm hover:text-[var(--color-icon-primary)]"
            : "text-[var(--color-icon-secondary)] hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-icon-primary)]"
        }`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <Palette className={variant === "standalone" ? "h-5 w-5" : "h-[18px] w-[18px]"} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className={`absolute right-0 z-10 w-40 overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg ${
            menuAlign === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitem"
              onClick={() => {
                setTheme(option.value);
                setIsOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[var(--color-text-global)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)]"
            >
              {option.label}
              {theme === option.value ? (
                <Check className="h-3.5 w-3.5 text-[var(--color-link-action)]" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
