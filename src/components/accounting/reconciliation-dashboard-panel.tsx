"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown } from "lucide-react";
import { FullScreenFormShell } from "@/components/accounting/full-screen-form-shell";
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
type ColumnKey = "lastRecDate" | "lastRecAmount" | "discrepancy" | "account" | "type" | "registerBalance" | "bankFeedsBalance" | "inBankFeeds" | "unreconciled" | "lastTxnDate" | "accountNumber" | "detailType" | "lastRecBy" | "entriesReconciled";

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
  lastRecBy: string | null;
  entriesReconciled: number;
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

// `menu` is the name in the Column Options list when it differs from the table heading.
const COLUMNS: { key: ColumnKey; label: string; menu?: string; locked?: boolean }[] = [
  { key: "lastRecDate", label: "Last Rec Date" },
  { key: "lastRecAmount", label: "Last Rec Amount" },
  { key: "discrepancy", label: "Discrepancy" },
  { key: "account", label: "Account", locked: true },
  { key: "type", label: "Type" },
  { key: "registerBalance", label: "Register Balance" },
  { key: "bankFeedsBalance", label: "Bank Feeds Balance" },
  { key: "inBankFeeds", label: "In Bank Feeds" },
  { key: "unreconciled", label: "Unreconciled", menu: "Unreconciled Transactions" },
  { key: "lastTxnDate", label: "Last Txn Date" },
  { key: "accountNumber", label: "Account Number" },
  { key: "detailType", label: "Detail Type" },
  { key: "lastRecBy", label: "Last Rec By" },
  { key: "entriesReconciled", label: "Entries Reconciled" }
];
// Shown by default: RT's original columns. "Last Txn Date" is what "Add Last Txn Date" brings in; the rest are opt-in from Column Options.
const OPTIONAL_COLUMNS = new Set<ColumnKey>(["lastTxnDate", "accountNumber", "detailType", "lastRecBy", "entriesReconciled"]);
const DEFAULT_VISIBLE: ColumnKey[] = COLUMNS.filter((c) => !OPTIONAL_COLUMNS.has(c.key)).map((c) => c.key);
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
// Same table look as Bank transactions: accent header (46px), solid column dividers, 50px rows.
const TH = "cursor-pointer select-none border-l border-[var(--color-divider-tertiary)]";
const CELL = "border-l border-[var(--color-divider-tertiary)] px-[10px] py-0 align-middle text-sm leading-[21px]";
const RIGHT_COLUMNS = new Set<ColumnKey>(["lastRecAmount", "discrepancy", "registerBalance", "unreconciled", "entriesReconciled"]);
const RT_BUTTON = "rounded-md border border-[var(--color-negative)] px-3 py-1.5 text-sm text-[var(--color-negative)] hover:bg-[var(--color-action-passive-subtle-hover)]";
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
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
          lastTxnDate: stats?.lastDate ?? null,
          lastRecBy: lastRec?.reconciledBy ?? null,
          entriesReconciled: lastRec?.enteredCount ?? 0
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
        case "accountNumber": return r.account.code;
        case "detailType": return (r.account.subtype ?? "").toLowerCase();
        case "lastRecBy": return (r.lastRecBy ?? "").toLowerCase();
        case "entriesReconciled": return r.entriesReconciled;
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
      case "accountNumber": return row.account.code;
      case "detailType": return row.account.subtype ?? "";
      case "lastRecBy": return row.lastRecBy ?? "";
      case "entriesReconciled": return row.lastRec ? String(row.entriesReconciled) : "";
    }
  }

  // RightTool's export: uppercase headings, money as "$900.00", blanks where a
  // bank feed isn't connected, and a final TOTALS row. Respects the current
  // filters, sort and visible columns; downloads ReconciliationDashboard.csv.
  function exportCsv() {
    const csvField = (value: string) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
    const usd = (n: number) => `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const text = (row: Row, key: ColumnKey): string => {
      switch (key) {
        case "lastRecDate": return row.lastRecDate ? display(row.lastRecDate) : "Never";
        case "lastRecAmount": return usd(row.lastRecAmount);
        case "discrepancy": return usd(row.discrepancy);
        case "account": return row.account.name;
        case "type": return row.type;
        case "registerBalance": return usd(row.registerBalance);
        case "bankFeedsBalance": return ""; // "Not Connected" on screen, blank in the file
        case "inBankFeeds": return row.pending > 0 ? String(row.pending) : "";
        case "unreconciled": return String(row.unreconciled);
        case "lastTxnDate": return display(row.lastTxnDate);
        case "accountNumber": return row.account.code;
        case "detailType": return row.account.subtype ?? "";
        case "lastRecBy": return row.lastRecBy ?? "";
        case "entriesReconciled": return row.lastRec ? String(row.entriesReconciled) : "";
      }
    };
    const totals = (key: ColumnKey): string => {
      if (key === "discrepancy") return usd(shown.reduce((sum, r) => sum + r.discrepancy, 0));
      if (key === "inBankFeeds") return String(shown.reduce((sum, r) => sum + r.pending, 0));
      if (key === "unreconciled") return String(shown.reduce((sum, r) => sum + r.unreconciled, 0));
      return "";
    };
    const lines = [
      columns.map((c) => c.label.toUpperCase()),
      ...shown.map((r) => columns.map((c) => text(r, c.key))),
      columns.map((c, i) => (i === 0 ? "TOTALS" : totals(c.key)))
    ];
    const blob = new Blob([lines.map((l) => l.map(csvField).join(",")).join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ReconciliationDashboard.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast({ variant: "success", title: "ReconciliationDashboard.csv downloaded", description: `${shown.length} account${shown.length === 1 ? "" : "s"}` });
  }

  if (!open) return null;
  const footer = (
    <div className="flex items-center gap-6">
      <button type="button" onClick={onClose} className="text-base font-medium text-[var(--color-text-global)] hover:underline">Close</button>
      <button type="button" onClick={() => { void load(); toast({ variant: "info", title: "Dashboard refreshed" }); }} className="text-base font-medium text-[var(--color-text-global)] hover:underline">Refresh</button>
    </div>
  );
  return (
    <>
      <FullScreenFormShell title="Reconciliation Dashboard" onClose={onClose} footer={footer}>
        <div className="px-6 pb-8 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 pb-6">
            <div className="flex flex-wrap items-end gap-8">
              <div className="w-[230px]">
                <span className={LABEL}>Select Account Type</span>
                <Select value={typeFilter} onChange={setTypeFilter} options={TYPE_OPTIONS} placeholder="All Accounts" allowCustomValue={false} />
              </div>
              <div className="flex flex-col gap-2 pb-1 text-sm text-[var(--color-text-global)]">
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="qbo-checkbox" checked={hideNever} onChange={(e) => setHideNever(e.target.checked)} />Hide Accounts Never Reconciled</label>
                <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" className="qbo-checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />Hide $0 Register Accounts</label>
              </div>
              <div>
                <label htmlFor="rec-before" className={LABEL}>Last Reconciled Before</label>
                <input id="rec-before" type="date" value={before} onChange={(e) => setBefore(e.target.value)} className="h-[38px] w-[200px] rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-3 text-sm text-[var(--color-input-text)]" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={RT_BUTTON} onClick={() => saveVisible(lastTxnShown ? visible.filter((k) => k !== "lastTxnDate") : [...visible, "lastTxnDate"])}>
                {lastTxnShown ? "Remove Last Txn Date" : "Add Last Txn Date"}
              </button>
              <div ref={columnsRef} className="relative">
                <button type="button" className={RT_BUTTON} onClick={() => setColumnsOpen((v) => !v)} aria-expanded={columnsOpen}>Column Options</button>
                {columnsOpen ? (
                  <div role="dialog" aria-label="Column options" className="absolute right-0 top-full z-20 mt-2 max-h-[70vh] w-[270px] overflow-y-auto rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-4 pb-4 pt-3 shadow-lg">
                    <span aria-hidden="true" className="absolute -top-[7px] right-[22px] h-3 w-3 rotate-45 border-l border-t border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)]" />
                    <div className="flex items-center justify-between text-sm">
                      <p className="text-[var(--color-text-global)]">Columns</p>
                      <span className="flex items-center gap-3">
                        <button type="button" onClick={() => saveVisible(COLUMNS.map((c) => c.key))} className="text-[var(--color-link-action)] hover:underline">Show all</button>
                        <button type="button" onClick={() => saveVisible(DEFAULT_VISIBLE)} className="text-[var(--color-link-action)] hover:underline">Reset</button>
                      </span>
                    </div>
                    <ul className="mt-3 space-y-3 text-sm uppercase text-[var(--color-text-global)]">
                      {COLUMNS.map((c) => (
                        <li key={c.key}>
                          <label className={`flex items-center gap-3 ${c.locked ? "opacity-60" : "cursor-pointer"}`}>
                            <input type="checkbox" className="qbo-checkbox" disabled={c.locked} checked={c.locked || visible.includes(c.key)} onChange={(e) => saveVisible(e.target.checked ? [...visible, c.key] : visible.filter((k) => k !== c.key))} />
                            {c.menu ?? c.label}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <button type="button" className={RT_BUTTON} onClick={exportCsv}>Export To CSV</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)]">
            {error ? <p className="py-6 text-center text-[var(--color-negative)]" role="alert">{error}</p> : loading && rows.length === 0 ? <p className="py-6 text-center">Loading...</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-sm">
                  <thead className="bg-[var(--color-container-background-accent)] text-left text-[var(--color-text-global)]">
                    <tr className="[&>th]:h-[46px] [&>th]:whitespace-nowrap [&>th]:px-[10px] [&>th]:py-0 [&>th]:text-sm [&>th]:font-semibold">
                      {columns.map((c, i) => (
                        <th key={c.key} className={`${i === 0 ? "" : TH} ${RIGHT_COLUMNS.has(c.key) ? "text-right" : ""}`} onClick={() => toggleSort(c.key)} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                          {c.label}
                          {sort?.key === c.key ? (sort.dir === "asc" ? <ArrowUp className="ml-1.5 inline h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="ml-1.5 inline h-3.5 w-3.5" aria-hidden="true" />) : <ArrowUpDown className="ml-1.5 inline h-3.5 w-3.5 opacity-40" aria-hidden="true" />}
                        </th>
                      ))}
                      <th className="w-28 border-l-2 border-[var(--color-divider-tertiary)] text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.length === 0 ? (
                      <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-sm text-[var(--color-text-primary)]">No accounts match these filters.</td></tr>
                    ) : shown.map((row, index) => (
                      <tr key={row.account.id} className={`h-[50px] border-t border-[var(--color-divider-tertiary)] text-[var(--color-text-global)] hover:bg-[var(--color-table-row-hover)] ${index % 2 === 1 ? "bg-[var(--color-table-row-secondary)]" : ""}`}>
                        {columns.map((c, i) => (
                          <td key={c.key} className={`${CELL} ${i === 0 ? "border-l-0" : ""} ${RIGHT_COLUMNS.has(c.key) ? "text-right" : ""} ${c.key === "account" ? "min-w-[200px]" : ""}`}>{cell(row, c.key)}</td>
                        ))}
                        <td className="border-l-2 border-[var(--color-divider-tertiary)] px-[10px] py-0 text-right align-middle">
                          <button
                            type="button"
                            aria-haspopup="menu"
                            aria-label={`Actions for ${row.account.name}`}
                            onClick={(event) => {
                              const rect = event.currentTarget.getBoundingClientRect();
                              setMenu(menu?.row.account.id === row.account.id ? null : { row, top: rect.bottom + 4, right: window.innerWidth - rect.right });
                            }}
                            className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-link-action)] hover:underline"
                          >
                            Actions
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="border-t border-[var(--color-divider-tertiary)] px-4 py-3 text-right text-sm text-[var(--color-text-primary)]">
              {shown.length === 0 ? "0-0" : `1-${shown.length}`} of {shown.length} items
            </p>
          </div>
        </div>
      </FullScreenFormShell>

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
    </>
  );
}
