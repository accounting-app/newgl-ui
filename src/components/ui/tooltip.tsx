import type { ReactNode } from "react";

type TooltipSide = "top" | "bottom";

type TooltipProps = {
  /** Text shown in the bubble. Wraps to multiple lines when long. */
  label: string;
  /** Which side of the trigger the bubble sits on. Defaults to "top". */
  side?: TooltipSide;
  children: ReactNode;
};

/**
 * Hover / focus tooltip: a small centered bubble with a pointer arrow,
 * sitting above (or below) its trigger. Shared across the app -- keep all
 * tooltip styling here rather than re-rolling it per call site.
 *
 * Short labels stay compact (`w-max`); long labels wrap at `max-w`
 * instead of stretching into a single unreadable line.
 */
export function Tooltip({ label, side = "top", children }: TooltipProps) {
  const isTop = side === "top";

  return (
    <span className="group/tooltip relative inline-flex items-center">
      {children}
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2",
          isTop ? "bottom-full mb-2" : "top-full mt-2",
          "w-max max-w-[240px] rounded-md border border-[var(--color-divider-tertiary)]",
          "bg-[var(--color-container-background-primary)] px-2.5 py-1.5",
          "text-center text-[11px] leading-snug text-[var(--color-text-primary)]",
          "opacity-0 shadow-lg transition-opacity duration-150",
          "group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100"
        ].join(" ")}
      >
        {label}
        <span
          aria-hidden="true"
          className={[
            "absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45",
            "border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)]",
            isTop
              ? "top-full -mt-1 border-b border-r"
              : "bottom-full -mb-1 border-l border-t"
          ].join(" ")}
        />
      </span>
    </span>
  );
}
