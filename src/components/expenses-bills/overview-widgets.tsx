"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export type WidgetId = "bills-funnel" | "spend-over-time" | "spend-insights";

export const WIDGET_ORDER: WidgetId[] = ["bills-funnel", "spend-over-time", "spend-insights"];

export const WIDGET_LABELS: Record<WidgetId, string> = {
  "bills-funnel": "Bills funnel",
  "spend-over-time": "Spend over time",
  "spend-insights": "Spend insights"
};

// Wraps one dashboard widget. In edit mode it's a real drag target (native
// HTML5 DnD, no library) with a highlighted border -- the small corner/edge
// dots are purely a visual nod to the reference, and only shown because the
// card genuinely is draggable, not as a fake affordance.
export function WidgetShell({
  id,
  editMode,
  onDragStart,
  onDrop,
  children
}: {
  id: WidgetId;
  editMode: boolean;
  onDragStart: (id: WidgetId) => void;
  onDrop: (id: WidgetId) => void;
  children: ReactNode;
}) {
  return (
    <Card
      padding="lg"
      className={`relative mb-4 ${editMode ? "cursor-grab border-2 border-[var(--color-ui-primary)] active:cursor-grabbing" : ""}`}
      draggable={editMode}
      onDragStart={editMode ? () => onDragStart(id) : undefined}
      onDragOver={editMode ? (e) => e.preventDefault() : undefined}
      onDrop={editMode ? () => onDrop(id) : undefined}
    >
      {editMode ? (
        <>
          <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--color-ui-primary)]" aria-hidden="true" />
          <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[var(--color-ui-primary)]" aria-hidden="true" />
          <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--color-ui-primary)]" aria-hidden="true" />
          <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--color-ui-primary)]" aria-hidden="true" />
        </>
      ) : null}
      {children}
    </Card>
  );
}
