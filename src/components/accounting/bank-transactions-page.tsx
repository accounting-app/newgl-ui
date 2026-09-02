"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Landmark, MessageSquarePlus, Paperclip, Pencil, Plus, Printer, RefreshCw, Search, Settings, Share, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { PendingBankTxn, PendingTxnStatus } from "@/lib/local-store/accounting-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import type { Account } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TABS: { value: PendingTxnStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "POSTED", label: "Posted" },
  { value: "EXCLUDED", label: "Excluded" }
];

// Phase 1: a staging area for reviewing/categorizing transactions before
// they post -- local-only data, entirely separate from the real Register.
// Manual entry only (no real bank feed yet -- Phase 1.5), so there's no
// "Switch to previous version" link the way QBO's real feed migration
// does; everything else follows the reference layout closely. See
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function BankTransactionsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);

  const bankAccounts = useMemo(() => accounts.filter((a) => isRegisterAccountCategory(a.category)), [accounts]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  useEffect(() => {
    if (!selectedAccountId && bankAccounts.length > 0) setSelectedAccountId(bankAccounts[0].id);
  }, [bankAccounts, selectedAccountId]);
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const txnsKey = activeCompany ? companyScopedKey(activeCompany.name, "pending-bank-txns") : null;
  const { items: allTxns, hydrated, add, update, remove } = useLocalCollection<PendingBankTxn>(
    txnsKey ?? "newgl:phase1:pending:pending-bank-txns"
  );
  const accountTxns = useMemo(() => allTxns.filter((t) => t.accountId === selectedAccountId), [allTxns, selectedAccountId]);
  const pendingCountByAccount = useMemo(() => {
    const counts = new Map<string, number>();
    allTxns.forEach((t) => {
      if (t.status !== "PENDING") return;
      counts.set(t.accountId, (counts.get(t.accountId) ?? 0) + 1);
    });
    return counts;
  }, [allTxns]);
  const filteredBankAccounts = useMemo(
    () => bankAccounts.filter((a) => accountSearch.trim() === "" || a.name.toLowerCase().includes(accountSearch.trim().toLowerCase())),
    [bankAccounts, accountSearch]
  );

  const [tab, setTab] = useState<PendingTxnStatus>("PENDING");
  const [search, setSearch] = useState("");
  const filteredTxns = useMemo(
    () =>
      accountTxns
        .filter((t) => t.status === tab)
        .filter((t) => search.trim() === "" || t.description.toLowerCase().includes(search.trim().toLowerCase())),
    [accountTxns, tab, search]
  );
  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map(({ value }) => [value, accountTxns.filter((t) => t.status === value).length])),
    [accountTxns]
  );

  const postedTotal = useMemo(() => selectedAccount?.currentBalance ?? 0, [selectedAccount]);

  const expenseAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE" || a.category === "INCOME").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const vendorsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const { items: vendors } = useLocalCollection<{ id: string; name: string }>(vendorsKey ?? "newgl:phase1:pending:vendors");
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v.id, label: v.name })), [vendors]);
  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const [showAddForm, setShowAddForm] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [payeeId, setPayeeId] = useState("");
  const [direction, setDirection] = useState<"spent" | "received">("spent");
  const [amount, setAmount] = useState("");
  const addFormRef = useRef<HTMLDivElement>(null);

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(amount);
    if (!selectedAccountId || !description.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    add({
      id: localId(),
      accountId: selectedAccountId,
      date,
      description: description.trim(),
      payee: vendorOptions.find((v) => v.value === payeeId)?.label,
      spent: direction === "spent" ? parsed : undefined,
      received: direction === "received" ? parsed : undefined,
      status: "PENDING",
      createdAt: new Date().toISOString()
    });
    setDescription("");
    setPayeeId("");
    setAmount("");
    setShowAddForm(false);
    toast({ variant: "success", title: "Transaction added" });
  }

  function handlePost(txn: PendingBankTxn) {
    if (!txn.categoryAccountId) {
      toast({ variant: "error", title: "Select a category first" });
      return;
    }
    update(txn.id, { status: "POSTED" });
    toast({ variant: "success", title: "Marked posted", description: "Local-only for now -- this doesn't create a real transaction yet." });
  }

  function handleExclude(txn: PendingBankTxn) {
    update(txn.id, { status: "EXCLUDED" });
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (bankAccounts.length === 0) {
    return (
      <>
        <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text-global)]">Bank transactions</h1>
        <p className="text-sm text-[var(--color-text-disabled)]">
          No bank or credit card accounts yet. Add one from{" "}
          <Link href="/all-apps/chart-of-accounts" className="text-[var(--color-link-action)] hover:underline">
            Chart of Accounts
          </Link>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-[var(--color-text-global)]">Bank transactions</h1>

      {/* Account header row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAccountMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-lg px-1 py-1 text-lg font-semibold text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ui-primary)] text-white">
              <Landmark className="h-4 w-4" aria-hidden="true" />
            </span>
            {selectedAccount?.name ?? "Select account"}
            {accountMenuOpen ? (
              <ChevronUp className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            )}
          </button>
          {accountMenuOpen ? (
            <div className="absolute left-0 top-full z-20 mt-2 w-[560px] max-w-[90vw] rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-3 shadow-lg">
              <div className="relative mb-2">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  value={accountSearch}
                  onChange={(e) => setAccountSearch(e.target.value)}
                  placeholder="Search by account name"
                  className="h-10 w-full rounded-lg border-2 border-[var(--override-focus)] bg-[var(--color-input-background)] pl-9 pr-3 text-sm text-[var(--color-input-text)] outline-none placeholder:text-[var(--color-text-disabled)]"
                />
              </div>
              <button
                type="button"
                onClick={() => setAccountMenuOpen(false)}
                className="mb-1 px-1 text-sm font-medium text-[var(--color-link-action)] hover:underline"
              >
                Show account cards
              </button>
              <div className="max-h-72 overflow-y-auto">
                {filteredBankAccounts.length === 0 ? (
                  <p className="px-1 py-3 text-sm text-[var(--color-text-disabled)]">No accounts match "{accountSearch}".</p>
                ) : (
                  filteredBankAccounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccountId(a.id);
                        setAccountMenuOpen(false);
                        setAccountSearch("");
                      }}
                      className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-[var(--color-action-passive-subtle-hover)]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ui-primary)] text-white">
                        <Landmark className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--color-text-global)]">{a.name}</span>
                          <Link
                            href="/all-apps/chart-of-accounts"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Edit ${a.name} in Chart of Accounts`}
                            className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        </span>
                        <span className="block text-sm text-[var(--color-text-primary)]">Bank balance: {formatMoney(a.currentBalance)}</span>
                        <span className="block text-sm text-[var(--color-text-primary)]">
                          {pendingCountByAccount.get(a.id) ?? 0} pending transaction{(pendingCountByAccount.get(a.id) ?? 0) === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-link-action)] hover:underline">
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Give feedback
          </button>
          <div className="flex overflow-hidden rounded-lg">
            <Button className="rounded-r-none" disabled title="No bank feed integration yet">
              Link account
            </Button>
            <Button className="rounded-l-none border-l border-l-white/20 px-2" disabled aria-label="More options">
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Balance summary card */}
      <div className="mb-4 inline-block rounded-lg border-2 border-[var(--color-ui-primary)] bg-[var(--color-container-background-primary)] p-4">
        <div className="mb-2 flex items-center justify-between gap-6">
          <span className="text-sm text-[var(--color-text-primary)]">{selectedAccount?.name}</span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-icon-secondary)] text-[10px] font-semibold text-white">
            {tabCounts.PENDING}
          </span>
        </div>
        <p className="text-base font-semibold text-[var(--color-text-global)]">Bank: {formatMoney(0)}</p>
        <div className="mt-1 flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Posted: {formatMoney(postedTotal)}
        </div>
      </div>

      {/* Tabs + secondary links */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-lg bg-[var(--color-container-background-accent)] p-1">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === value ? "bg-[var(--color-container-background-primary)] text-[var(--color-text-global)] shadow-sm" : "text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
              }`}
            >
              {label} {tabCounts[value] ? `(${tabCounts[value]})` : ""}
            </button>
          ))}
        </div>
        <Link href="/register" className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
          Go to bank register
        </Link>
      </div>

      {/* Toolbar */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-48">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            <InputField placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowAddForm((v) => !v)}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            {showAddForm ? "Cancel" : "Add transaction"}
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--color-text-primary)]">{filteredTxns.length ? `1-${filteredTxns.length} of ${filteredTxns.length}` : "0 of 0"}</span>
          <IconButton icon={Printer} label="Print" size="sm" />
          <IconButton icon={Share} label="Export" size="sm" />
          <IconButton icon={Settings} label="Settings" size="sm" />
        </div>
      </div>

      {showAddForm ? (
        <div ref={addFormRef} className="mb-3 rounded-lg border border-[var(--color-divider-tertiary)] p-4">
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="w-36">
              <InputField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="min-w-[160px] flex-1">
              <InputField label="Description" placeholder="e.g. Printer Paper & Ink" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="w-40">
              <Select label="From/To" value={payeeId} onChange={setPayeeId} options={vendorOptions} placeholder="Select vendor" allowCustomValue={false} />
            </div>
            <div className="w-32">
              <Select value={direction} onChange={(v) => setDirection(v as "spent" | "received")} options={[{ value: "spent", label: "Spent" }, { value: "received", label: "Received" }]} placeholder="Type" allowCustomValue={false} />
            </div>
            <div className="w-32">
              <NumberField label="Amount" currency placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <Button type="submit" disabled={!description.trim() || amount.trim() === ""}>
              Add
            </Button>
          </form>
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[1100px] border-collapse text-sm">
          <thead className="bg-[var(--color-container-background-accent)]">
            <tr>
              <th className="w-10 px-3 py-2 text-left">
                <input type="checkbox" disabled />
              </th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">
                <span className="inline-flex items-center gap-1">Date <ChevronDown className="h-3 w-3" aria-hidden="true" /></span>
              </th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Bank description</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--color-text-primary)]">Spent</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--color-text-primary)]">Received</th>
              <th className="w-10 px-2 py-2" />
              <th className="w-10 px-2 py-2" />
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">From/To</th>
              <th className="px-3 py-2 text-left font-medium text-[var(--color-text-primary)]">Match/Categorize</th>
              <th className="px-3 py-2 text-right font-medium text-[var(--color-text-primary)]">Action</th>
            </tr>
          </thead>
          <tbody>
            {!hydrated ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : filteredTxns.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-sm text-[var(--color-text-disabled)]">
                  No {tab.toLowerCase()} transactions.
                </td>
              </tr>
            ) : (
              filteredTxns.map((txn) => (
                <tr key={txn.id} className="border-t border-[var(--color-container-background-secondary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" disabled />
                  </td>
                  <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{txn.date}</td>
                  <td className="px-3 py-2.5 text-[var(--color-text-primary)]">{txn.description}</td>
                  <td className="px-3 py-2.5 text-right text-[var(--color-text-global)]">{txn.spent ? formatMoney(txn.spent) : ""}</td>
                  <td className="px-3 py-2.5 text-right text-[var(--color-text-global)]">{txn.received ? formatMoney(txn.received) : ""}</td>
                  <td className="px-2 py-2.5 text-center">
                    <Paperclip className="mx-auto h-3.5 w-3.5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <MessageSquarePlus className="mx-auto h-3.5 w-3.5 text-[var(--color-icon-muted)]" aria-hidden="true" />
                  </td>
                  <td className="w-40 px-3 py-2.5">
                    {tab === "PENDING" ? (
                      <span className="text-[var(--color-text-disabled)]">{txn.payee || "Select vendor"}</span>
                    ) : (
                      <span className="text-[var(--color-text-primary)]">{txn.payee || "--"}</span>
                    )}
                  </td>
                  <td className="w-52 px-3 py-2.5">
                    {tab === "PENDING" ? (
                      <div className="flex items-center gap-1.5">
                        {!txn.categoryAccountId ? <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-[var(--color-warning-text)]" aria-hidden="true" /> : null}
                        <Select
                          value={txn.categoryAccountId ?? ""}
                          onChange={(value) => update(txn.id, { categoryAccountId: value || undefined })}
                          options={expenseAccountOptions}
                          placeholder="Select category"
                          allowCustomValue={false}
                          optionSize="sm"
                        />
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-primary)]">{txn.categoryAccountId ? accountNameById.get(txn.categoryAccountId) ?? "--" : "--"}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {tab === "PENDING" ? (
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => handlePost(txn)} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
                          Post
                        </button>
                        <button type="button" onClick={() => handleExclude(txn)} aria-label="More actions" className="text-[var(--color-icon-secondary)]">
                          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => remove(txn.id)} className="text-sm font-medium text-[var(--color-negative)] hover:underline">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
