"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { SelectField } from "@/components/bank-register/select-field";
import { SettingsCard } from "@/components/settings/settings-card";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { ACCOUNT_ROOT_GROUPS } from "@/modules/accounting/domain/accounting-reports";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

const CATEGORY_OPTIONS = ACCOUNT_ROOT_GROUPS.flatMap((group) =>
  [...group.categories].map((category) => ({ value: category, label: ACCOUNT_CATEGORY_LABELS[category] }))
);

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Next code in the shared incrementing sequence every seeded account already uses (1000, 1010, 1020, ...). */
function nextAccountCode(accounts: Account[]): string {
  const highest = accounts.reduce((max, account) => {
    const numeric = Number(account.code);
    return Number.isFinite(numeric) && numeric > max ? numeric : max;
  }, 990);
  return String(highest + 10);
}

export function ChartOfAccountsPage() {
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Account["category"]>("BANK");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [archivingId, setArchivingId] = useState<string | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<Account["category"]>("EXPENSE");
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  async function loadAccounts() {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await services.accountService.listAccounts();
      setAccounts(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load the chart of accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeAccounts = useMemo(() => accounts.filter((a) => a.status !== "ARCHIVED"), [accounts]);

  const sections = useMemo(
    () =>
      ACCOUNT_ROOT_GROUPS.map((group) => ({
        ...group,
        accounts: activeAccounts
          .filter((a) => group.categories.has(a.category))
          .sort((a, b) => a.name.localeCompare(b.name))
      })),
    [activeAccounts]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await services.accountService.createAccount({
        code: nextAccountCode(accounts),
        name: newName.trim(),
        category: newCategory,
        currency: "USD"
      });
      setNewName("");
      await loadAccounts();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create this account");
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(account: Account) {
    setArchivingId(account.id);
    try {
      await services.accountService.updateAccount(account.id, { status: "ARCHIVED" });
      await loadAccounts();
    } finally {
      setArchivingId(null);
    }
  }

  async function handleBulkImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = bulkText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (names.length === 0) return;

    setBulkImporting(true);
    setBulkResult(null);
    setBulkError(null);
    let created = 0;
    let nextCode = Number(nextAccountCode(accounts));
    const failures: string[] = [];

    for (const name of names) {
      try {
        await services.accountService.createAccount({
          code: String(nextCode),
          name,
          category: bulkCategory,
          currency: "USD"
        });
        nextCode += 10;
        created += 1;
      } catch (err) {
        failures.push(`${name}: ${err instanceof Error ? err.message : "failed"}`);
      }
    }

    await loadAccounts();
    setBulkImporting(false);
    setBulkResult(`Imported ${created} of ${names.length} account${names.length === 1 ? "" : "s"}.`);
    if (failures.length > 0) setBulkError(failures.join("\n"));
    if (failures.length === 0) {
      setBulkText("");
      setBulkOpen(false);
    }
  }

  return (
    <>
      <SettingsCard title="Add an account" description="Give it a friendly name — it's grouped under the category you pick.">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
            Account name
            <InputField
              type="text"
              placeholder="e.g. Chase Checking"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label className="flex w-56 flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
            Category
            <SelectField
              value={newCategory}
              onChange={(value) => setNewCategory(value as Account["category"])}
              options={CATEGORY_OPTIONS}
              placeholder="Category"
              allowCustomValue={false}
            />
          </label>
          <Button type="submit" disabled={creating || newName.trim() === ""}>
            {creating ? "Adding…" : "Add account"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setBulkOpen((open) => !open)}>
            {bulkOpen ? "Cancel bulk import" : "Bulk import"}
          </Button>
        </form>
        {createError ? <p className="mt-2 text-sm text-red-600">{createError}</p> : null}

        {bulkOpen ? (
          <form onSubmit={handleBulkImport} className="mt-4 flex flex-col gap-3 border-t border-[var(--color-divider-tertiary)] pt-4">
            <p className="text-sm text-[var(--color-text-primary)]">
              One account name per line. All imported accounts use the category below.
            </p>
            <label className="flex w-56 flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
              Category
              <SelectField
                value={bulkCategory}
                onChange={(value) => setBulkCategory(value as Account["category"])}
                options={CATEGORY_OPTIONS}
                placeholder="Category"
                allowCustomValue={false}
              />
            </label>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={5}
              placeholder={"Office Supplies\nSoftware Subscriptions\nTravel"}
              className="rounded border border-[var(--color-input-border-primary)] bg-[var(--color-container-background-primary)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
            <div>
              <Button type="submit" disabled={bulkImporting || bulkText.trim() === ""}>
                {bulkImporting ? "Importing…" : "Import accounts"}
              </Button>
            </div>
            {bulkResult ? <p className="text-sm text-[var(--color-text-primary)]">{bulkResult}</p> : null}
            {bulkError ? <p className="whitespace-pre-line text-sm text-red-600">{bulkError}</p> : null}
          </form>
        ) : null}
      </SettingsCard>

      <SettingsCard title="Chart of Accounts" description="Every active account, grouped by type. Click a balance to open its register.">
        {loading ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : (
          <div className="flex flex-col">
            {sections.map((section) =>
              section.accounts.length === 0 ? null : (
                <div key={section.key} className="border-b border-[var(--color-divider-tertiary)] py-3 last:border-b-0">
                  <p className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">{section.label}</p>
                  <ul className="flex flex-col divide-y divide-[var(--color-container-background-secondary)]">
                    {section.accounts.map((account) => (
                      <li key={account.id} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm text-[var(--color-text-global)]">{account.name}</p>
                          <p className="text-xs text-[var(--color-icon-secondary)]">
                            {ACCOUNT_CATEGORY_LABELS[account.category]}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          {isRegisterAccountCategory(account.category) ? (
                            <Link
                              href={`/register?account=${account.id}`}
                              className="text-sm text-[var(--color-link-text)] hover:underline"
                            >
                              {formatMoney(account.currentBalance)}
                            </Link>
                          ) : (
                            <span className="text-sm text-[var(--color-text-primary)]">
                              {formatMoney(account.currentBalance)}
                            </span>
                          )}
                          <Button
                            variant="secondary"
                            onClick={() => handleArchive(account)}
                            disabled={archivingId === account.id}
                          >
                            {archivingId === account.id ? "Archiving…" : "Archive"}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
        )}
      </SettingsCard>
    </>
  );
}
