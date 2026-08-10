"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Building2, ChevronDown, Plus } from "lucide-react";
import { InputField } from "@/components/ui/input-field";
import { useCompany } from "@/lib/company/company-provider";

// Sits in TopHeader, matching its existing dropdown pattern (avatar menu):
// a button that opens a small panel, closed on outside click.
export function CompanyPicker() {
  const { companies, activeCompany, loading, isSwitching, switchCompany, createCompany } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  async function handleSwitch(name: string) {
    if (name === activeCompany?.name) {
      setIsOpen(false);
      return;
    }
    await switchCompany(name); // triggers a full page reload on success
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setIsSaving(true);
    try {
      await createCompany(newName);
      setNewName("");
      setIsCreating(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create this company");
    } finally {
      setIsSaving(false);
    }
  }

  if (loading || !activeCompany) {
    return null;
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--color-text-global)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)]"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        disabled={isSwitching}
      >
        <Building2 className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
        {isSwitching ? "Switching…" : activeCompany.name}
        <ChevronDown className="h-3.5 w-3.5 text-[var(--color-icon-secondary)]" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-10 mt-2 w-64 overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg"
        >
          {companies.map((company) => (
            <button
              key={company.name}
              type="button"
              role="menuitem"
              onClick={() => handleSwitch(company.name)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] ${
                company.isActive ? "text-[var(--color-link-action)]" : "text-[var(--color-text-global)]"
              }`}
            >
              <span>{company.name}</span>
              {company.isPrimary ? (
                <span className="text-[11px] text-[var(--color-icon-secondary)]">Primary</span>
              ) : null}
            </button>
          ))}

          <div className="mt-1 border-t border-[var(--color-divider-tertiary)] pt-1">
            {isCreating ? (
              <form onSubmit={handleCreate} className="flex flex-col gap-2 px-3 py-2">
                <InputField
                  autoFocus
                  type="text"
                  placeholder="Company name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
                {createError ? <p className="text-xs text-red-600">{createError}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={isSaving || newName.trim() === ""}
                    className="rounded bg-[var(--color-link-action)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {isSaving ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setCreateError(null);
                    }}
                    className="rounded px-2 py-1 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                role="menuitem"
                onClick={() => setIsCreating(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--color-text-global)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)]"
              >
                <Plus className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                New company
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
