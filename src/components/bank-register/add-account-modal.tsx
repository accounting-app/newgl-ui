"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { ACCOUNT_ROOT_GROUPS } from "@/modules/accounting/domain/accounting-reports";
import type { Account } from "@/modules/accounting/domain/models";

const CATEGORY_OPTIONS = ACCOUNT_ROOT_GROUPS.flatMap((group) =>
  [...group.categories].map((category) => ({ value: category, label: ACCOUNT_CATEGORY_LABELS[category] }))
);

type NewAccountInput = {
  name: string;
  category: Account["category"];
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
 * Fields match this app's actual account model (name + category + optional
 * opening balance) -- there's no separate "detail type" here the way QBO
 * has one, since accounts in this app are one flat category, not a
 * type/subtype pair.
 */
export function AddAccountModal({ open, onClose, onSave }: AddAccountModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<Account["category"]>("EXPENSE");
  const [openingBalance, setOpeningBalance] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setCategory("EXPENSE");
    setOpeningBalance("");
    setSaving(false);
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  if (!open) return null;

  async function handleSave() {
    if (!name.trim()) {
      setError("Account name is required.");
      return;
    }
    const parsedBalance = Number(openingBalance);
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        category,
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
          <Select
            label="Account type*"
            value={category}
            onChange={(value) => setCategory(value as Account["category"])}
            options={CATEGORY_OPTIONS}
            placeholder="Select account type"
            allowCustomValue={false}
          />
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
