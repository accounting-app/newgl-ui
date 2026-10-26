"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, Search } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useVendors } from "@/lib/hooks/use-vendors";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Transaction } from "@/modules/accounting/domain/models";

type Kind = "customer" | "vendor";
type Contact = { id: string; name: string; companyName?: string; email?: string; phone?: string; address?: string };

const TABS = ["Transaction List", "Activity Feed", "Statements", "Recurring Transactions", "Customer Details", "Late Fees", "Notes", "Tasks"];
const VENDOR_TABS = ["Transaction List", "Vendor Details", "Notes"];
const money = (value: number) => value.toLocaleString("en-US", { style: "currency", currency: "USD" });
const shortDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${Number(m)}/${Number(d)}/${y.slice(2)}`;
};
const titleCase = (id: string) => id.toLowerCase().split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
const AMOUNT = (t: Transaction) => t.postings.filter((p) => p.type === "DEBIT").reduce((sum, p) => sum + p.amount, 0);
const LINK = "text-[var(--color-link-action)]";

// QBO's customer / vendor detail screen (/customerdetail?nameId=...), where
// "Payee Details" on the Expense and Sales Receipt forms lands. Left: the
// directory. Right: the contact's card and every ledger transaction filed
// under their name.
export function ContactDetailPage({ kind }: { kind: Kind }) {
  const router = useRouter();
  const nameId = useSearchParams().get("nameId") ?? "";
  const services = useMemo(() => getServiceContainer(), []);
  const customers = useCustomers();
  const vendors = useVendors();
  const contacts: Contact[] = kind === "customer" ? customers.items : vendors.items;
  const hydrated = kind === "customer" ? customers.hydrated : vendors.hydrated;
  const contact = contacts.find((c) => c.id === nameId);
  const label = kind === "customer" ? "Customer" : "Vendor";
  const tabs = kind === "customer" ? TABS : VENDOR_TABS;

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [tab, setTab] = useState("Transaction List");
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [newMenu, setNewMenu] = useState(false);

  useEffect(() => {
    services.transactionService.listTransactions({}).then(setTxns).catch(() => setTxns([]));
  }, [services]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q));
    return sort === "name" ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : filtered;
  }, [contacts, search, sort]);

  const mine = useMemo(() => (contact ? txns.filter((t) => t.payee === contact.name).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)) : []), [txns, contact]);
  const typeOptions = useMemo(() => [{ value: "", label: "All transactions" }, ...[...new Set(mine.map((t) => t.type))].map((t) => ({ value: t, label: titleCase(t) }))], [mine]);
  const shown = mine.filter((t) => (!type || t.type === type) && (!status || t.status === status));
  const total = shown.reduce((sum, t) => sum + (t.status === "VOIDED" ? 0 : AMOUNT(t)), 0);

  if (!hydrated) return <p className="text-sm">Loading…</p>;

  return (
    <div className="text-[var(--color-text-primary)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={kind === "customer" ? "/all-apps/customer-hub/customers" : "/all-apps/expenses-bills/vendors"} className={`flex items-center gap-1 text-lg ${LINK}`}>
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          {label}s
        </Link>
        <div className="flex items-center gap-3">
          <button type="button" disabled title="Reports by customer aren't available yet" className="cursor-not-allowed rounded-md bg-[#8f1111] px-4 py-2 text-sm text-white opacity-90">{label} P&amp;L</button>
          <div className="relative">
            <button type="button" onClick={() => setNewMenu((v) => !v)} className="inline-flex items-center gap-2 rounded-full bg-[var(--color-ui-primary)] px-5 py-2 text-base font-semibold text-white">
              New transaction <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            {newMenu ? (
              <ul className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <li><button type="button" onClick={() => router.push("/salesreceipt?rt=close")} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-action-passive-subtle-hover)]">Sales receipt</button></li>
                <li><button type="button" onClick={() => router.push("/expense?rt=close")} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-action-passive-subtle-hover)]">Expense</button></li>
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <aside className="w-[330px] shrink-0 rounded-lg border border-[var(--color-container-border-secondary)] bg-[var(--color-container-background-primary)] p-3">
          <p className="mb-2 text-sm">Search by name or details</p>
          <label className="flex items-center gap-2 rounded-md border border-[var(--color-input-border-primary)] px-3 py-2">
            <Search className="h-5 w-5 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" aria-label="Search" className="w-full bg-transparent text-base outline-none" />
          </label>
          <div className="mt-3 flex gap-2 text-sm">
            <button type="button" onClick={() => setSort("recent")} className={`rounded-md px-2 py-1 ${sort === "recent" ? "bg-[var(--color-action-passive-subtle-hover)]" : ""}`}>Recent</button>
            <button type="button" onClick={() => setSort("name")} className={`rounded-md px-2 py-1 ${sort === "name" ? "bg-[var(--color-action-passive-subtle-hover)]" : ""}`}>Name</button>
          </div>
          <p className="my-3 text-center text-sm">{sort === "recent" ? `Recently viewed ${label.toLowerCase()}s` : `All ${label.toLowerCase()}s`}</p>
          <ul className="max-h-[560px] overflow-y-auto">
            {list.map((c) => (
              <li key={c.id}>
                <Link href={`/${kind}detail?nameId=${encodeURIComponent(c.id)}`} className={`block px-4 py-3 text-base ${c.id === nameId ? "bg-[var(--color-action-passive-subtle-hover)] font-medium" : "hover:bg-[var(--color-action-passive-subtle-hover)]"}`}>{c.name}</Link>
              </li>
            ))}
            {list.length === 0 ? <li className="px-4 py-3 text-sm">No matches</li> : null}
          </ul>
        </aside>

        <div className="min-w-[520px] flex-1">
          {!contact ? (
            <p className="rounded-lg bg-[var(--color-container-background-primary)] p-6 text-base">This {label.toLowerCase()} couldn&apos;t be found. Pick one from the list.</p>
          ) : (
            <>
              <section className="flex flex-wrap gap-8 rounded-lg border border-[var(--color-container-border-secondary)] bg-[var(--color-container-background-primary)] p-6">
                <div className="flex w-[240px] flex-col items-center gap-2 text-center">
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-action-passive-subtle-hover)] text-2xl">{initials(contact.name)}</span>
                  <p className="text-2xl text-[var(--color-text-global)]">{contact.name}</p>
                  <p className={contact.companyName ? "text-base" : `text-base ${LINK}`}>{contact.companyName ?? "Add company name"}</p>
                </div>
                <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-5 text-sm" style={{ minWidth: 360 }}>
                  <div><dt>Email</dt><dd className={`text-base ${contact.email ? "" : LINK}`}>{contact.email ?? "Add email"}</dd></div>
                  <div><dt>Phone</dt><dd className={`text-base ${contact.phone ? "" : LINK}`}>{contact.phone ?? "Add phone number"}</dd></div>
                  <div><dt>Billing address</dt><dd className={`text-base ${contact.address ? "" : LINK}`}>{contact.address ?? "Add billing address"}</dd></div>
                  <div><dt>Shipping address</dt><dd className={`text-base ${LINK}`}>Add shipping address</dd></div>
                  <div><dt>Notes</dt><dd className={`text-base ${LINK}`}>Add notes</dd></div>
                </dl>
                <div className="w-[300px] rounded-xl bg-[#dbe9fb] p-5 text-[#1f2933]">
                  <p className="mb-3 text-lg font-semibold">Financial summary</p>
                  <p className="flex items-center gap-2 text-base"><span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />Open balance</p>
                  <p className="mb-3 text-2xl">{money(0)}</p>
                  <p className="flex items-center gap-2 text-base"><span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />Overdue payment</p>
                  <p className="text-2xl">{money(0)}</p>
                </div>
              </section>

              <nav className="mt-6 flex flex-wrap gap-8 border-b-2 border-[var(--color-divider-tertiary)]" aria-label={`${label} sections`}>
                {tabs.map((t) => (
                  <button key={t} type="button" onClick={() => setTab(t)} className={`-mb-0.5 border-b-2 px-1 pb-3 text-lg ${tab === t ? "border-[var(--color-ui-primary)] text-[var(--color-text-global)]" : "border-transparent"}`}>{t}</button>
                ))}
              </nav>

              {tab === "Transaction List" ? (
                <div className="mt-4">
                  <div className="mb-6 flex flex-wrap items-end gap-4">
                    <div className="w-[240px]"><span className="mb-1 block text-sm">Type</span><Select value={type} onChange={setType} options={typeOptions} placeholder="All transactions" allowCustomValue={false} /></div>
                    <div className="w-[240px]"><span className="mb-1 block text-sm">Status</span><Select value={status} onChange={setStatus} options={[{ value: "", label: "All" }, { value: "POSTED", label: "Posted" }, { value: "VOIDED", label: "Voided" }]} placeholder="All" allowCustomValue={false} /></div>
                  </div>
                  <table className="w-full border-collapse text-base">
                    <thead>
                      <tr className="border-b-2 border-[var(--color-divider-tertiary)] text-left font-semibold text-[var(--color-text-global)]">
                        <th className="px-3 py-4">Date</th><th className="px-3 py-4">Type</th><th className="px-3 py-4">No.</th><th className="px-3 py-4">{label}</th><th className="px-3 py-4">Memo</th><th className="px-3 py-4 text-right">Amount</th><th className="px-3 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((t) => (
                        <tr key={t.id} className="border-b border-[var(--color-divider-tertiary)]">
                          <td className="px-3 py-4">{shortDate(t.transactionDate)}</td>
                          <td className="px-3 py-4">{titleCase(t.type)}</td>
                          <td className="px-3 py-4">{t.referenceNumber ?? ""}</td>
                          <td className="px-3 py-4">{t.payee}</td>
                          <td className="px-3 py-4">{t.memo ?? ""}</td>
                          <td className="px-3 py-4 text-right">{money(AMOUNT(t))}</td>
                          <td className="px-3 py-4">{t.status === "VOIDED" ? "Voided" : ""}</td>
                        </tr>
                      ))}
                      {shown.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-sm">No transactions yet</td></tr> : null}
                      <tr className="bg-[var(--color-table-row-secondary)] font-semibold text-[var(--color-text-global)]"><td className="px-3 py-4" /><td className="px-3 py-4">Total</td><td colSpan={3} /><td className="px-3 py-4 text-right">{money(total)}</td><td /></tr>
                    </tbody>
                  </table>
                  <p className="mt-6 text-center text-sm">{shown.length === 0 ? "0 of 0" : `1–${shown.length} of ${shown.length}`}</p>
                </div>
              ) : tab === "Customer Details" || tab === "Vendor Details" ? (
                <dl className="mt-6 grid max-w-xl grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-base">
                  <dt>Name</dt><dd>{contact.name}</dd>
                  <dt>Company</dt><dd>{contact.companyName ?? "—"}</dd>
                  <dt>Email</dt><dd>{contact.email ?? "—"}</dd>
                  <dt>Phone</dt><dd>{contact.phone ?? "—"}</dd>
                  <dt>Address</dt><dd>{contact.address ?? "—"}</dd>
                </dl>
              ) : (
                <p className="mt-8 text-base">{tab} isn&apos;t available yet.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
