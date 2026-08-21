"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Building2, ChevronDown, Plus, Trash2 } from "lucide-react";
import { InputField } from "@/components/ui/input-field";
import { useCompany } from "@/lib/company/company-provider";

// Sits in TopHeader, matching its existing dropdown pattern (avatar menu):
// a button that opens a small panel, closed on outside click.
type StartingPoint = "blank" | "template" | "duplicate";

export function CompanyPicker() {
  const { companies, templates, activeCompany, loading, isSwitching, switchCompany, createCompany, deleteCompany } =
    useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [startingPoint, setStartingPoint] = useState<StartingPoint>("blank");
  const [templateId, setTemplateId] = useState("");
  const [duplicateFromName, setDuplicateFromName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
        setDeletingName(null);
        setDeleteError(null);
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

  async function handleDelete(name: string) {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteCompany(name);
      setDeletingName(null);
      // A delete of the active company triggers a full page reload inside
      // deleteCompany -- nothing left to clean up here in that case.
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this company");
    } finally {
      setIsDeleting(false);
    }
  }

  function resetCreateForm() {
    setNewName("");
    setStartingPoint("blank");
    setTemplateId("");
    setDuplicateFromName("");
    setCreateError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setIsSaving(true);
    try {
      await createCompany({
        name: newName,
        templateId: startingPoint === "template" ? templateId : undefined,
        duplicateFromName: startingPoint === "duplicate" ? duplicateFromName : undefined
      });
      resetCreateForm();
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
          {companies.map((company) =>
            deletingName === company.name ? (
              <div key={company.name} className="flex flex-col gap-2 px-3 py-2">
                <p className="text-xs text-[var(--color-text-primary)]">
                  Delete <span className="font-medium">{company.name}</span>? This permanently removes its chart of
                  accounts and transactions and can&apos;t be undone.
                </p>
                {deleteError ? <p className="text-xs text-red-600">{deleteError}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(company.name)}
                    disabled={isDeleting}
                    className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingName(null);
                      setDeleteError(null);
                    }}
                    disabled={isDeleting}
                    className="rounded px-2 py-1 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={company.name} role="menuitem" className="group flex w-full items-center justify-between px-3 py-2 text-left text-sm">
                <button
                  type="button"
                  onClick={() => handleSwitch(company.name)}
                  className={`flex-1 text-left transition-colors ${
                    company.isActive ? "text-[var(--color-link-action)]" : "text-[var(--color-text-global)]"
                  }`}
                >
                  {company.name}
                </button>
                {company.isPrimary ? (
                  <span className="text-[11px] text-[var(--color-icon-secondary)]">Primary</span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Delete ${company.name}`}
                    onClick={() => {
                      setDeletingName(company.name);
                      setDeleteError(null);
                    }}
                    className="rounded p-1 text-[var(--color-icon-secondary)] opacity-0 transition-opacity hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-red-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )
          )}

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
                <label className="flex flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
                  Starting point
                  <select
                    value={startingPoint}
                    onChange={(event) => setStartingPoint(event.target.value as StartingPoint)}
                    className="input-field h-8 rounded px-2 text-xs text-[var(--color-text-primary)]"
                  >
                    <option value="blank">Blank</option>
                    <option value="template" disabled={templates.length === 0}>
                      Starter template
                    </option>
                    <option value="duplicate" disabled={companies.length === 0}>
                      Duplicate an existing company
                    </option>
                  </select>
                </label>
                {startingPoint === "template" ? (
                  <select
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                    className="input-field h-8 rounded px-2 text-xs text-[var(--color-text-primary)]"
                  >
                    <option value="">Select a template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id} title={template.description}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {startingPoint === "duplicate" ? (
                  <select
                    value={duplicateFromName}
                    onChange={(event) => setDuplicateFromName(event.target.value)}
                    className="input-field h-8 rounded px-2 text-xs text-[var(--color-text-primary)]"
                  >
                    <option value="">Select a company</option>
                    {companies.map((company) => (
                      <option key={company.name} value={company.name}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                {createError ? <p className="text-xs text-red-600">{createError}</p> : null}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={
                      isSaving ||
                      newName.trim() === "" ||
                      (startingPoint === "template" && templateId === "") ||
                      (startingPoint === "duplicate" && duplicateFromName === "")
                    }
                    className="rounded bg-[var(--color-link-action)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    {isSaving ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      resetCreateForm();
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
