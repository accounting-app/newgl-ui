"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestConfirmation } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast/toast-context";
import { RECURRING_CHANGED_EVENT, deleteRecurring, describeSchedule, listRecurring, runDueRecurring, updateRecurring } from "@/lib/services/recurring-service";
import type { RecurringKind, RecurringMode, RecurringTemplate } from "@/lib/services/recurring-service";

const KIND_LABEL: Record<RecurringKind, string> = { EXPENSE: "Expense", CHECK: "Check", DEPOSIT: "Deposit", SALES_RECEIPT: "Sales Receipt", JOURNAL_ENTRY: "Journal Entry" };
const MODE_LABEL: Record<RecurringMode, string> = { SCHEDULED: "Scheduled", REMINDER: "Reminder", UNSCHEDULED: "Unscheduled" };
// The form each template kind is filled into (Sales Receipt has no "Make recurring").
const FORM_ROUTE: Partial<Record<RecurringKind, string>> = { EXPENSE: "/expense", CHECK: "/check", DEPOSIT: "/deposit", JOURNAL_ENTRY: "/journal" };

const TH = "px-3 py-3 text-left text-xs font-semibold uppercase text-[var(--color-text-global)]";
const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
const display = (iso?: string) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-US") : "");
const total = (t: RecurringTemplate) => t.payload.postings.filter((p) => p.type === "DEBIT").reduce((s, p) => s + p.amount, 0);

// QBO's Recurring Transactions list: every saved template with its schedule,
// previous/next date and a row menu (Use / Edit / Pause / Delete).
export function RecurringTransactionsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<RecurringTemplate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString("en-CA");

  const refresh = useCallback(() => listRecurring().then((all) => { setItems(all); setError(null); }).catch((err) => setError(err instanceof Error ? err.message : "Could not load recurring transactions")), []);
  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    window.addEventListener(RECURRING_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(RECURRING_CHANGED_EVENT, onChanged);
  }, [refresh]);
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setMenuFor(null); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuFor]);

  const open = (t: RecurringTemplate, edit: boolean) => {
    const route = FORM_ROUTE[t.kind];
    setMenuFor(null);
    if (!route) return toast({ variant: "info", title: `Recurring ${KIND_LABEL[t.kind]} isn't available yet` });
    window.open(`${route}?template=${t.id}${edit ? "&edit=1" : ""}&rt=close`, "_blank");
  };
  async function toggle(t: RecurringTemplate) {
    setMenuFor(null);
    try {
      await updateRecurring(t.id, { enabled: !t.enabled });
      await refresh();
    } catch (err) {
      toast({ variant: "error", title: err instanceof Error ? err.message : "Could not update this template" });
    }
  }
  async function remove(t: RecurringTemplate) {
    setMenuFor(null);
    if (!(await requestConfirmation({ title: "Delete this recurring template?", message: `"${t.name}" will stop recurring. Transactions it already created stay.`, confirmLabel: "Delete" }))) return;
    try {
      await deleteRecurring(t.id);
      await refresh();
    } catch (err) {
      toast({ variant: "error", title: err instanceof Error ? err.message : "Could not delete this template" });
    }
  }
  async function runNow() {
    setRunning(true);
    try {
      const { created, failed } = await runDueRecurring();
      toast({ variant: failed ? "error" : "success", title: created === 0 && failed === 0 ? "Nothing is due right now" : `${created} posted${failed ? `, ${failed} failed` : ""}` });
      await refresh();
    } catch (err) {
      toast({ variant: "error", title: err instanceof Error ? err.message : "Could not run recurring transactions" });
    } finally {
      setRunning(false);
    }
  }
  const status = (t: RecurringTemplate) => (t.lastError ? "Error" : !t.enabled ? (t.mode !== "UNSCHEDULED" && !t.nextDate ? "Ended" : "Paused") : t.mode === "REMINDER" && t.nextDate && t.nextDate <= today ? "Due" : "Active");

  return (
    <div ref={rootRef} className="px-8 py-6 text-[var(--color-text-primary)]">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Recurring Transactions</h1>
        <Button variant="secondary" disabled={running} onClick={() => void runNow()}>{running ? "Running..." : "Post due now"}</Button>
      </div>
      {error ? <p className="text-[var(--color-negative)]" role="alert">{error}</p> : items === null ? <p>Loading...</p> : items.length === 0 ? (
        <div className="rounded-lg border border-[var(--color-divider-tertiary)] px-6 py-12 text-center">
          <p className="text-lg font-semibold text-[var(--color-text-global)]">No recurring transactions yet</p>
          <p className="mt-1">Open an Expense, Check, Deposit or Journal Entry and choose <strong>Make recurring</strong> at the bottom to save it as a template.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[var(--color-divider-tertiary)]">
                <th className={TH}>Template name</th>
                <th className={TH}>Type</th>
                <th className={TH}>Txn type</th>
                <th className={TH}>Payee</th>
                <th className={TH}>Interval</th>
                <th className={TH}>Previous date</th>
                <th className={TH}>Next date</th>
                <th className={`${TH} text-right`}>Amount</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => {
                const s = status(t);
                return (
                  <tr key={t.id} className="border-b border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                    <td className="px-3 py-3 font-medium text-[var(--color-text-global)]">{t.name}</td>
                    <td className="px-3 py-3">{MODE_LABEL[t.mode]}</td>
                    <td className="px-3 py-3">{KIND_LABEL[t.kind]}</td>
                    <td className="px-3 py-3">{t.payload.payee ?? ""}</td>
                    <td className="px-3 py-3">{t.mode === "UNSCHEDULED" ? "" : describeSchedule(t.schedule)}</td>
                    <td className="px-3 py-3">{display(t.lastRun)}</td>
                    <td className="px-3 py-3">{display(t.nextDate)}</td>
                    <td className="px-3 py-3 text-right">{money(total(t))}</td>
                    <td className={`px-3 py-3 ${s === "Due" || s === "Error" ? "font-semibold text-[var(--color-negative)]" : ""}`} title={t.lastError}>{s}</td>
                    <td className="relative px-3 py-3 text-right">
                      <button type="button" onClick={() => open(t, false)} className="mr-2 text-[var(--color-link-action)] hover:underline">Use</button>
                      <button type="button" aria-label={`More actions for ${t.name}`} aria-expanded={menuFor === t.id} onClick={() => setMenuFor(menuFor === t.id ? null : t.id)} className="inline-flex align-middle text-[var(--color-link-action)]"><ChevronDown className="h-4 w-4" aria-hidden="true" /></button>
                      {menuFor === t.id ? (
                        <ul className="absolute right-3 top-full z-10 w-36 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 text-left shadow-lg">
                          <li><button type="button" onClick={() => open(t, true)} className="block w-full px-3 py-1.5 text-left hover:bg-[var(--color-action-passive-subtle-hover)]">Edit</button></li>
                          {t.mode !== "UNSCHEDULED" ? <li><button type="button" onClick={() => void toggle(t)} className="block w-full px-3 py-1.5 text-left hover:bg-[var(--color-action-passive-subtle-hover)]">{t.enabled ? "Pause" : "Resume"}</button></li> : null}
                          <li><button type="button" onClick={() => void remove(t)} className="block w-full px-3 py-1.5 text-left text-[var(--color-negative)] hover:bg-[var(--color-action-passive-subtle-hover)]">Delete</button></li>
                        </ul>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
