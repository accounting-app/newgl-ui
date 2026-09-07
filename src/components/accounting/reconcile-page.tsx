"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { HelpCircle, Printer, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { ReconciliationRecord } from "@/lib/local-store/accounting-types";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import type { Account } from "@/modules/accounting/domain/models";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPlain(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ReconcileView = "reconcile" | "summary" | "history";

const VIEW_TITLE: Record<ReconcileView, string> = {
  reconcile: "Reconcile",
  summary: "Reconciliation summary",
  history: "History by account"
};

// The same breadcrumb/title-switcher shell wraps all three internal views
// (Reconcile / Reconciliation summary / History by account) -- they're one
// screen with three tabs, not three routes, matching the reference (the
// URL never changes between them there either).
function Breadcrumb({ current }: { current: string }) {
  return (
    <nav className="mb-1 flex items-center gap-1.5 text-sm text-[var(--color-text-primary)]">
      <Link href="/all-apps/chart-of-accounts" className="hover:text-[var(--color-link-action)] hover:underline">
        Chart of accounts
      </Link>
      <span aria-hidden="true">/</span>
      <Link href="/register" className="hover:text-[var(--color-link-action)] hover:underline">
        Bank register
      </Link>
      <span aria-hidden="true">/</span>
      <span className="text-[var(--color-text-primary)]">{current}</span>
    </nav>
  );
}

function ViewSwitcher({ view, onChange }: { view: ReconcileView; onChange: (view: ReconcileView) => void }) {
  const others = (["summary", "reconcile", "history"] as ReconcileView[]).filter((v) => v !== view);
  return (
    <div className="flex gap-2">
      {others.map((v) => (
        <Button key={v} variant="secondary" onClick={() => onChange(v)}>
          {VIEW_TITLE[v]}
        </Button>
      ))}
    </div>
  );
}

// Phase 1: records that a reconciliation happened (account, statement
// dates/balances) -- doesn't actually walk through matching individual
// transactions against a statement yet (that needs the real Register data
// wired in, Phase 1.5). See newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function ReconcilePage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  const reconcilableAccounts = useMemo(() => accounts.filter((a) => isRegisterAccountCategory(a.category)), [accounts]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const [userName, setUserName] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserName(data.user?.email ?? null));
  }, []);

  const recordsKey = activeCompany ? companyScopedKey(activeCompany.name, "reconciliations") : null;
  const { items: records, hydrated, add } = useLocalCollection<ReconciliationRecord>(recordsKey ?? "newgl:phase1:pending:reconciliations");
  const allRecordsSorted = useMemo(() => [...records].sort((a, b) => b.completedAt.localeCompare(a.completedAt)), [records]);

  const [view, setView] = useState<ReconcileView>("reconcile");

  const [accountId, setAccountId] = useState("");
  useEffect(() => {
    if (!accountId && reconcilableAccounts.length > 0) setAccountId(reconcilableAccounts[0].id);
  }, [reconcilableAccounts, accountId]);
  const selectedAccount = accounts.find((a) => a.id === accountId);

  const [statementEndingBalance, setStatementEndingBalance] = useState("");
  const [statementEndingDate, setStatementEndingDate] = useState("");
  const accountRecords = useMemo(
    () => records.filter((r) => r.accountId === accountId).sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
    [records, accountId]
  );
  const beginningBalance = accountRecords[0]?.statementEndingBalance ?? 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(statementEndingBalance);
    if (!accountId || !statementEndingDate || !Number.isFinite(parsed)) return;
    add({
      id: localId(),
      accountId,
      statementEndingDate,
      statementEndingBalance: parsed,
      beginningBalance,
      completedAt: new Date().toISOString()
    });
    toast({ variant: "success", title: "Reconciliation recorded" });
    setStatementEndingBalance("");
    setStatementEndingDate("");
    setView("summary");
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Breadcrumb current={VIEW_TITLE[view]} />
          <h1 className="flex items-center gap-1.5 text-2xl font-semibold text-[var(--color-text-global)]">
            {VIEW_TITLE[view]}
            <HelpCircle className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
          </h1>
        </div>
        <ViewSwitcher view={view} onChange={setView} />
      </div>

      {view === "reconcile" ? (
        reconcilableAccounts.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">No bank or credit card accounts yet.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <p className="mb-3 text-base text-[var(--color-text-global)]">Which account do you want to reconcile?</p>
              <div className="w-64">
                <Select
                  label="Account"
                  value={accountId}
                  onChange={setAccountId}
                  options={reconcilableAccounts.map((a) => ({ value: a.id, label: a.name }))}
                  placeholder="Select account"
                  allowCustomValue={false}
                />
              </div>
            </div>

            <div>
              <p className="mb-3 text-base text-[var(--color-text-global)]">Add the following information*</p>
              <div className="flex flex-wrap items-end gap-6">
                <div className="w-40">
                  <p className="mb-1 text-sm font-semibold text-[var(--color-text-global)]">Beginning balance</p>
                  <p className="flex h-9 items-center text-sm text-[var(--color-text-primary)]">{formatPlain(beginningBalance)}</p>
                </div>
                <div className="w-40">
                  <NumberField label="Statement ending balance" currency placeholder="0.00" value={statementEndingBalance} onChange={(e) => setStatementEndingBalance(e.target.value)} />
                </div>
                <div className="w-44">
                  <InputField label="Statement ending date" type="date" value={statementEndingDate} onChange={(e) => setStatementEndingDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Button type="submit" disabled={statementEndingBalance.trim() === "" || !statementEndingDate}>
                Start reconciling
              </Button>
            </div>
          </form>
        )
      ) : null}

      {view === "summary" ? (
        <div className="rounded-lg border border-[var(--color-divider-tertiary)]">
          <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-4 py-4 text-center">
            <div className="flex-1">
              <p className="text-lg text-[var(--color-text-global)]">{userName ?? activeCompany.name}</p>
              <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-primary)]">Reconciliation summary</p>
            </div>
            <div className="flex items-center gap-1">
              <IconButton icon={Printer} label="Print" size="sm" />
              <IconButton icon={Share} label="Export" size="sm" />
            </div>
          </div>
          <div className="tw-override overflow-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="header-table text-left uppercase tracking-wide">
                <tr>
                  <th className="px-2 pb-[5px] pt-2 text-left align-middle">Account</th>
                  <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Type</th>
                  <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Statement ending date</th>
                  <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Reconciled on</th>
                </tr>
              </thead>
              <tbody className="content-table">
                {!hydrated ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                      Loading…
                    </td>
                  </tr>
                ) : allRecordsSorted.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-[var(--color-text-primary)]">
                      Each time you reconcile this account, the reconciliation report is saved here. If you're ready to reconcile now, click the Reconcile tab.
                    </td>
                  </tr>
                ) : (
                  allRecordsSorted.map((record) => {
                    const account = accountById.get(record.accountId);
                    return (
                      <tr key={record.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                        <td className="p-2 align-top text-[13px] font-medium text-[var(--color-text-global)]">{account?.name ?? "Unknown account"}</td>
                        <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">
                          {account ? ACCOUNT_CATEGORY_LABELS[account.category] : "--"}
                        </td>
                        <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{record.statementEndingDate}</td>
                        <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">
                          {new Date(record.completedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {view === "history" ? (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-6">
            <div className="w-56">
              <Select
                label="Account"
                value={accountId}
                onChange={setAccountId}
                options={reconcilableAccounts.map((a) => ({ value: a.id, label: a.name }))}
                placeholder="Select account"
                allowCustomValue={false}
              />
            </div>
            <div className="w-56">
              <Select
                label="Report period"
                value="365"
                onChange={() => {}}
                options={[{ value: "365", label: "Since 365 Days Ago" }]}
                placeholder="Report period"
                allowCustomValue={false}
              />
            </div>
          </div>

          <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
            <table className="w-full min-w-[1000px] border-collapse text-sm">
              <thead className="header-table text-left uppercase tracking-wide">
                <tr>
                  <th className="px-2 pb-[5px] pt-2 text-left align-middle">Statement ending date</th>
                  <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Reconciled on</th>
                  <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Ending balance</th>
                  <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Changes</th>
                  <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Auto adjustment</th>
                  <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Statements</th>
                  <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
                </tr>
              </thead>
              <tbody className="content-table">
                {!hydrated ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                      Loading…
                    </td>
                  </tr>
                ) : accountRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-sm text-[var(--color-text-primary)]">
                      Each time you reconcile this account, the reconciliation report is saved here. If you're ready to reconcile now, click the Reconcile tab.
                    </td>
                  </tr>
                ) : (
                  accountRecords.map((record) => (
                    <tr key={record.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                      <td className="p-2 align-top text-[13px] text-[var(--color-text-primary)]">{record.statementEndingDate}</td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">
                        {new Date(record.completedAt).toLocaleDateString()}
                      </td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">
                        {formatMoney(record.statementEndingBalance)}
                      </td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">--</td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">--</td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">--</td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                        <button
                          type="button"
                          disabled
                          title="Detailed reconciliation reports aren't available yet"
                          className="cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)]"
                        >
                          View report
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
