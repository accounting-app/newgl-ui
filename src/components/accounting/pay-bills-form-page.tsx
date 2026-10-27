"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ListFilter, MessageSquareText, SlidersHorizontal, X } from "lucide-react";
import { FullScreenFormShell, leaveFormPage } from "@/components/accounting/full-screen-form-shell";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useVendors } from "@/lib/hooks/use-vendors";
import { listBills, payBill } from "@/lib/services/bills-service";
import type { Bill } from "@/lib/services/bills-service";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account } from "@/modules/accounting/domain/models";

const PAYMENT_CATEGORIES = new Set<Account["category"]>(["BANK", "CREDIT_CARD"]);
const CHECK_NEXT_KEY = "newgl:check-next:v1";
const LABEL = "mb-1 block text-sm text-[var(--color-text-primary)]";
const TH = "px-3 py-4 text-xs font-semibold uppercase text-[var(--color-text-global)]";

const cents = (value: number) => Math.round(value * 100);
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const iso = (d: Date) => d.toLocaleDateString("en-CA");
const display = (isoDate: string) => new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-US");

const DUE_RANGES = [
  { value: "12m", label: "Last 12 months" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All dates" }
];
function dueRange(value: string): { from: string; to: string } {
  const now = new Date();
  if (value === "month") return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  if (value === "year") return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  if (value === "all") return { from: "", to: "" };
  return { from: iso(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())), to: iso(now) };
}

// QBO's full-screen Pay Bills (/paybills?rtAccountId=...&rt=close). rtAccountId
// is the account the bills are paid from. Each ticked bill is paid in full (the
// ledger has no partial payments): its AP is cleared against the account.
export function PayBillsFormPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const { items: vendors } = useVendors();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [accountId, setAccountId] = useState(params.get("rtAccountId") ?? "");
  const [date, setDate] = useState(() => iso(new Date()));
  const [startNo, setStartNo] = useState("1");
  const [printLater, setPrintLater] = useState(false);
  const [range, setRange] = useState("12m");
  const [payeeFilter, setPayeeFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const reload = () => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
    listBills().then(setBills).catch(() => setBills([]));
  };
  useEffect(reload, [services]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(CHECK_NEXT_KEY));
      if (Number.isInteger(stored) && stored > 0) setStartNo(String(stored));
    } catch {
      // storage unavailable: start at 1
    }
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const payAccounts = useMemo(() => accounts.filter((a) => a.status === "ACTIVE" && PAYMENT_CATEGORIES.has(a.category)).sort((a, b) => a.name.localeCompare(b.name)), [accounts]);
  const account = accounts.find((a) => a.id === accountId);
  useEffect(() => {
    if (accounts.length === 0 || account) return;
    if (payAccounts[0]) setAccountId(payAccounts[0].id);
  }, [accounts, account, payAccounts]);
  const accountOptions = useMemo(() => payAccounts.map((a) => ({ value: a.id, label: a.name })), [payAccounts]);
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? "";
  const payeeOptions = useMemo(() => [{ value: "", label: "All payees" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))], [vendors]);

  const today = iso(new Date());
  const { from, to } = dueRange(range);
  const rows = useMemo(
    () => bills.filter((b) => b.status === "OPEN" && (!from || b.dueDate >= from) && (!to || b.dueDate <= to) && (!payeeFilter || b.vendorId === payeeFilter)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [bills, from, to, payeeFilter]
  );
  const chosen = rows.filter((b) => picked.has(b.id));
  const totalCents = chosen.reduce((sum, b) => sum + cents(b.amount), 0);
  const openTotal = rows.reduce((sum, b) => sum + b.amount, 0);
  const allPicked = rows.length > 0 && rows.every((b) => picked.has(b.id));

  const closePage = () => leaveFormPage(router);
  const toggle = (id: string) => setPicked((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const status = (b: Bill) => (b.dueDate < today ? `Overdue ${Math.round((Date.parse(today) - Date.parse(b.dueDate)) / 86400000)} days` : b.dueDate === today ? "Due today" : `Due in ${Math.round((Date.parse(b.dueDate) - Date.parse(today)) / 86400000)} days`);

  async function save(after: "stay" | "close") {
    setMenuOpen(false);
    if (!account) return setError("Choose the payment account.");
    if (chosen.length === 0) return setError("Tick at least one bill to pay.");
    setSaving(true);
    setError(null);
    try {
      for (const bill of chosen) await payBill(bill.id, { paymentAccountId: account.id, paymentDate: date });
      if (!printLater) {
        const following = String((Number(startNo) || 0) + chosen.length);
        setStartNo(following);
        try {
          window.localStorage.setItem(CHECK_NEXT_KEY, following);
        } catch {
          // not persisted
        }
      }
      toast({ variant: "success", title: chosen.length === 1 ? "Bill paid" : `${chosen.length} bills paid` });
      setPicked(new Set());
      if (after === "close") closePage();
      else reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pay these bills.");
      reload();
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <>
      <button type="button" onClick={closePage} className="text-base font-medium text-[var(--color-text-global)] hover:underline">Cancel</button>
      <button type="button" onClick={() => window.print()} className="text-base font-medium text-[var(--color-text-global)] hover:underline">Print</button>
      <div className="flex items-center gap-3">
        <Button variant="secondary" className="!rounded-md" disabled={saving} onClick={() => void save("stay")}>Save</Button>
        <div ref={menuRef} className="relative inline-flex">
          <Button className="!rounded-l-md !rounded-r-none" disabled={saving} onClick={() => void save("close")}>{saving ? "Saving..." : "Save and close"}</Button>
          <Button className="!rounded-l-none !rounded-r-md border-l border-l-white/30 !min-w-0 px-2" aria-label="More save options" disabled={saving} onClick={() => setMenuOpen((v) => !v)}>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
          {menuOpen ? (
            <div className="absolute bottom-full right-0 mb-1 w-40 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
              <button type="button" onClick={() => void save("stay")} className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]">Save and new</button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );

  return (
    <FullScreenFormShell title="Pay Bills" onClose={closePage} footer={footer}>
      <div className="px-6 pb-8 pt-5">
        <section className="rounded-lg bg-[var(--color-container-background-secondary)] px-6 py-5">
          <div className="flex justify-end">
            <button type="button" onClick={() => toast({ variant: "info", title: "Feedback isn't available yet" })} className="flex items-center gap-2 font-medium text-[var(--color-link-action)] hover:underline"><MessageSquareText className="h-5 w-5" aria-hidden="true" />Give feedback</button>
          </div>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-[270px]">
                <span className={LABEL}>Payment account</span>
                <Select value={accountId} onChange={setAccountId} options={accountOptions} placeholder="Select account" allowCustomValue={false} />
                {account ? <p className="mt-3 text-sm"><strong className="text-[var(--color-text-global)]">Balance:</strong> {money(account.currentBalance)}</p> : null}
              </div>
              <div>
                <label className={LABEL} htmlFor="pb-date">Payment date</label>
                <InputField id="pb-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-[240px]" />
              </div>
              <div>
                <label className={LABEL} htmlFor="pb-no">Starting check no.</label>
                <InputField id="pb-no" value={startNo} disabled={printLater} onChange={(event) => setStartNo(event.target.value)} className="w-[240px]" />
              </div>
              <label className="mt-8 flex cursor-pointer items-center gap-3"><input type="checkbox" checked={printLater} onChange={(event) => setPrintLater(event.target.checked)} className="h-5 w-5 cursor-pointer rounded accent-[var(--color-ui-primary)]" />Print later</label>
            </div>
            <div className="text-right">
              <p className="text-sm uppercase text-[var(--color-text-global)]">Total payment amount</p>
              <p className="text-5xl text-[var(--color-text-global)]">{money(totalCents / 100)}</p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-6">
            <div className="w-[280px]">
              <span className={LABEL}>Due Date</span>
              <Select value={range} onChange={setRange} options={DUE_RANGES} placeholder="" allowCustomValue={false} />
            </div>
            <div className="relative">
              <button type="button" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} className="flex h-10 items-center gap-2 text-lg text-[var(--color-text-global)] hover:underline"><ListFilter className="h-5 w-5" aria-hidden="true" />Filters</button>
              {filtersOpen ? (
                <div className="absolute left-0 top-full z-20 mt-2 w-[280px] rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4 shadow-lg">
                  <span className={LABEL}>Payee</span>
                  <Select value={payeeFilter} onChange={setPayeeFilter} options={payeeOptions} placeholder="All payees" allowCustomValue={false} />
                </div>
              ) : null}
            </div>
          </div>
          <button type="button" disabled title="Customizing columns isn't available yet" className="flex cursor-not-allowed items-center gap-2 text-lg opacity-60"><SlidersHorizontal className="h-5 w-5" aria-hidden="true" />Customize</button>
        </div>
        {range !== "all" ? (
          <p className="mt-4 inline-flex items-center gap-3 rounded-full bg-[var(--color-container-background-secondary)] px-4 py-2 text-sm text-[var(--color-text-global)]">
            Due Date: {display(from)}-{display(to)}
            <button type="button" aria-label="Clear the due date filter" onClick={() => setRange("all")}><X className="h-4 w-4" aria-hidden="true" /></button>
          </p>
        ) : null}

        <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[1150px] table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left">
              <th className="w-12 px-3 py-4"><input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(rows.map((b) => b.id)))} aria-label="Select all bills" className="h-5 w-5 cursor-pointer accent-[var(--color-ui-primary)]" /></th>
              <th className={TH}>Payee</th>
              <th className={`${TH} w-[9%]`}>Ref no.</th>
              <th className={`${TH} w-[11%]`}>Due date ↑</th>
              <th className={`${TH} w-[15%]`}>Status</th>
              <th className={`${TH} w-[10%] text-right`}>Bill approval</th>
              <th className={`${TH} w-[11%] text-right`}>Open balance</th>
              <th className={`${TH} w-[10%] text-right`}>Credit applied</th>
              <th className={`${TH} w-[9%] text-right`}>Payment</th>
              <th className={`${TH} w-[10%] text-right`}>Total amount</th>
              <th className={`${TH} w-[7%] text-right`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={11} className="py-14 text-center"><p className="text-2xl font-semibold text-[var(--color-text-global)]">No results found</p><p className="mt-1">Remove some filters or try a different search</p></td></tr>
            ) : rows.map((b) => (
              <tr key={b.id} className="border-b border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                <td className="px-3 py-3"><input type="checkbox" checked={picked.has(b.id)} onChange={() => toggle(b.id)} aria-label={`Pay ${vendorName(b.vendorId)} bill ${b.billNumber ?? ""}`} className="h-5 w-5 cursor-pointer accent-[var(--color-ui-primary)]" /></td>
                <td className="truncate px-3 py-3">{vendorName(b.vendorId)}</td>
                <td className="truncate px-3 py-3">{b.billNumber ?? ""}</td>
                <td className="px-3 py-3">{display(b.dueDate)}</td>
                <td className={`px-3 py-3 ${b.dueDate < today ? "text-[var(--color-negative)]" : ""}`}>{status(b)}</td>
                <td className="px-3 py-3 text-right">—</td>
                <td className="px-3 py-3 text-right">{money(b.amount)}</td>
                <td className="px-3 py-3 text-right">{money(0)}</td>
                <td className="px-3 py-3 text-right">{picked.has(b.id) ? money(b.amount) : ""}</td>
                <td className="px-3 py-3 text-right">{money(b.amount)}</td>
                <td className="px-3 py-3 text-right"><button type="button" onClick={() => toggle(b.id)} className="text-[var(--color-link-action)] hover:underline">{picked.has(b.id) ? "Unselect" : "Select"}</button></td>
              </tr>
            ))}
            <tr className="border-y-2 border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-secondary)] font-semibold text-[var(--color-text-global)]">
              <td />
              <td colSpan={5} className="px-3 py-3">Total payment</td>
              <td className="px-3 py-3 text-right">{money(openTotal)}</td>
              <td className="px-3 py-3 text-right">{money(0)}</td>
              <td className="px-3 py-3 text-right">{money(totalCents / 100)}</td>
              <td className="px-3 py-3 text-right">{money(openTotal)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        </div>
        <p className="mt-4 text-right text-[var(--color-text-global)]">{rows.length === 0 ? "0 - 0" : `1 - ${rows.length}`} of {rows.length} items</p>
        {error ? <p className="mt-3 text-sm text-[var(--color-negative)]" role="alert">{error}</p> : null}
      </div>
    </FullScreenFormShell>
  );
}
