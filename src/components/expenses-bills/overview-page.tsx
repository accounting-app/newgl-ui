"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Eye, EyeOff, HelpCircle, SlidersHorizontal, ThumbsDown, ThumbsUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, usePersistedJSON } from "@/lib/local-store/use-local-collection";
import { useBills } from "@/lib/hooks/use-bills";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { DEBIT_NORMAL_CATEGORIES } from "@/modules/accounting/domain/accounting-reports";
import type { Account, Transaction } from "@/modules/accounting/domain/models";
import { CREATE_ACTIONS, CreateActionPill, CreateActionsDrawer, DEFAULT_FAVORITE_ACTION_IDS } from "@/components/expenses-bills/create-actions-drawer";
import { AddWidgetsDrawer } from "@/components/expenses-bills/add-widgets-drawer";
import { WIDGET_ORDER, WidgetShell } from "@/components/expenses-bills/overview-widgets";
import type { WidgetId } from "@/components/expenses-bills/overview-widgets";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function signedImpact(account: Account, type: "DEBIT" | "CREDIT", amount: number): number {
  if (DEBIT_NORMAL_CATEGORIES.has(account.category)) return type === "DEBIT" ? amount : -amount;
  return type === "CREDIT" ? amount : -amount;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type WidgetPrefs = { order: WidgetId[]; hidden: WidgetId[] };
const DEFAULT_WIDGET_PREFS: WidgetPrefs = { order: WIDGET_ORDER, hidden: [] };

function FunnelStage({
  label,
  help,
  value,
  linkHref,
  linkLabel,
  disabledReason,
  last = false
}: {
  label: string;
  help?: string;
  value: string;
  linkHref?: string;
  linkLabel?: string;
  disabledReason?: string;
  last?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`min-w-[150px] flex-1 rounded-lg border border-[var(--color-divider-tertiary)] p-4 ${disabledReason ? "bg-[var(--color-container-background-accent)]" : ""}`}>
        <p className="flex items-center gap-1 text-sm text-[var(--color-text-global)]">
          {label}
          {help ? (
            <span title={help}>
              <HelpCircle className="h-3.5 w-3.5 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            </span>
          ) : null}
        </p>
        <p className={`mt-1 text-lg font-semibold ${disabledReason ? "text-[var(--color-text-disabled)]" : "text-[var(--color-text-global)]"}`}>{value}</p>
        {linkHref && linkLabel ? (
          <Link href={linkHref} className="mt-1 inline-block text-sm text-[var(--color-link-action)] hover:underline">
            {linkLabel}
          </Link>
        ) : null}
      </div>
      {!last ? <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-icon-secondary)]" aria-hidden="true" /> : null}
    </div>
  );
}

// Phase 1: the funnel stages read local-only Bills data; the spend chart
// and spend-insights breakdown read real posted transactions (expense
// postings), same source as Expense Transactions. See
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function ExpensesBillsOverviewPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);

  const { items: bills, hydrated: billsHydrated } = useBills();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txnsLoading, setTxnsLoading] = useState(true);
  useEffect(() => {
    Promise.all([services.transactionService.listTransactions({ status: "POSTED" }), services.accountService.listAccounts()])
      .then(([txns, accts]) => {
        setTransactions(txns);
        setAccounts(accts);
      })
      .finally(() => setTxnsLoading(false));
  }, [services]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const forReviewTotal = useMemo(() => bills.filter((b) => b.status === "DRAFT").reduce((s, b) => s + b.amount, 0), [bills]);
  const unpaidTotal = useMemo(() => bills.filter((b) => b.status === "OPEN").reduce((s, b) => s + b.amount, 0), [bills]);
  const paidTotal = useMemo(() => bills.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amount, 0), [bills]);

  const monthlySpend = useMemo(() => {
    const year = new Date().getFullYear();
    const totals = new Array(12).fill(0);
    transactions.forEach((txn) => {
      if (!txn.transactionDate.startsWith(String(year))) return;
      const month = Number(txn.transactionDate.slice(5, 7)) - 1;
      const expense = txn.postings.reduce((sum, posting) => {
        const account = accountById.get(posting.accountId);
        if (!account || (account.category !== "EXPENSE" && account.category !== "OTHER_EXPENSE")) return sum;
        return sum + signedImpact(account, posting.type, posting.amount);
      }, 0);
      if (expense > 0) totals[month] += expense;
    });
    return totals;
  }, [transactions, accountById]);
  const maxMonthly = Math.max(...monthlySpend, 1);

  const topCategories = useMemo(() => {
    const year = new Date().getFullYear();
    const totals = new Map<string, number>();
    transactions.forEach((txn) => {
      if (!txn.transactionDate.startsWith(String(year))) return;
      txn.postings.forEach((posting) => {
        const account = accountById.get(posting.accountId);
        if (!account || (account.category !== "EXPENSE" && account.category !== "OTHER_EXPENSE")) return;
        const impact = signedImpact(account, posting.type, posting.amount);
        if (impact <= 0) return;
        totals.set(account.name, (totals.get(account.name) ?? 0) + impact);
      });
    });
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [transactions, accountById]);
  const maxCategory = Math.max(...topCategories.map(([, v]) => v), 1);

  // -- Create actions favorites (persisted per company) --
  const favoritesKey = activeCompany ? companyScopedKey(activeCompany.name, "expenses-overview-favorites") : "newgl:phase1:pending:expenses-overview-favorites";
  const [favoriteIds, setFavoriteIds] = usePersistedJSON<string[]>(favoritesKey, DEFAULT_FAVORITE_ACTION_IDS);
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  // -- Widget layout/visibility (persisted per company) --
  const widgetsKey = activeCompany ? companyScopedKey(activeCompany.name, "expenses-overview-widgets") : "newgl:phase1:pending:expenses-overview-widgets";
  const [widgetPrefs, setWidgetPrefs] = usePersistedJSON<WidgetPrefs>(widgetsKey, DEFAULT_WIDGET_PREFS);
  const [editMode, setEditMode] = useState(false);
  const [showAddWidgetsDrawer, setShowAddWidgetsDrawer] = useState(false);
  const [glanceHidden, setGlanceHidden] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const dragIdRef = useRef<WidgetId | null>(null);

  function handleWidgetDrop(targetId: WidgetId) {
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    if (!draggedId || draggedId === targetId) return;
    setWidgetPrefs((current) => {
      const order = [...current.order];
      const from = order.indexOf(draggedId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return current;
      order.splice(from, 1);
      order.splice(to, 0, draggedId);
      return { ...current, order };
    });
  }

  function giveFeedback() {
    setFeedbackGiven(true);
    toast({ variant: "success", title: "Thanks for the feedback!" });
  }

  const visibleOrder = widgetPrefs.order.filter((id) => !widgetPrefs.hidden.includes(id));

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  const favoriteActions = favoriteIds.map((id) => CREATE_ACTIONS.find((a) => a.id === id)).filter((a): a is (typeof CREATE_ACTIONS)[number] => Boolean(a));

  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold text-[var(--color-text-global)]">Expenses & Pay Bills overview</h1>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-base font-semibold text-[var(--color-text-global)]">Create actions</span>
        {favoriteActions.map((action) => (
          <CreateActionPill key={action.id} action={action} />
        ))}
        <button type="button" onClick={() => setShowCreateDrawer(true)} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
          Show all
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--color-text-global)]">Expenses at a glance</h2>
        {editMode ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowAddWidgetsDrawer(true)}>
              Add widgets
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditMode(false);
                toast({ variant: "success", title: "Dashboard layout saved" });
              }}
            >
              Save
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <IconButton icon={SlidersHorizontal} label="Customize dashboard" size="sm" onClick={() => setEditMode(true)} />
            <IconButton icon={glanceHidden ? EyeOff : Eye} label={glanceHidden ? "Show this section" : "Hide this section"} size="sm" onClick={() => setGlanceHidden((v) => !v)} />
          </div>
        )}
      </div>

      {glanceHidden ? null : (
        <>
          {editMode && !feedbackGiven ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-[var(--color-container-background-accent)] px-4 py-2.5">
              <span className="text-sm text-[var(--color-text-primary)]">Are these customization options useful?</span>
              <div className="flex items-center gap-1">
                <IconButton icon={ThumbsUp} label="Yes, useful" size="sm" onClick={giveFeedback} />
                <IconButton icon={ThumbsDown} label="Not useful" size="sm" onClick={giveFeedback} />
              </div>
            </div>
          ) : null}

          {visibleOrder.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)]">
              No widgets to show -- {editMode ? 'use "Add widgets" above to bring one back.' : "turn on customize to add one."}
            </p>
          ) : (
            visibleOrder.map((id) => (
              <WidgetShell key={id} id={id} editMode={editMode} onDragStart={(dragId) => (dragIdRef.current = dragId)} onDrop={handleWidgetDrop}>
                {id === "bills-funnel" ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Bills funnel</p>
                    <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-global)]">Upload bills, review them, and schedule online payments</h3>
                    {!billsHydrated ? (
                      <div className="flex gap-2">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <Skeleton key={i} className="h-24 flex-1 rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="min-w-[170px] flex-1 rounded-lg border border-[var(--color-divider-tertiary)] p-4">
                            <p className="font-semibold text-[var(--color-text-global)]">Auto-create bills</p>
                            <p className="mt-1 text-sm text-[var(--color-text-primary)]">Create bills by uploading vendor invoices.</p>
                            <Link href="/all-apps/expenses-bills/bills" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-button-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)]">
                              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                              Upload
                            </Link>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                        </div>
                        <FunnelStage
                          label="For review"
                          help="Bills waiting for you to review before they're marked unpaid."
                          value={formatMoney(forReviewTotal)}
                          linkHref="/all-apps/expenses-bills/bills"
                          linkLabel="Upload bills"
                        />
                        <FunnelStage label="Set up bill approval" value="--" disabledReason="Not available yet" />
                        <FunnelStage label="Unpaid" value={formatMoney(unpaidTotal)} />
                        <FunnelStage label="Set up payment approval" value="--" disabledReason="Not available yet" />
                        <FunnelStage label="Paid" value={formatMoney(paidTotal)} last />
                      </div>
                    )}
                  </>
                ) : null}

                {id === "spend-over-time" ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Spend over time</p>
                    <h3 className="mb-4 text-lg font-semibold text-[var(--color-text-global)]">Track and compare your total spend over time</h3>
                    {txnsLoading ? (
                      <Skeleton className="h-40 w-full rounded" />
                    ) : (
                      // Pixel heights, not percentages -- a percentage height only
                      // resolves against an ancestor with an explicit height, and
                      // these bars sit in an auto-height flex column.
                      <div className="flex h-[144px] items-end gap-2">
                        {monthlySpend.map((value, i) => (
                          <div key={MONTH_LABELS[i]} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className="w-full rounded-t bg-[var(--color-positive)]"
                              style={{ height: `${Math.max((value / maxMonthly) * 128, value > 0 ? 4 : 0)}px` }}
                              title={formatMoney(value)}
                            />
                            <span className="text-[10px] text-[var(--color-icon-secondary)]">{MONTH_LABELS[i]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <Link href="/all-apps/expenses-bills/bills" className="mt-3 block text-center text-sm text-[var(--color-link-action)] hover:underline">
                      Upload bills
                    </Link>
                  </>
                ) : null}

                {id === "spend-insights" ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">Spend insights</p>
                    <h3 className={topCategories.length > 0 ? "mb-4 text-lg font-semibold text-[var(--color-text-global)]" : "text-lg font-semibold text-[var(--color-text-global)]"}>
                      {topCategories.length > 0 ? "Your top spending categories this year" : "Add transactions to see where you're spending the most"}
                    </h3>
                    {txnsLoading ? (
                      <Skeleton className="h-32 w-full rounded" />
                    ) : topCategories.length > 0 ? (
                      <div className="flex flex-col gap-2.5">
                        {topCategories.map(([name, value]) => (
                          <div key={name} className="flex items-center gap-3">
                            <span className="w-36 shrink-0 truncate text-sm text-[var(--color-text-primary)]">{name}</span>
                            <div className="h-2 flex-1 rounded-full bg-[var(--color-container-background-accent)]">
                              <div className="h-2 rounded-full bg-[var(--color-positive)]" style={{ width: `${Math.max((value / maxCategory) * 100, 4)}%` }} />
                            </div>
                            <span className="w-16 shrink-0 text-right text-sm text-[var(--color-text-global)]">{formatMoney(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </WidgetShell>
            ))
          )}
        </>
      )}

      {showCreateDrawer ? (
        <CreateActionsDrawer
          favoriteIds={favoriteIds}
          onClose={() => setShowCreateDrawer(false)}
          onSave={(next) => {
            setFavoriteIds(next);
            setShowCreateDrawer(false);
            toast({ variant: "success", title: "Create actions updated" });
          }}
        />
      ) : null}

      {showAddWidgetsDrawer ? (
        <AddWidgetsDrawer
          hiddenWidgetIds={widgetPrefs.hidden}
          onClose={() => setShowAddWidgetsDrawer(false)}
          onSave={(nextHidden) => {
            setWidgetPrefs((current) => ({ ...current, hidden: nextHidden }));
            setShowAddWidgetsDrawer(false);
          }}
        />
      ) : null}
    </>
  );
}
