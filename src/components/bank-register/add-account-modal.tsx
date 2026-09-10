"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
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

type NewAccountInput = {
  name: string;
  category: Account["category"];
  subtype?: string;
  openingBalance?: number;
};

type AddAccountModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (input: NewAccountInput) => Promise<Account>;
};

/**
 * The Register's own "+ Add new" account picker -- same slideover shape as
 * PayeeSideModal (right-side panel over a dimmed backdrop), but real: it
 * calls all the way through to the same account-creation service Chart of
 * Accounts' own "New account" form uses (via useBankRegister's
 * createAccount), so an account added here shows up there too and vice
 * versa, rather than being a second, disconnected account list.
 *
 * Account type / Detail type match QuickBooks Online's own "New account"
 * form field-for-field (see account-detail-types.ts for the transcribed
 * taxonomy and its noted gaps) -- `subtype` already existed end-to-end on
 * our Account model/API, just unused by any UI until now.
 */
export function AddAccountModal({ open, onClose, onSave }: AddAccountModalProps) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountTypeKey | "">("");
  const [subtype, setSubtype] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailTypeOptions: SelectOption[] = accountType
    ? DETAIL_TYPES_BY_ACCOUNT_TYPE[accountType].map((detailType) => ({ value: detailType, label: detailType }))
    : [];

  function resetForm() {
    setName("");
    setAccountType("");
    setSubtype("");
    setOpeningBalance("");
    setSaving(false);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleAccountTypeChange(value: string) {
    setAccountType(value as AccountTypeKey);
    // A Detail type from the previous Account type would no longer be one
    // of this one's options -- same as QBO resetting it on this switch.
    setSubtype("");
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
    const parsedBalance = Number(openingBalance);
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
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
      <aside className="h-screen w-[420px] max-w-full overflow-y-auto bg-[var(--color-container-background-accent)] p-5 text-[var(--color-text-primary)] shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">New account</h2>
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Close
          </Button>
        </header>
        <p className="mb-4 text-xs text-[var(--color-icon-secondary)]">
          Give it a friendly name -- it&apos;s grouped under the account type you pick.
        </p>

        <div className="space-y-4">
          <InputField
            label="Account name*"
            placeholder="e.g. Office Supplies"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex gap-3">
            <div className="flex-1">
              <Select
                label="Account type*"
                value={accountType}
                onChange={handleAccountTypeChange}
                options={ACCOUNT_TYPE_OPTIONS}
                placeholder="Select account type"
                allowCustomValue={false}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Detail type*"
                value={subtype}
                onChange={setSubtype}
                options={detailTypeOptions}
                placeholder="Select detail type"
                allowCustomValue={false}
                disabled={!accountType}
              />
            </div>
          </div>
          <NumberField
            label="Opening balance (optional)"
            currency
            placeholder="0.00"
            value={openingBalance}
            onChange={(event) => setOpeningBalance(event.target.value)}
          />
        </div>

        {error ? <p className="mt-3 text-xs text-[var(--color-negative)]">{error}</p> : null}

        <footer className="mt-6 flex justify-end gap-2">
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
