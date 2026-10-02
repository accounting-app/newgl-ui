"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export type DropdownMenuItem = {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
};

type DropdownMenuProps = {
  /** Renders the trigger; spread `props` onto the element that should open the menu. */
  trigger: (props: { onClick: () => void; "aria-haspopup": "menu"; "aria-expanded": boolean }) => ReactNode;
  items: DropdownMenuItem[];
  align?: "left" | "right";
};

// Small action menu (QBO's "View report v" / "Save for later v" style).
// Closes on outside click, Escape, or after picking an item.
export function DropdownMenu({ trigger, items, align = "right" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(event: MouseEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {trigger({ onClick: () => setOpen((current) => !current), "aria-haspopup": "menu", "aria-expanded": open })}
      {open ? (
        <div
          role="menu"
          className={`absolute z-40 mt-1 min-w-[10rem] rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-md ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className="block w-full px-4 py-2 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)] disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)]"
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
