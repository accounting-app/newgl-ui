"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { WidgetId } from "@/components/expenses-bills/overview-widgets";
import { WIDGET_LABELS, WIDGET_ORDER } from "@/components/expenses-bills/overview-widgets";

export function AddWidgetsDrawer({
  hiddenWidgetIds,
  onSave,
  onClose
}: {
  hiddenWidgetIds: WidgetId[];
  onSave: (nextHiddenIds: WidgetId[]) => void;
  onClose: () => void;
}) {
  const [draftHidden, setDraftHidden] = useState<WidgetId[]>(hiddenWidgetIds);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function toggle(id: WidgetId, checked: boolean) {
    setDraftHidden((current) => (checked ? current.filter((x) => x !== id) : [...current, id]));
  }
  function handleChange(id: WidgetId) {
    return (event: ChangeEvent<HTMLInputElement>) => toggle(id, event.target.checked);
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-[380px] max-w-full flex-col bg-[var(--color-container-background-primary)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-global)]">Add widgets</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-4 text-sm text-[var(--color-text-primary)]">Select widgets for your dashboard</p>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">All widgets</p>
          <div className="flex flex-col gap-2.5">
            {WIDGET_ORDER.map((id) => (
              <Checkbox key={id} id={`widget-${id}`} label={WIDGET_LABELS[id]} checked={!draftHidden.includes(id)} onChange={handleChange(id)} />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-divider-tertiary)] px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draftHidden)}>Save</Button>
        </div>
      </div>
    </div>
  );
}
