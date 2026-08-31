"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Standard modal focus-trap behavior, shared by both modal patterns in the
 * app (ui/modal.tsx and import-confirm-dialog.tsx): while `active`, moves
 * focus into the container (its first focusable descendant, or the
 * container itself when it has none), constrains Tab/Shift+Tab to loop
 * within the container's own focusable elements so focus can never
 * silently land on the page behind the dialog, and restores focus to
 * whatever was focused right before the trap activated once it
 * deactivates or the component unmounts.
 *
 * The container itself needs `tabIndex={-1}` in the DOM so `.focus()` has
 * somewhere to land when the dialog happens to have no focusable
 * descendants yet (e.g. still loading).
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    function getFocusable(): HTMLElement[] {
      if (!container) return [];
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
    }

    const focusable = getFocusable();
    (focusable[0] ?? container).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const focusableNow = getFocusable();
      if (focusableNow.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusableNow[0];
      const last = focusableNow[focusableNow.length - 1];
      const current = document.activeElement;
      if (event.shiftKey) {
        if (current === first || !container!.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last || !container!.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus();
    };
  }, [active, containerRef]);
}
