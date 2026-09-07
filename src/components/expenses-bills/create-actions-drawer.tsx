"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GripVertical, Search, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";

// No icon field -- the reference's Create actions pills and its Create
// actions drawer both render plain text labels, no per-action icon.
export type CreateAction = {
  id: string;
  label: string;
  href?: string;
  /** Real actions have an href; the rest are honestly disabled (no fake links). */
  disabledReason?: string;
  group: "top" | "vendors";
};

export const CREATE_ACTIONS: CreateAction[] = [
  { id: "upload-multiple-bills", label: "Upload multiple bills", href: "/all-apps/expenses-bills/bills", group: "top" },
  { id: "create-bill", label: "Create bill", href: "/all-apps/expenses-bills/bills", group: "top" },
  { id: "schedule-online-payment", label: "Schedule online payment", disabledReason: "No online bill-pay integration yet", group: "top" },
  { id: "pay-bills", label: "Pay bills", href: "/all-apps/expenses-bills/bills", group: "top" },
  { id: "record-expense", label: "Record expense", href: "/all-apps/expenses-bills/expense-transactions", group: "top" },
  { id: "add-vendor", label: "Add vendor", href: "/all-apps/expenses-bills/vendors", group: "vendors" },
  { id: "print-checks", label: "Print checks", disabledReason: "Not available yet", group: "vendors" },
  { id: "create-vendor-credit", label: "Create vendor credit", disabledReason: "Not available yet", group: "vendors" }
];

export const DEFAULT_FAVORITE_ACTION_IDS = ["upload-multiple-bills", "create-bill", "schedule-online-payment", "pay-bills", "record-expense"];
const MAX_FAVORITES = 10;

function actionById(id: string): CreateAction | undefined {
  return CREATE_ACTIONS.find((a) => a.id === id);
}

export function CreateActionsDrawer({
  favoriteIds,
  onSave,
  onClose
}: {
  favoriteIds: string[];
  onSave: (nextFavoriteIds: string[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(favoriteIds);
  const [search, setSearch] = useState("");
  const dragIndexRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const query = search.trim().toLowerCase();
  const matches = (action: CreateAction) => query === "" || action.label.toLowerCase().includes(query);

  function toggleFavorite(id: string) {
    setDraft((current) => (current.includes(id) ? current.filter((x) => x !== id) : current.length >= MAX_FAVORITES ? current : [...current, id]));
  }

  function reorder(fromIndex: number, toIndex: number) {
    setDraft((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  const vendorGroupActions = CREATE_ACTIONS.filter((a) => a.group === "vendors");

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div ref={panelRef} className="relative flex h-full w-[420px] max-w-full flex-col bg-[var(--color-container-background-primary)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-global)]">Create actions</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            <InputField placeholder="Search all Create actions" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          <p className="mb-1 text-sm text-[var(--color-text-primary)]">
            Choose your favorites. Pinned actions show up on the Expenses &amp; Bills overview page.
          </p>
          <p className="mb-4 text-sm text-[var(--color-text-primary)]">Select up to {MAX_FAVORITES}: {draft.length} selected</p>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Favorites</p>
          <div className="mb-5 flex flex-col gap-0.5">
            {draft.length === 0 ? (
              <p className="px-1 py-2 text-sm text-[var(--color-text-disabled)]">No favorites yet -- star an action below to pin it here.</p>
            ) : (
              draft
                .map((id, index) => ({ action: actionById(id), index }))
                .filter((entry): entry is { action: CreateAction; index: number } => entry.action !== undefined && matches(entry.action))
                .map(({ action, index }) => (
                  <div
                    key={action.id}
                    draggable
                    onDragStart={() => {
                      dragIndexRef.current = index;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndexRef.current === null || dragIndexRef.current === index) return;
                      reorder(dragIndexRef.current, index);
                      dragIndexRef.current = null;
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                  >
                    <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-[var(--color-icon-secondary)]" aria-hidden="true" />
                    <button type="button" onClick={() => toggleFavorite(action.id)} aria-label={`Remove ${action.label} from favorites`}>
                      <Star className="h-4 w-4 fill-[var(--color-warning-text)] text-[var(--color-warning-text)]" aria-hidden="true" />
                    </button>
                    {action.label}
                  </div>
                ))
            )}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Vendors</p>
          <div className="flex flex-col gap-0.5">
            {vendorGroupActions.filter(matches).map((action) => {
              const isFavorite = draft.includes(action.id);
              return (
                <div key={action.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">
                  <button
                    type="button"
                    onClick={() => toggleFavorite(action.id)}
                    disabled={!isFavorite && draft.length >= MAX_FAVORITES}
                    aria-label={isFavorite ? `Remove ${action.label} from favorites` : `Add ${action.label} to favorites`}
                    className="disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Star className={isFavorite ? "h-4 w-4 fill-[var(--color-warning-text)] text-[var(--color-warning-text)]" : "h-4 w-4 text-[var(--color-icon-secondary)]"} aria-hidden="true" />
                  </button>
                  {action.label}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-divider-tertiary)] px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)}>Save</Button>
        </div>
      </div>
    </div>
  );
}

export function CreateActionPill({ action }: { action: CreateAction }) {
  if (action.disabledReason) {
    return (
      <button
        type="button"
        disabled
        title={action.disabledReason}
        className="cursor-not-allowed whitespace-nowrap rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]"
      >
        {action.label}
      </button>
    );
  }
  return (
    <Link
      href={action.href ?? "#"}
      className="whitespace-nowrap rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)] hover:text-[var(--color-text-global)]"
    >
      {action.label}
    </Link>
  );
}
