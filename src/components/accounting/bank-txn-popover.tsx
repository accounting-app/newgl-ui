"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

type BankTxnPopoverProps = {
  /** The marker the user clicks (an icon). */
  trigger: ReactNode;
  label: string;
  triggerClassName?: string;
  children: (helpers: { close: () => void }) => ReactNode;
};

const WIDTH = 380;

// A small anchored card (QBO's suggestion bubbles). Positioned with `fixed`
// from the trigger's rect on open, because the table's scroll container would
// clip an absolutely positioned child; it opens above the marker when there's
// room, below otherwise, and stays inside the viewport horizontally.
export function BankTxnPopover({ trigger, label, triggerClassName = "", children }: BankTxnPopoverProps) {
  const [position, setPosition] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = () => setPosition(null);

  function toggle() {
    if (position) return close();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const above = rect.top > 300;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 12);
    setPosition({ top: above ? rect.top - 10 : rect.bottom + 10, left, above });
  }

  useEffect(() => {
    if (!position) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setPosition(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPosition(null);
    }
    function onScroll() {
      setPosition(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [position]);

  return (
    <>
      <button ref={triggerRef} type="button" aria-label={label} aria-expanded={position !== null} onClick={toggle} className={triggerClassName}>
        {trigger}
      </button>
      {position ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={label}
          style={{ position: "fixed", top: position.top, left: position.left, width: WIDTH, transform: position.above ? "translateY(-100%)" : undefined }}
          className="z-50 rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4 shadow-xl"
        >
          <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-3 text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          {children({ close })}
        </div>
      ) : null}
    </>
  );
}
