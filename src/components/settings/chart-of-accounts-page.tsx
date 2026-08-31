"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast/toast-context";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { ACCOUNT_ROOT_GROUPS } from "@/modules/accounting/domain/accounting-reports";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { buildRollupHierarchyRows, filterCollapsed } from "@/lib/accounting/account-hierarchy";
import type { HierarchyRow } from "@/lib/accounting/account-hierarchy";
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
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Account["category"]>("BANK");
  const [newOpeningBalance, setNewOpeningBalance] = useState("");
  const [creating, setCreating] = useState(false);

  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [collapsedNames, setCollapsedNames] = useState<Set<string>>(new Set());

  function toggleCollapse(fullName: string) {
    setCollapsedNames((current) => {
      const next = new Set(current);
      next.has(fullName) ? next.delete(fullName) : next.add(fullName);
      return next;
    });
  }

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCategory, setBulkCategory] = useState<Account["category"]>("EXPENSE");
  const [bulkText, setBulkText] = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);

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

  // Real hierarchy tree (colon-segment parents roll up their children's
  // balances), not a flat per-category list -- reuses the same helper the
  // P&L/Balance Sheet/Trial Balance reports already use. A parent segment
  // with no account of its own (e.g. "Travel" when only "Travel:Airfare"
  // and "Travel:Hotels" exist) is a synthetic rollup row: shown with its
  // children's summed balance, but no Archive button or register link,
  // since there's no real account behind it to act on.
  const sections = useMemo(
    () =>
      ACCOUNT_ROOT_GROUPS.map((group) => {
        const groupAccounts = activeAccounts.filter((a) => group.categories.has(a.category));
        const rows = buildRollupHierarchyRows(groupAccounts.map((a) => ({ name: a.name, amount: a.currentBalance })));
        const accountByName = new Map(groupAccounts.map((a) => [a.name, a]));
        return { ...group, rows, accountByName };
      }),
    [activeAccounts]
  );

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const openingBalance = Number(newOpeningBalance);
      await services.accountService.createAccount({
        code: nextAccountCode(accounts),
        name: newName.trim(),
        category: newCategory,
        currency: "USD",
        openingBalance: newOpeningBalance.trim() && Number.isFinite(openingBalance) ? openingBalance : undefined
      });
      setNewName("");
      setNewOpeningBalance("");
      await loadAccounts();
      toast({ variant: "success", title: "Account created", description: `"${newName.trim()}" was added to the chart of accounts.` });
    } catch (err) {
      toast({ variant: "error", title: "Could not create this account", description: err instanceof Error ? err.message : undefined });
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(account: Account) {
    setBusyAccountId(account.id);
    try {
      await services.accountService.updateAccount(account.id, { status: "ARCHIVED" });
      await loadAccounts();
      toast({ variant: "success", title: "Account archived", description: `"${account.name}" is no longer active.` });
    } catch (err) {
      toast({ variant: "error", title: "Could not archive this account", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyAccountId(null);
    }
  }

  async function handleDelete(account: Account) {
    setBusyAccountId(account.id);
    try {
      await services.accountService.deleteAccount(account.id);
      await loadAccounts();
      toast({ variant: "success", title: "Account deleted", description: `"${account.name}" was removed.` });
    } catch (err) {
      toast({ variant: "error", title: "Could not delete this account", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyAccountId(null);
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
    if (failures.length > 0) {
      toast({
        variant: "error",
        title: `Imported ${created} of ${names.length} account${names.length === 1 ? "" : "s"}`,
        description: failures.join("\n")
      });
    } else {
      toast({ variant: "success", title: `Imported ${created} account${created === 1 ? "" : "s"}` });
      setBulkText("");
      setBulkOpen(false);
    }
  }

  return (
    <>
      <Card title="Add an account" description="Give it a friendly name — it's grouped under the category you pick." className="mb-6">
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <InputField label="Account name" placeholder="e.g. Chase Checking" value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div className="w-56">
            <Select
              label="Category"
              value={newCategory}
              onChange={(value) => setNewCategory(value as Account["category"])}
              options={CATEGORY_OPTIONS}
              placeholder="Category"
              allowCustomValue={false}
            />
          </div>
          <div className="w-40">
            <NumberField
              label="Opening balance"
              currency
              placeholder="0.00"
              value={newOpeningBalance}
              onChange={(e) => setNewOpeningBalance(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={creating || newName.trim() === ""}>
            {creating ? "Adding…" : "Add account"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setBulkOpen((open) => !open)}>
            {bulkOpen ? "Cancel bulk import" : "Bulk import"}
          </Button>
        </form>

        {bulkOpen ? (
          <form onSubmit={handleBulkImport} className="mt-4 flex flex-col gap-3 border-t border-[var(--color-divider-tertiary)] pt-4">
            <p className="text-sm text-[var(--color-text-primary)]">
              One account name per line. All imported accounts use the category below.
            </p>
            <div className="w-56">
              <Select
                label="Category"
                value={bulkCategory}
                onChange={(value) => setBulkCategory(value as Account["category"])}
                options={CATEGORY_OPTIONS}
                placeholder="Category"
                allowCustomValue={false}
              />
            </div>
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              rows={5}
              placeholder={"Office Supplies\nSoftware Subscriptions\nTravel"}
            />
            <div>
              <Button type="submit" disabled={bulkImporting || bulkText.trim() === ""}>
                {bulkImporting ? "Importing…" : "Import accounts"}
              </Button>
            </div>
          </form>
        ) : null}
      </Card>

      <Card title="Chart of Accounts" description="Every active account, grouped by type. Click a balance to open its register.">
        {loading ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-[var(--color-negative)]">{loadError}</p>
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Account</Table.HeaderCell>
                <Table.HeaderCell align="right">Balance</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {sections.map((section) =>
                section.rows.length === 0 ? null : (
                  <SectionRows
                    key={section.key}
                    label={section.label}
                    rows={filterCollapsed(section.rows, collapsedNames)}
                    accountByName={section.accountByName}
                    collapsedNames={collapsedNames}
                    onToggleCollapse={toggleCollapse}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    busyAccountId={busyAccountId}
                  />
                )
              )}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </>
  );
}

function SectionRows({
  label,
  rows,
  accountByName,
  collapsedNames,
  onToggleCollapse,
  onArchive,
  onDelete,
  busyAccountId
}: {
  label: string;
  rows: HierarchyRow[];
  accountByName: Map<string, Account>;
  collapsedNames: Set<string>;
  onToggleCollapse: (fullName: string) => void;
  onArchive: (account: Account) => void;
  onDelete: (account: Account) => void;
  busyAccountId: string | null;
}) {
  return (
    <>
      <Table.Row className="hover:bg-transparent">
        <Table.Cell colSpan={3} className="bg-[var(--color-container-background-accent)] font-semibold text-[var(--color-text-primary)]">
          {label}
        </Table.Cell>
      </Table.Row>
      {rows.map((row) => {
        const account = accountByName.get(row.fullName);
        const isCollapsed = row.hasChildren && collapsedNames.has(row.fullName);
        return (
          <Table.Row key={row.fullName}>
            <Table.Cell>
              <div className="flex items-center gap-1.5" style={{ paddingLeft: `${row.depth * 1.25}rem` }}>
                {row.hasChildren ? (
                  <button
                    type="button"
                    onClick={() => onToggleCollapse(row.fullName)}
                    className="text-[var(--color-icon-secondary)]"
                    aria-label={isCollapsed ? "Expand" : "Collapse"}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  <span className="inline-block w-3.5" />
                )}
                <div>
                  <p className="text-sm text-[var(--color-text-global)]">{row.label}</p>
                  {account ? (
                    <p className="text-xs text-[var(--color-icon-secondary)]">{ACCOUNT_CATEGORY_LABELS[account.category]}</p>
                  ) : null}
                </div>
              </div>
            </Table.Cell>
            <Table.Cell align="right">
              {account && isRegisterAccountCategory(account.category) ? (
                <Link href={`/register?account=${account.id}`} className="text-sm text-[var(--color-link-text)] hover:underline">
                  {formatMoney(row.amount)}
                </Link>
              ) : (
                <span className="text-sm text-[var(--color-text-primary)]">{formatMoney(row.amount)}</span>
              )}
            </Table.Cell>
            <Table.Cell align="right">
              {account ? (
                <div className="flex justify-end gap-1.5">
                  <Button variant="secondary" size="sm" onClick={() => onArchive(account)} disabled={busyAccountId === account.id}>
                    {busyAccountId === account.id ? "Archiving…" : "Archive"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => onDelete(account)} disabled={busyAccountId === account.id}>
                    {busyAccountId === account.id ? "Deleting…" : "Delete"}
                  </Button>
                </div>
              ) : null}
            </Table.Cell>
          </Table.Row>
        );
      })}
    </>
  );
}
