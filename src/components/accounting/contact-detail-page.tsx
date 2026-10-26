"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, MessageSquareText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast/toast-context";
import { listInvoices } from "@/lib/services/invoices-service";
import type { Invoice } from "@/lib/services/invoices-service";
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
const EXTRAS_KEY = "newgl:contact-extras:v1";
type Extras = { shipping?: string; notes?: string };
const loadExtras = (id: string): Extras => {
  try {
    return JSON.parse(window.localStorage.getItem(EXTRAS_KEY) ?? "{}")[id] ?? {};
  } catch {
    return {};
  }
};
const saveExtras = (id: string, extras: Extras) => {
  try {
    const all = JSON.parse(window.localStorage.getItem(EXTRAS_KEY) ?? "{}");
    window.localStorage.setItem(EXTRAS_KEY, JSON.stringify({ ...all, [id]: extras }));
  } catch {
    // not persisted
  }
};
const DATE_RANGES = [
  { value: "", label: "All" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "lastmonth", label: "Last month" },
  { value: "year", label: "This year" }
];
function inRange(iso: string, range: string): boolean {
  if (!range) return true;
  const now = new Date();
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (range === "30d") return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30) && d <= now;
  if (range === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (range === "lastmonth") {
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth();
  }
  return d.getFullYear() === now.getFullYear();
}
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
  const [editMenu, setEditMenu] = useState(false);
  const [dateRange, setDateRange] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", companyName: "", email: "", phone: "", address: "", shipping: "", notes: "" });
  const [extras, setExtras] = useState<Extras>({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    services.transactionService.listTransactions({}).then(setTxns).catch(() => setTxns([]));
  }, [services]);

  useEffect(() => {
    if (kind === "customer") listInvoices().then(setInvoices).catch(() => setInvoices([]));
  }, [kind]);
  useEffect(() => {
    if (nameId) setExtras(loadExtras(nameId));
  }, [nameId]);

  const today = new Date().toISOString().slice(0, 10);
  const openInvoices = invoices.filter((i) => i.customerId === nameId && i.status === "OPEN");
  const openBalance = openInvoices.reduce((sum, i) => sum + i.amount, 0);
  const overdue = openInvoices.filter((i) => i.dueDate < today).reduce((sum, i) => sum + i.amount, 0);

  function startEdit() {
    if (!contact) return;
    setForm({ name: contact.name, companyName: contact.companyName ?? "", email: contact.email ?? "", phone: contact.phone ?? "", address: contact.address ?? "", shipping: extras.shipping ?? "", notes: extras.notes ?? "" });
    setEditMenu(false);
    setEditing(true);
  }
  async function saveEdit() {
    if (!contact) return;
    if (!form.name.trim()) return toast({ variant: "error", title: "Name is required" });
    setSaving(true);
    try {
      const patch = { name: form.name.trim(), companyName: form.companyName.trim() || undefined, email: form.email.trim() || undefined, phone: form.phone.trim() || undefined, address: form.address.trim() || undefined };
      if (kind === "customer") await customers.update(contact.id, patch);
      else await vendors.update(contact.id, patch);
      const next = { shipping: form.shipping.trim() || undefined, notes: form.notes.trim() || undefined };
      saveExtras(contact.id, next);
      setExtras(next);
      setEditing(false);
      toast({ variant: "success", title: `${label} updated` });
    } catch (err) {
      toast({ variant: "error", title: `Could not update ${label.toLowerCase()}`, description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }
  async function makeInactive() {
    if (!contact) return;
    setEditMenu(false);
    try {
      if (kind === "customer") await customers.update(contact.id, { status: "ARCHIVED" });
      else await vendors.update(contact.id, { status: "ARCHIVED" });
      toast({ variant: "success", title: `${label} made inactive` });
      router.push(kind === "customer" ? "/all-apps/customer-hub/customers" : "/all-apps/expenses-bills/vendors");
    } catch (err) {
      toast({ variant: "error", title: "Could not make inactive", description: err instanceof Error ? err.message : undefined });
    }
  }

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q));
    return sort === "name" ? [...filtered].sort((a, b) => a.name.localeCompare(b.name)) : filtered;
  }, [contacts, search, sort]);

  const mine = useMemo(() => (contact ? txns.filter((t) => t.payee === contact.name).sort((a, b) => b.transactionDate.localeCompare(a.transactionDate)) : []), [txns, contact]);
  const typeOptions = useMemo(() => [{ value: "", label: "All transactions" }, ...[...new Set(mine.map((t) => t.type))].map((t) => ({ value: t, label: titleCase(t) }))], [mine]);
  const shown = mine.filter((t) => (!type || t.type === type) && (!status || t.status === status) && inRange(t.transactionDate, dateRange));
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
          {kind === "customer" && contact ? (
            <button type="button" onClick={() => window.open(`/report/builder?rptId=${crypto.randomUUID()}&type=temp&token=PANDL&title=${encodeURIComponent(`Profit And Loss ${contact.name}`)}&nameId=${contact.id}`, "_blank")} className="rounded-md bg-[#8f1111] px-4 py-2 text-sm text-white hover:opacity-90">Customer P&amp;L</button>
          ) : (
            <button type="button" disabled title="Reports by vendor aren't available yet" className="cursor-not-allowed rounded-md bg-[#8f1111] px-4 py-2 text-sm text-white opacity-90">{label} P&amp;L</button>
          )}
          <button type="button" onClick={() => toast({ variant: "info", title: "Feedback isn't available yet" })} className="flex items-center gap-2 text-lg text-[var(--color-text-global)] hover:underline">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            Give feedback
          </button>
          <div className="relative inline-flex">
            <button type="button" onClick={startEdit} disabled={!contact} className="h-10 rounded-l-md border border-[var(--color-ui-primary)] px-5 text-lg text-[var(--color-text-global)] disabled:opacity-50">Edit</button>
            <button type="button" onClick={() => setEditMenu((v) => !v)} disabled={!contact} aria-label="More edit options" className="h-10 rounded-r-md border border-l-0 border-[var(--color-ui-primary)] px-2 disabled:opacity-50"><ChevronDown className="h-4 w-4" aria-hidden="true" /></button>
            {editMenu ? (
              <ul className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <li><button type="button" onClick={() => void makeInactive()} className="block w-full px-3 py-1.5 text-left text-sm hover:bg-[var(--color-action-passive-subtle-hover)]">Make inactive</button></li>
              </ul>
            ) : null}
          </div>
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
                  <p className="text-base">{contact.companyName ?? <button type="button" onClick={startEdit} className={LINK}>Add company name</button>}</p>
                </div>
                <dl className="grid flex-1 grid-cols-2 gap-x-8 gap-y-5 text-sm" style={{ minWidth: 360 }}>
                  <div><dt>Email</dt><dd className="text-base">{contact.email ?? <button type="button" onClick={startEdit} className={LINK}>Add email</button>}</dd></div>
                  <div><dt>Phone</dt><dd className="text-base">{contact.phone ?? <button type="button" onClick={startEdit} className={LINK}>Add phone number</button>}</dd></div>
                  <div><dt>Billing address</dt><dd className="text-base">{contact.address ?? <button type="button" onClick={startEdit} className={LINK}>Add billing address</button>}</dd></div>
                  <div><dt>Shipping address</dt><dd className="text-base">{extras.shipping ?? <button type="button" onClick={startEdit} className={LINK}>Add shipping address</button>}</dd></div>
                  <div><dt>Notes</dt><dd className="text-base">{extras.notes ?? <button type="button" onClick={startEdit} className={LINK}>Add notes</button>}</dd></div>
                </dl>
                <div className="w-[300px] rounded-xl bg-[#dbe9fb] p-5 text-[#1f2933]">
                  <p className="mb-3 text-lg font-semibold">Financial summary</p>
                  <p className="flex items-center gap-2 text-base"><span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />Open balance</p>
                  <p className="mb-3 text-2xl">{money(openBalance)}</p>
                  <p className="flex items-center gap-2 text-base"><span className="h-2 w-2 rounded-full bg-red-600" aria-hidden="true" />Overdue payment</p>
                  <p className="text-2xl">{money(overdue)}</p>
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
                    <div className="w-[240px]"><span className="mb-1 block text-sm">Date</span><Select value={dateRange} onChange={setDateRange} options={DATE_RANGES} placeholder="All" allowCustomValue={false} /></div>
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
      <Modal open={editing} onClose={() => setEditing(false)} title={`Edit ${label.toLowerCase()}`} size="md">
        <div className="grid grid-cols-2 gap-3">
          {([["name", "Name"], ["companyName", "Company name"], ["email", "Email"], ["phone", "Phone"]] as const).map(([key, text]) => (
            <label key={key} className="text-sm">{text}<InputField value={form[key]} onChange={(event) => setForm((f) => ({ ...f, [key]: event.target.value }))} /></label>
          ))}
          <label className="text-sm">Billing address<InputField value={form.address} onChange={(event) => setForm((f) => ({ ...f, address: event.target.value }))} /></label>
          <label className="text-sm">Shipping address<InputField value={form.shipping} onChange={(event) => setForm((f) => ({ ...f, shipping: event.target.value }))} /></label>
          <label className="col-span-2 text-sm">Notes<textarea value={form.notes} onChange={(event) => setForm((f) => ({ ...f, notes: event.target.value }))} className="mt-1 h-24 w-full rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-3 py-2 text-sm" /></label>
        </div>
        <p className="mt-2 text-xs">Shipping address and notes are saved in this browser only.</p>
        <div className="mt-4 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
          <Button onClick={() => void saveEdit()} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </Modal>
    </div>
  );
}
