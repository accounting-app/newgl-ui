"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Maximize2, MessageSquareText, MoreVertical, Printer, RefreshCw, Mail, StickyNote } from "lucide-react";
import { useToast } from "@/components/ui/toast/toast-context";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { useCustomers } from "@/lib/hooks/use-customers";
import { listInvoices } from "@/lib/services/invoices-service";
import type { Invoice } from "@/lib/services/invoices-service";
import { buildHierarchyRowsMulti, neededParentNames } from "@/lib/accounting/account-hierarchy";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, Transaction } from "@/modules/accounting/domain/models";
import { REPORT_PERIOD_OPTIONS, REPORT_USER_NAME } from "@/constants/ui";

type Method = "cash" | "accrual";
type Row = { name: string; amount: number };

const LINK = "text-[var(--color-link-action)]";
const INCOME = new Set(["INCOME"]);
const OTHER_INCOME = new Set(["OTHER_INCOME"]);
const EXPENSE = new Set(["EXPENSE"]);
const OTHER_EXPENSE = new Set(["OTHER_EXPENSE"]);

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangeFor(preset: string, today = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const day = new Date(y, m, today.getDate());
  const monday = day.getDay() === 0 ? -6 : 1 - day.getDay();
  switch (preset) {
    case "all_dates": return { from: "", to: "" };
    case "today": return { from: iso(day), to: iso(day) };
    case "yesterday": { const d = new Date(y, m, today.getDate() - 1); return { from: iso(d), to: iso(d) }; }
    case "this_week": return { from: iso(new Date(y, m, today.getDate() + monday)), to: iso(day) };
    case "last_week": return { from: iso(new Date(y, m, today.getDate() + monday - 7)), to: iso(new Date(y, m, today.getDate() + monday - 1)) };
    case "this_month": return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case "last_month": return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case "this_quarter": { const q = Math.floor(m / 3) * 3; return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) }; }
    case "last_quarter": { const q = Math.floor(m / 3) * 3 - 3; return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) }; }
    case "this_year": return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "last_year": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { from: `${y}-01-01`, to: iso(day) };
  }
}

function money(value: number, symbol = false): string {
  const text = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? "-" : ""}${symbol ? "$" : ""}${text}`;
}

function longDate(from: string, to: string): string {
  if (!from && !to) return "All Dates";
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const month = (d: Date) => d.toLocaleString("en-US", { month: "long" });
  if (from && to && f.getFullYear() === t.getFullYear()) {
    return f.getMonth() === t.getMonth() && f.getDate() === t.getDate()
      ? `${month(f)} ${f.getDate()}, ${f.getFullYear()}`
      : `${month(f)} ${f.getDate()}-${month(t)} ${t.getDate()}, ${t.getFullYear()}`;
  }
  return `${from ? `${month(f)} ${f.getDate()}, ${f.getFullYear()}` : ""}-${to ? `${month(t)} ${t.getDate()}, ${t.getFullYear()}` : ""}`;
}

// QBO's report builder (/report/builder?token=PANDL&title=...). Only the
// "Profit and Loss <name>" report exists today: the ledger P&L filtered to
// the transactions filed under one customer.
export function ReportBuilderPage() {
  const params = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const customers = useCustomers();
  const title = params.get("title") ?? "Profit And Loss";
  const nameId = params.get("nameId") ?? "";
  const customer = customers.items.find((c) => c.id === nameId);
  // QBO carries only the title; fall back to the name inside it.
  const payeeName = customer?.name ?? title.replace(/^Profit And Loss\s*/i, "").trim();

  const [preset, setPreset] = useState("this_year_to_date");
  const [{ from, to }, setRange] = useState(() => rangeFor("this_year_to_date"));
  const [method, setMethod] = useState<Method>("accrual");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<"actions" | "more" | null>(null);
  const [tick, setTick] = useState(0);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());

  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
    services.transactionService.listTransactions({ status: "POSTED" }).then(setTxns).catch(() => setTxns([]));
    listInvoices().then(setInvoices).catch(() => setInvoices([]));
    setGeneratedAt(new Date());
  }, [services, tick]);

  function pick(value: string) {
    setPreset(value);
    if (value !== "custom") setRange(rangeFor(value));
  }
  function stepYear(delta: number) {
    const base = from ? Number(from.slice(0, 4)) : new Date().getFullYear();
    setPreset("custom");
    setRange({ from: `${base + delta}-01-01`, to: `${base + delta}-12-31` });
  }

  const { sections, netIncome } = useMemo(() => {
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    // Cash basis only recognizes an invoice's income once it is paid.
    const unpaidInvoiceTxns = new Set(invoices.filter((i) => i.status !== "PAID" && i.postedTransactionId).map((i) => i.postedTransactionId as string));
    const maps = { income: new Map<string, number>(), otherIncome: new Map<string, number>(), expense: new Map<string, number>(), otherExpense: new Map<string, number>() };
    for (const t of txns) {
      if ((t.payee ?? "").trim().toLowerCase() !== payeeName.trim().toLowerCase()) continue;
      if (from && t.transactionDate < from) continue;
      if (to && t.transactionDate > to) continue;
      if (method === "cash" && unpaidInvoiceTxns.has(t.id)) continue;
      for (const p of t.postings) {
        const account = accountById.get(p.accountId);
        if (!account) continue;
        const impact = DEBIT_NORMAL_CATEGORIES.has(account.category) ? (p.type === "DEBIT" ? p.amount : -p.amount) : (p.type === "CREDIT" ? p.amount : -p.amount);
        const bucket = INCOME.has(account.category) ? maps.income : OTHER_INCOME.has(account.category) ? maps.otherIncome : EXPENSE.has(account.category) ? maps.expense : OTHER_EXPENSE.has(account.category) ? maps.otherExpense : null;
        if (bucket) bucket.set(account.name, (bucket.get(account.name) ?? 0) + impact);
      }
    }
    const real = new Set(accounts.map((a) => a.name));
    const toRows = (map: Map<string, number>): Row[] => {
      const parents = neededParentNames([...map.keys()], real);
      parents.forEach((n) => map.set(n, map.get(n) ?? 0));
      return [...map.entries()].map(([name, amount]) => ({ name, amount })).filter((r) => Math.abs(r.amount) > 0.0001 || parents.has(r.name)).sort((a, b) => a.name.localeCompare(b.name));
    };
    const income = toRows(maps.income);
    const otherIncome = toRows(maps.otherIncome);
    const expense = toRows(maps.expense);
    const otherExpense = toRows(maps.otherExpense);
    // Totals of a parent-with-children are the children's sum, so count leaves only.
    const leafSum = (rows: Row[]) => rows.filter((r) => !rows.some((o) => o.name.startsWith(`${r.name}:`))).reduce((s, r) => s + r.amount, 0);
    const t = { income: leafSum(income), otherIncome: leafSum(otherIncome), expense: leafSum(expense), otherExpense: leafSum(otherExpense) };
    const netOperating = t.income - t.expense;
    const netOther = t.otherIncome - t.otherExpense;
    return {
      sections: { income, otherIncome, expense, otherExpense, t, netOperating, netOther },
      netIncome: netOperating + netOther
    };
  }, [accounts, txns, invoices, payeeName, from, to, method]);

  const toggle = (key: string) => setClosed((c) => ({ ...c, [key]: !c[key] }));
  const empty = sections.income.length + sections.expense.length + sections.otherIncome.length + sections.otherExpense.length === 0;

  function exportCsv() {
    const lines: string[][] = [[REPORT_USER_NAME], [title], [longDate(from, to)], [], ["", "Total"]];
    const add = (label: string, rows: Row[], total: number) => {
      if (!rows.length) return;
      lines.push([label]);
      buildHierarchyRowsMulti([rows]).forEach((r) => lines.push(["  ".repeat(r.depth + 1) + r.label, r.amount.toFixed(2)]));
      lines.push([`Total ${label}`, total.toFixed(2)]);
    };
    add("Income", sections.income, sections.t.income);
    add("Expenses", sections.expense, sections.t.expense);
    add("Other Income", sections.otherIncome, sections.t.otherIncome);
    add("Other Expenses", sections.otherExpense, sections.t.otherExpense);
    lines.push(["Net Income", netIncome.toFixed(2)]);
    const csv = lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${title.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const soon = (what: string) => () => { setMenu(null); toast({ variant: "info", title: `${what} isn't available yet` }); };
  const iconBtn = "rounded p-1.5 text-[var(--color-icon-secondary)] hover:bg-[var(--color-container-background-secondary)]";

  function Block({ id, label, rows, total, totalLabel }: { id: string; label: string; rows: Row[]; total: number; totalLabel?: string }) {
    if (!rows.length) return null;
    const open = !closed[id];
    return (
      <>
        <tr className="cursor-pointer select-none bg-[var(--color-report-row-alt)]" onClick={() => toggle(id)}>
          <td className="px-2 py-1.5">
            <span className="flex items-center gap-1.5">{open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}{label}</span>
          </td>
          <td className="px-3 py-1.5 text-right">{open ? "" : money(total, true)}</td>
        </tr>
        {open && buildHierarchyRowsMulti([rows]).map((r) => (
          <tr key={r.fullName} className="border-b border-[var(--color-divider-tertiary)]">
            <td className="py-1.5 pr-2" style={{ paddingLeft: 24 + r.depth * 16 }}>{r.label}</td>
            <td className="px-3 py-1.5 text-right">{money(r.amount)}</td>
          </tr>
        ))}
        {open && (
          <tr className="border-y border-[var(--color-text-primary)] font-semibold">
            <td className="py-1.5 pl-6">{totalLabel ?? `Total ${label}`}</td>
            <td className="px-3 py-1.5 text-right">{money(total, true)}</td>
          </tr>
        )}
      </>
    );
  }
  const Total = ({ label, value, strong }: { label: string; value: number; strong?: boolean }) => (
    <tr className={`border-y border-[var(--color-text-primary)] bg-[var(--color-report-row-alt)] font-semibold ${strong ? "text-base" : ""}`}>
      <td className="px-2 py-1.5">{label}</td>
      <td className="px-3 py-1.5 text-right">{money(value, true)}</td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-[var(--color-container-background-primary)] pb-10 text-sm text-[var(--color-text-primary)] print:bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-divider-tertiary)] px-6 pb-4 pt-4 print:hidden">
        <div>
          <div className="mb-3 flex items-center gap-4">
            <Link href={nameId ? `/customerdetail?nameId=${nameId}` : "/reports"} className={`flex items-center gap-1 font-medium ${LINK}`}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />Back to reports
            </Link>
            <div className="flex items-center overflow-hidden rounded border border-[var(--color-input-border-primary)]">
              <button type="button" aria-label="Previous year" onClick={() => stepYear(-1)} className="px-3 py-1 hover:bg-[var(--color-container-background-secondary)]">«</button>
              <span className={`border-x border-[var(--color-input-border-primary)] px-6 py-1 ${LINK}`}>Year</span>
              <button type="button" aria-label="Next year" onClick={() => stepYear(1)} className="px-3 py-1 hover:bg-[var(--color-container-background-secondary)]">»</button>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs text-[var(--color-icon-secondary)]">Report period
              <select value={preset} onChange={(e) => pick(e.target.value)} className="mt-1 block h-10 w-48 rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-2 text-sm text-[var(--color-text-primary)]">
                {REPORT_PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="block text-xs text-[var(--color-icon-secondary)]">From
              <input type="date" value={from} onChange={(e) => { setPreset("custom"); setRange({ from: e.target.value, to }); }} className="mt-1 block h-10 rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-2 text-sm text-[var(--color-text-primary)]" />
            </label>
            <label className="block text-xs text-[var(--color-icon-secondary)]">To
              <input type="date" value={to} onChange={(e) => { setPreset("custom"); setRange({ from, to: e.target.value }); }} className="mt-1 block h-10 rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-2 text-sm text-[var(--color-text-primary)]" />
            </label>
            <div className="text-xs text-[var(--color-icon-secondary)]">Accounting method
              <div className="mt-1 flex h-10 overflow-hidden rounded border border-[var(--color-input-border-primary)]">
                {(["cash", "accrual"] as const).map((m) => (
                  <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} className={`px-4 text-sm capitalize ${method === m ? "bg-[var(--color-container-background-secondary)] text-[var(--color-text-primary)]" : "text-[var(--color-icon-secondary)]"}`}>{m}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-4">
          <button type="button" onClick={soon("Feedback")} className="flex items-center gap-2 hover:underline"><MessageSquareText className="h-4 w-4" aria-hidden="true" />Give feedback</button>
          <div className="relative flex items-center gap-5">
            <button type="button" onClick={soon("Run Presets")} className={LINK}>Run Presets</button>
            <button type="button" onClick={() => setMenu(menu === "actions" ? null : "actions")} className={`flex items-center gap-1 ${LINK}`}>Report Actions<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /></button>
            {menu === "actions" && (
              <div className="absolute right-24 top-8 z-10 w-48 rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <button type="button" onClick={() => { setMenu(null); exportCsv(); }} className="block w-full px-3 py-1.5 text-left hover:bg-[var(--color-container-background-secondary)]">Export to CSV</button>
                <button type="button" onClick={() => { setMenu(null); window.print(); }} className="block w-full px-3 py-1.5 text-left hover:bg-[var(--color-container-background-secondary)]">Print</button>
              </div>
            )}
            <button type="button" disabled title="Customizing reports isn't available yet" className="cursor-not-allowed rounded border border-[var(--color-text-primary)] px-4 py-2 opacity-60">Customize</button>
            <button type="button" disabled title="Saving reports isn't available yet" className="cursor-not-allowed rounded bg-[#0b4a3a] px-5 py-2 font-semibold text-white opacity-60">Save As</button>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-8 max-w-[1000px] rounded border border-[var(--color-divider-tertiary)] px-6 pb-6 pt-4 print:border-0">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--color-divider-tertiary)] pb-3 print:hidden">
          <span className="flex items-center gap-1">Compact | 100%<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /></span>
          <Link href="/reports/balance-sheet" className="font-semibold text-[#8f1111] hover:underline">Open Balance Sheet</Link>
          <div className="relative flex items-center gap-1">
            <button type="button" aria-label="Refresh" title="Refresh" onClick={() => setTick((n) => n + 1)} className={iconBtn}><RefreshCw className="h-4 w-4" /></button>
            <button type="button" aria-label="Expand all" title="Expand / collapse all" onClick={() => setClosed((c): Record<string, boolean> => (Object.values(c).some(Boolean) ? {} : { income: true, expense: true, otherIncome: true, otherExpense: true }))} className={iconBtn}><Maximize2 className="h-4 w-4" /></button>
            <button type="button" aria-label="Email" title="Email" onClick={soon("Emailing reports")} className={iconBtn}><Mail className="h-4 w-4" /></button>
            <button type="button" aria-label="Print" title="Print" onClick={() => window.print()} className={iconBtn}><Printer className="h-4 w-4" /></button>
            <button type="button" aria-label="Export" title="Export to CSV" onClick={exportCsv} className={iconBtn}><Download className="h-4 w-4" /></button>
            <button type="button" aria-label="More" onClick={() => setMenu(menu === "more" ? null : "more")} className={iconBtn}><MoreVertical className="h-4 w-4" /></button>
            {menu === "more" && (
              <div className="absolute right-0 top-9 z-10 w-56 rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <button type="button" onClick={soon("Scheduling reports")} className="block w-full px-3 py-1.5 text-left hover:bg-[var(--color-container-background-secondary)]">Schedule report</button>
                <button type="button" onClick={soon("Management reports")} className="block w-full px-3 py-1.5 text-left hover:bg-[var(--color-container-background-secondary)]">Add to Management reports</button>
              </div>
            )}
          </div>
        </div>

        <div className="mb-4 text-center">
          <h1 className="text-2xl font-semibold">{REPORT_USER_NAME}</h1>
          <p>{title}</p>
          <p className="font-medium">{longDate(from, to)}</p>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-[var(--color-divider-tertiary)]">
              <th className="w-3/4 py-2" />
              <th className="border-l border-[var(--color-divider-tertiary)] px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            <Block id="income" label="Income" rows={sections.income} total={sections.t.income} />
            {sections.income.length > 0 && <Total label="Gross Profit" value={sections.t.income} />}
            <Block id="expense" label="Expenses" rows={sections.expense} total={sections.t.expense} />
            {(sections.income.length > 0 || sections.expense.length > 0) && <Total label="Net Operating Income" value={sections.netOperating} />}
            <Block id="otherIncome" label="Other Income" rows={sections.otherIncome} total={sections.t.otherIncome} />
            <Block id="otherExpense" label="Other Expenses" rows={sections.otherExpense} total={sections.t.otherExpense} />
            {(sections.otherIncome.length > 0 || sections.otherExpense.length > 0) && <Total label="Net Other Income" value={sections.netOther} />}
            <Total label="Net Income" value={netIncome} strong />
          </tbody>
        </table>
        {empty && <p className="py-6 text-center text-[var(--color-icon-secondary)]">No transactions for {payeeName || "this customer"} in this period.</p>}

        <div className="mt-6 flex items-center gap-12 text-[var(--color-icon-secondary)]">
          <button type="button" onClick={soon("Notes")} className={`flex items-center gap-1.5 ${LINK} print:hidden`}><StickyNote className="h-4 w-4" aria-hidden="true" />Add note</button>
          <span>{method === "cash" ? "Cash" : "Accrual"} basis&nbsp;&nbsp;|&nbsp;&nbsp;{generatedAt.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        </div>
      </div>
    </div>
  );
}
