"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { PendingBankTxn } from "@/lib/local-store/accounting-types";
import { listReconciliations } from "@/lib/services/reconciliation-service";
import type { Reconciliation } from "@/lib/services/reconciliation-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";
import { accountHasRegister } from "@/modules/accounting/presentation/transaction-type-policy";

type TypeGroup = "Bank" | "CC" | "Assets" | "Liabilities" | "Equity";
type ColumnKey = "lastRecDate" | "lastRecAmount" | "discrepancy" | "account" | "type" | "registerBalance" | "bankFeedsBalance" | "inBankFeeds" | "unreconciled" | "lastTxnDate";

type Row = {
  account: Account;
  type: TypeGroup;
  lastRec: Reconciliation | null;
  lastRecDate: string | null;
  lastRecAmount: number;
  discrepancy: number;
  registerBalance: number;
  pending: number;
  unreconciled: number;
  lastTxnDate: string | null;
};

const TYPE_OF: Record<Account["category"], TypeGroup> = {
  BANK: "Bank",
  CREDIT_CARD: "CC",
  ACCOUNTS_RECEIVABLE: "Assets",
  OTHER_CURRENT_ASSET: "Assets",
  FIXED_ASSET: "Assets",
  ACCOUNTS_PAYABLE: "Liabilities",
  OTHER_CURRENT_LIABILITY: "Liabilities",
  LONG_TERM_LIABILITY: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Equity",
  EXPENSE: "Equity",
  OTHER_INCOME: "Equity",
  OTHER_EXPENSE: "Equity"
};

const COLUMNS: { key: ColumnKey; label: string; locked?: boolean; align?: "right" }[] = [
  { key: "lastRecDate", label: "Last Rec Date" },
  { key: "lastRecAmount", label: "Last Rec Amount" },
  { key: "discrepancy", label: "Discrepancy" },
  { key: "account", label: "Account", locked: true },
  { key: "type", label: "Type" },
  { key: "registerBalance", label: "Register Balance" },
  { key: "bankFeedsBalance", label: "Bank Feeds Balance" },
  { key: "inBankFeeds", label: "In Bank Feeds" },
  { key: "unreconciled", label: "Unreconciled" },
  { key: "lastTxnDate", label: "Last Txn Date" }
];
// "Last Txn Date" is the column "Add Last Txn Date" brings in.
const DEFAULT_VISIBLE: ColumnKey[] = COLUMNS.filter((c) => c.key !== "lastTxnDate").map((c) => c.key);
const COLUMNS_KEY = "newgl:rec-dashboard-columns:v1";

const TYPE_OPTIONS = [
  { value: "", label: "All Accounts" },
  { value: "Bank", label: "Bank" },
  { value: "CC", label: "Credit Card" },
  { value: "Assets", label: "Assets" },
  { value: "Liabilities", label: "Liabilities" },
  { value: "Equity", label: "Equity" }
];

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const display = (iso: string | null) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}/${iso.slice(0, 4)}` : "");
const TH = "cursor-pointer select-none border-l border-[var(--color-table-divider)] px-2.5 py-0 text-left text-[13px] font-semibold uppercase leading-tight text-[var(--color-text-global)]";
const LINK = "text-[var(--color-link-action)] hover:underline";

// RightTool's Reconciliation Dashboard: every register account with its last
// reconciliation, discrepancy, balances and how many entries are still
// unreconciled, in one sortable table. Opens as a wide right-hand panel (the
// same pattern as the Expense form's side panels).
export function ReconciliationDashboardPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const services = useMemo(() => getServiceContainer(), []);
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  const pendingKey = activeCompany ? companyScopedKey(activeCompany.name, "pending-bank-txns") : "newgl:phase1:pending:pending-bank-txns";
  const { items: pendingTxns } = useLocalCollection<PendingBankTxn>(pendingKey);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);
  const [postingStats, setPostingStats] = useState<Map<string, { unreconciled: number; lastDate: string | null }>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState("");
  const [hideNever, setHideNever] = useState(false);
  const [hideZero, setHideZero] = useState(false);
  const [before, setBefore] = useState("");
  const [visible, setVisible] = useState<ColumnKey[]>(DEFAULT_VISIBLE);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [sort, setSort] = useState<{ key: ColumnKey; dir: "asc" | "desc" } | null>(null);
  const [menu, setMenu] = useState<{ row: Row; top: number; right: number } | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(COLUMNS_KEY) ?? "null");
      if (Array.isArray(stored)) setVisible(stored.filter((k): k is ColumnKey => COLUMNS.some((c) => c.key === k)));
    } catch {
      // storage unavailable: default columns
    }
  }, []);
  function saveVisible(next: ColumnKey[]) {
    setVisible(next);
    try {
      window.localStorage.setItem(COLUMNS_KEY, JSON.stringify(next));
    } catch {
      // not persisted
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accountList, recs, postings] = await Promise.all([services.accountService.listAccounts(), listReconciliations(), services.ledgerService.listPostings()]);
      const stats = new Map<string, { unreconciled: number; lastDate: string | null }>();
      for (const p of postings) {
        if (p.status !== "POSTED") continue;
        const entry = stats.get(p.accountId) ?? { unreconciled: 0, lastDate: null };
        if (p.reconciliationStatus !== "RECONCILED") entry.unreconciled += 1;
        if (!entry.lastDate || p.postingDate > entry.lastDate) entry.lastDate = p.postingDate;
        stats.set(p.accountId, entry);
      }
      setAccounts(accountList);
      setReconciliations(recs);
      setPostingStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the reconciliation dashboard");
    } finally {
      setLoading(false);
    }
  }, [services]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (menu) setMenu(null);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, menu]);

  useEffect(() => {
    if (!columnsOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [columnsOpen]);

  const rows = useMemo<Row[]>(() => {
    const latest = new Map<string, Reconciliation>();
    for (const r of reconciliations) {
      const current = latest.get(r.accountId);
      if (!current || r.statementEndingDate > current.statementEndingDate || (r.statementEndingDate === current.statementEndingDate && r.completedAt > current.completedAt)) latest.set(r.accountId, r);
    }
    return accounts
      .filter((a) => a.status !== "ARCHIVED" && accountHasRegister(a))
      .map((account) => {
        const lastRec = latest.get(account.id) ?? null;
        const stats = postingStats.get(account.id);
        return {
          account,
          type: TYPE_OF[account.category],
          lastRec,
          lastRecDate: lastRec?.statementEndingDate ?? null,
          lastRecAmount: lastRec?.statementEndingBalance ?? 0,
          discrepancy: lastRec?.discrepancyAdjustmentAmount ?? 0,
          registerBalance: account.currentBalance,
          pending: pendingTxns.filter((t) => t.accountId === account.id && t.status === "PENDING").length,
          unreconciled: stats?.unreconciled ?? 0,
          lastTxnDate: stats?.lastDate ?? null
        };
      });
  }, [accounts, reconciliations, postingStats, pendingTxns]);

  const shown = useMemo(() => {
    const filtered = rows.filter(
      (r) =>
        (typeFilter === "" || r.type === typeFilter) &&
        (!hideNever || r.lastRecDate !== null) &&
        (!hideZero || Math.abs(r.registerBalance) > 0.005) &&
        (!before || r.lastRecDate === null || r.lastRecDate < before)
    );
    if (!sort) return filtered;
    const value = (r: Row): string | number => {
      switch (sort.key) {
        case "lastRecDate": return r.lastRecDate ?? "";
        case "lastRecAmount": return r.lastRecAmount;
        case "discrepancy": return r.discrepancy;
        case "account": return r.account.name.toLowerCase();
        case "type": return r.type;
        case "registerBalance": return r.registerBalance;
        case "bankFeedsBalance": return 0;
        case "inBankFeeds": return r.pending;
        case "unreconciled": return r.unreconciled;
        case "lastTxnDate": return r.lastTxnDate ?? "";
      }
    };
    return [...filtered].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? order : -order;
    });
  }, [rows, typeFilter, hideNever, hideZero, before, sort]);

  const columns = COLUMNS.filter((c) => visible.includes(c.key) || c.locked);
  const lastTxnShown = visible.includes("lastTxnDate");

  function toggleSort(key: ColumnKey) {
    setSort((current) => (current?.key === key ? (current.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));
  }

  function cell(row: Row, key: ColumnKey) {
    switch (key) {
      case "lastRecDate":
        return row.lastRec ? <Link href={`/all-apps/reconcile/report/${row.lastRec.id}`} className={LINK}>{display(row.lastRecDate)}</Link> : "Never";
      case "lastRecAmount": return money(row.lastRecAmount);
      case "discrepancy": return money(row.discrepancy);
      case "account": return <Link href={`/register?accountId=${row.account.id}`} className={LINK}>{row.account.name}</Link>;
      case "type": return row.type;
      case "registerBalance": return money(row.registerBalance);
      case "bankFeedsBalance": return "Not Connected";
      case "inBankFeeds":
        return row.pending > 0 ? <Link href="/all-apps/bank-transactions" className={LINK}>{row.pending}</Link> : "N/A";
      case "unreconciled": return <Link href={`/register?accountId=${row.account.id}`} className={LINK}>{row.unreconciled}</Link>;
      case "lastTxnDate": return display(row.lastTxnDate);
    }
  }

  function exportCsv() {
    const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const text = (row: Row, key: ColumnKey): string => {
      switch (key) {
        case "lastRecDate": return row.lastRecDate ? display(row.lastRecDate) : "Never";
        case "lastRecAmount": return row.lastRecAmount.toFixed(2);
        case "discrepancy": return row.discrepancy.toFixed(2);
        case "account": return row.account.name;
        case "type": return row.type;
        case "registerBalance": return row.registerBalance.toFixed(2);
        case "bankFeedsBalance": return "Not Connected";
        case "inBankFeeds": return row.pending > 0 ? String(row.pending) : "N/A";
        case "unreconciled": return String(row.unreconciled);
        case "lastTxnDate": return display(row.lastTxnDate);
      }
    };
    const lines = [columns.map((c) => c.label), ...shown.map((r) => columns.map((c) => text(r, c.key)))];
    const url = URL.createObjectURL(new Blob([lines.map((l) => l.map(escape).join(",")).join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "reconciliation-dashboard.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/30">
      <button type="button" aria-label="Close dashboard" tabIndex={-1} className="h-full flex-1" onClick={onClose} />
      <aside role="dialog" aria-label="Reconciliation Dashboard" className="flex h-full w-[min(1650px,94vw)] flex-col overflow-hidden bg-[var(--color-container-background-primary)] px-8 pb-6 pt-6 shadow-2xl">
        <div className="relative text-center">
          <h2 className="text-lg font-semibold text-[var(--color-text-global)]">Reconciliation Dashboard</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="absolute right-0 top-0 -mt-1 rounded-md p-1.5 text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--color-ui-primary)]">
            <X className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex flex-wrap items-end gap-8">
            <div className="w-[190px]">
              <span className="mb-1 block text-sm font-semibold text-[var(--color-text-global)]">Select Account Type:</span>
              <Select value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} placeholder="All Accounts" allowCustomValue={false} optionSize="sm" />
            </div>
            <div className="flex flex-col gap-2 pb-1 text-sm font-semibold text-[var(--color-text-global)]">
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="qbo-checkbox" checked={hideNever} onChange={(e) => setHideNever(e.target.checked)} />Hide Accounts Never Reconciled</label>
              <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="qbo-checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />Hide $0 Register Accounts</label>
            </div>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <label htmlFor="rec-before" className="mb-1 block text-sm font-semibold text-[var(--color-text-global)]">Last Reconciled Before:</label>
              <input id="rec-before" type="date" value={before} onChange={(e) => setBefore(e.target.value)} className="h-9 rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-2 text-sm text-[var(--color-input-text)]" />
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-3">
                <Button className="!rounded-md" onClick={() => saveVisible(lastTxnShown ? visible.filter((k) => k !== "lastTxnDate") : [...visible, "lastTxnDate"])}>
                  {lastTxnShown ? "Remove Last Txn Date" : "Add Last Txn Date"}
                </Button>
                <div ref={columnsRef} className="relative">
                  <Button className="!rounded-md" onClick={() => setColumnsOpen((v) => !v)} aria-expanded={columnsOpen}>Column Options</Button>
                  {columnsOpen ? (
                    <div role="dialog" aria-label="Column options" className="absolute right-0 top-full z-20 mt-2 w-[240px] rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4 shadow-lg">
                      <ul className="space-y-3 text-sm text-[var(--color-text-global)]">
                        {COLUMNS.map((c) => (
                          <li key={c.key}>
                            <label className={`flex items-center gap-3 ${c.locked ? "opacity-60" : "cursor-pointer"}`}>
                              <input type="checkbox" className="qbo-checkbox" disabled={c.locked} checked={c.locked || visible.includes(c.key)} onChange={(e) => saveVisible(e.target.checked ? [...visible, c.key] : visible.filter((k) => k !== c.key))} />
                              {c.label}
                            </label>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <Button className="!rounded-md" onClick={exportCsv}>Export To CSV</Button>
              </div>
              <button type="button" onClick={() => { void load(); toast({ variant: "info", title: "Dashboard refreshed" }); }} className="text-base italic text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">Refresh</button>
            </div>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto border-t-2 border-[var(--color-table-divider-strong)] pt-4">
          {error ? <p className="py-6 text-center text-[var(--color-negative)]" role="alert">{error}</p> : loading && rows.length === 0 ? <p className="py-6 text-center">Loading...</p> : (
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--color-container-background-primary)]">
                <tr className="h-12 border-y border-[var(--color-table-divider-strong)]">
                  {columns.map((c) => (
                    <th key={c.key} className={TH} onClick={() => toggleSort(c.key)} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                      {c.label}
                      {sort?.key === c.key ? (sort.dir === "asc" ? <ArrowUp className="ml-1.5 inline h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="ml-1.5 inline h-3.5 w-3.5" aria-hidden="true" />) : <ArrowUpDown className="ml-1.5 inline h-3.5 w-3.5 opacity-50" aria-hidden="true" />}
                    </th>
                  ))}
                  <th className="w-[120px]" />
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={columns.length + 1} className="py-10 text-center text-[var(--color-text-primary)]">No accounts match these filters.</td></tr>
                ) : shown.map((row, index) => (
                  <tr key={row.account.id} className={`h-12 border-b border-[var(--color-table-divider)] text-[var(--color-text-global)] ${index % 2 === 0 ? "bg-[color-mix(in_srgb,var(--color-action-standard)_10%,var(--color-container-background-primary))]" : ""}`}>
                    {columns.map((c) => (
                      <td key={c.key} className={`border-l border-[var(--color-table-divider)] px-2.5 py-0 align-middle ${c.key === "account" ? "min-w-[200px]" : ""}`}>{cell(row, c.key)}</td>
                    ))}
                    <td className="px-2 py-0 text-right align-middle">
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-label={`Actions for ${row.account.name}`}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setMenu(menu?.row.account.id === row.account.id ? null : { row, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                        }}
                        className="inline-flex h-9 items-center gap-2 rounded-md bg-[var(--color-action-standard)] px-3 text-sm font-semibold text-white hover:brightness-90"
                      >
                        Actions
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </aside>

      {menu ? (
        <>
          <button type="button" aria-label="Close menu" tabIndex={-1} className="fixed inset-0 z-[85] cursor-default" onClick={() => setMenu(null)} />
          <ul role="menu" style={{ top: menu.top, right: menu.right }} className="fixed z-[90] w-56 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 text-sm shadow-lg">
            <li><Link role="menuitem" href={`/all-apps/reconcile?accountId=${menu.row.account.id}`} className="block px-4 py-2 text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Reconcile</Link></li>
            <li><Link role="menuitem" href={`/register?accountId=${menu.row.account.id}`} className="block px-4 py-2 text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">View register</Link></li>
            {menu.row.lastRec ? <li><Link role="menuitem" href={`/all-apps/reconcile/report/${menu.row.lastRec.id}`} className="block px-4 py-2 text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Last reconciliation report</Link></li> : null}
            <li><Link role="menuitem" href={`/all-apps/reconcile/discrepancies/${menu.row.account.id}`} className="block px-4 py-2 text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Discrepancy report</Link></li>
          </ul>
        </>
      ) : null}
    </div>
  );
}
