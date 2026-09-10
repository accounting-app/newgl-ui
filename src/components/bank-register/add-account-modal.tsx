"use client";

import { useMemo, useState } from "react";
import { Info, Lock, Unlock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { ACCOUNT_TYPE_BY_CATEGORY } from "@/lib/services/http-service-container";
import {
  ACCOUNT_TYPE_GROUPS,
  DETAIL_TYPES_BY_ACCOUNT_TYPE,
  categoryForAccountType,
  type AccountTypeKey
} from "@/constants/account-detail-types";
import type { Account } from "@/modules/accounting/domain/models";

const ACCOUNT_TYPE_OPTIONS: SelectOption[] = ACCOUNT_TYPE_GROUPS.flatMap((group) =>
  group.options.map((option) => ({ value: option.key, label: option.label, group: group.groupLabel }))
);

/** Which statement the "New account preview" panel is titled after -- same split QBO's own form uses. */
const STATEMENT_BY_CHART_TYPE: Record<string, "Balance Sheet" | "Profit & Loss"> = {
  ASSET: "Balance Sheet",
  LIABILITY: "Balance Sheet",
  EQUITY: "Balance Sheet",
  REVENUE: "Profit & Loss",
  EXPENSE: "Profit & Loss"
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatUsDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${m}/${d}/${y}` : iso;
}

type NewAccountInput = {
  name: string;
  category: Account["category"];
  subtype?: string;
  openingBalance?: number;
};

type AddAccountModalProps = {
  open: boolean;
  /** Full chart of accounts -- drives the subaccount parent picker and the live preview panel. */
  accounts: Account[];
  onClose: () => void;
  onSave: (input: NewAccountInput) => Promise<Account>;
};

/**
 * The Register's own "+ Add new" account picker. Laid out field-for-field
 * like QuickBooks Online's own "New account" side panel (Account name,
 * Account type / Detail type, Make this a subaccount, Opening balance /
 * As of, Description, Lock account, and the live statement preview) --
 * everything except QBO's "Video tutorials" link.
 *
 * Functionally wired for now: name, account type, detail type, opening
 * balance, and the subaccount parent (prefixes "Parent:" onto the name,
 * this app's existing subaccount convention). The As of date, Description,
 * and Lock account are shown to match QBO but don't persist yet -- see the
 * standing "functionality later" note; `subtype` already stores the Detail
 * type verbatim regardless.
 */
export function AddAccountModal({ open, accounts, onClose, onSave }: AddAccountModalProps) {
  const [name, setName] = useState("");
  // The preview list only picks up the typed name once the field is
  // committed (blur / Enter) -- matches QBO, which doesn't redraw the
  // statement preview on every keystroke.
  const [nameForPreview, setNameForPreview] = useState("");
  const [accountType, setAccountType] = useState<AccountTypeKey | "">("");
  const [subtype, setSubtype] = useState("");
  const [isSubaccount, setIsSubaccount] = useState(false);
  const [parentId, setParentId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [asOf, setAsOf] = useState(todayIso());
  const [description, setDescription] = useState("");
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = accountType ? categoryForAccountType(accountType) : null;

  const detailTypeOptions: SelectOption[] = accountType
    ? DETAIL_TYPES_BY_ACCOUNT_TYPE[accountType].map((detailType) => ({ value: detailType, label: detailType }))
    : [];

  const sameCategoryAccounts = useMemo(
    () => (category ? accounts.filter((a) => a.category === category && a.status === "ACTIVE") : []),
    [accounts, category]
  );

  const parentOptions: SelectOption[] = sameCategoryAccounts.map((a) => ({ value: a.id, label: a.name }));

  const statementTitle = category ? STATEMENT_BY_CHART_TYPE[ACCOUNT_TYPE_BY_CATEGORY[category]] : "Balance Sheet";

  const previewRows = useMemo(() => {
    const rows = sameCategoryAccounts.map((a) => ({ label: a.name, isNew: false }));
    // Only the typed account name creates a preview row -- picking a Detail
    // type must not add anything to the list.
    const pendingName = nameForPreview.trim();
    if (pendingName) rows.push({ label: pendingName, isNew: true });
    return rows.sort((a, b) => a.label.localeCompare(b.label));
  }, [sameCategoryAccounts, nameForPreview]);

  function resetForm() {
    setName("");
    setNameForPreview("");
    setAccountType("");
    setSubtype("");
    setIsSubaccount(false);
    setParentId("");
    setOpeningBalance("");
    setAsOf(todayIso());
    setDescription("");
    setLocked(false);
    setSaving(false);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleAccountTypeChange(value: string) {
    setAccountType(value as AccountTypeKey);
    // A Detail type / parent from the previous Account type wouldn't be one
    // of this one's options -- same reset QBO's own form does.
    setSubtype("");
    setParentId("");
  }

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) {
      setError("Account name is required.");
      return;
    }
    if (!accountType) {
      setError("Account type is required.");
      return;
    }
    if (!subtype) {
      setError("Detail type is required.");
      return;
    }
    if (isSubaccount && !parentId) {
      setError("Pick the parent account this is a subaccount of.");
      return;
    }
    const parent = accounts.find((a) => a.id === parentId);
    const finalName = isSubaccount && parent ? `${parent.name}:${name.trim()}` : name.trim();
    const parsedBalance = Number(openingBalance);
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: finalName,
        category: categoryForAccountType(accountType),
        subtype,
        openingBalance: openingBalance.trim() && Number.isFinite(parsedBalance) ? parsedBalance : undefined
      });
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create this account.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" aria-label="Close new account panel" onClick={handleClose} className="h-full flex-1 bg-black/40" />
      <aside className="flex h-screen w-[640px] max-w-full flex-col bg-[var(--color-container-background-primary)] text-[var(--color-text-primary)] shadow-2xl">
        <header className="relative border-b border-[var(--color-divider-tertiary)] px-6 py-4 text-center">
          <h2 className="text-lg font-semibold text-[var(--color-text-global)]">New account</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <InputField
              label="Account name*"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setNameForPreview(name)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setNameForPreview(name);
              }}
            />

            <div className="flex gap-3">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-1 text-xs text-[var(--color-icon-secondary)]">
                  <span>Account type*</span>
                  <Tooltip label="These are the major categories accounts fall under. You can see them in Reports as part of a balance sheet or profit & loss statement. Find out more">
                    <Info className="h-3.5 w-3.5 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                  </Tooltip>
                </div>
                <Select
                  value={accountType}
                  onChange={handleAccountTypeChange}
                  options={ACCOUNT_TYPE_OPTIONS}
                  placeholder="Select account type"
                  allowCustomValue={false}
                />
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-1 text-xs text-[var(--color-icon-secondary)]">
                  <span>Detail type*</span>
                </div>
                <Select
                    value={subtype}
                    onChange={setSubtype}
                    options={detailTypeOptions}
                    placeholder="Select detail type"
                    allowCustomValue={false}
                    disabled={!accountType}
                  />
              </div>
            </div>

            <div className="space-y-3">
              <Checkbox
                label="Make this a subaccount"
                checked={isSubaccount}
                onChange={(event) => setIsSubaccount(event.target.checked)}
              />
              {isSubaccount ? (
                <Select
                  label="Parent account"
                  value={parentId}
                  onChange={setParentId}
                  options={parentOptions}
                  placeholder={category ? "Select parent account" : "Pick an account type first"}
                  allowCustomValue={false}
                  disabled={!category || parentOptions.length === 0}
                />
              ) : null}
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-1 text-xs text-[var(--color-icon-secondary)]">
                  Opening balance
                  <Tooltip label="Your opening balance is the amount of money you opened this account with.">
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                  </Tooltip>
                </div>
                <NumberField currency placeholder="0.00" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} />
                <button type="button" className="mt-1 text-xs text-[var(--color-link-action)] hover:underline">
                  More info on opening balances
                </button>
              </div>
              <div className="flex-1">
                <InputField label="As of" type="date" value={asOf} onChange={(event) => setAsOf(event.target.value)} />
                <p className="mt-1 text-xs text-[var(--color-icon-secondary)]">
                  We&apos;ll start tracking from {formatUsDate(asOf)} onwards.
                </p>
              </div>
            </div>

            <InputField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} />
          </div>

          <hr className="my-5 border-[var(--color-divider-tertiary)]" />

          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-text-primary)] underline decoration-dotted underline-offset-4">Lock account</span>
            <div className="inline-flex rounded border border-[var(--color-input-border-primary)] bg-[var(--color-container-background-primary)] p-0.5">
              <button
                type="button"
                aria-label="Unlocked"
                aria-pressed={!locked}
                onClick={() => setLocked(false)}
                className={`rounded p-1.5 ${!locked ? "bg-[var(--color-action-passive-subtle-active)] text-[var(--color-text-global)]" : "text-[var(--color-icon-secondary)]"}`}
              >
                <Unlock className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Locked"
                aria-pressed={locked}
                onClick={() => setLocked(true)}
                className={`rounded p-1.5 ${locked ? "bg-[var(--color-action-passive-subtle-active)] text-[var(--color-text-global)]" : "text-[var(--color-icon-secondary)]"}`}
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <hr className="my-5 border-[var(--color-divider-tertiary)]" />

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-global)]">{statementTitle}</h3>
              <span className="rounded bg-[var(--color-link-action)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                New account preview
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-icon-secondary)]">Active accounts as of {formatUsDate(todayIso())}</p>
            <div className="mt-3 border-t border-[var(--color-divider-tertiary)] pt-3">
              {!category ? (
                <p className="pl-4 text-sm text-[var(--color-icon-secondary)]">Pick an account type to preview where this lands.</p>
              ) : previewRows.length === 0 ? (
                <p className="pl-4 text-sm text-[var(--color-icon-secondary)]">No accounts of this type yet.</p>
              ) : (
                <ul className="space-y-2">
                  {previewRows.map((row, index) => (
                    <li
                      key={`${row.label}-${index}`}
                      className={
                        row.isNew
                          ? "rounded-md border border-[var(--color-link-action)] bg-[rgba(0,95,158,0.08)] px-3 py-2 text-sm font-semibold text-[var(--color-link-action)]"
                          : "pl-4 text-sm text-[var(--color-text-primary)]"
                      }
                    >
                      {row.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error ? <p className="mt-4 text-xs text-[var(--color-negative)]">{error}</p> : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--color-divider-tertiary)] px-6 py-3">
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </footer>
      </aside>
    </div>
  );
}
