"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, HelpCircle, Printer, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/lib/company/company-provider";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import {
  deleteReconciliationAttachment,
  discardReconciliationDraft,
  downloadReconciliationAttachment,
  getReconciliationSetup,
  listReconciliationAttachments,
  listReconciliations,
  listReconciliationsForAccount,
  undoReconciliation,
  uploadReconciliationAttachment,
  type Reconciliation,
  type ReconciliationAttachment,
  type ReconciliationSetup
} from "@/lib/services/reconciliation-service";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import {
  getReconcileAdjustmentKind,
  groupAccountsByCategory,
  isBankOrCreditCardCategory,
  isRegisterAccountCategory
} from "@/modules/accounting/presentation/transaction-type-policy";
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

/**
 * The setup form only starts a session -- it no longer writes anything
 * itself. Submitting hands its values to the matching screen
 * (/all-apps/reconcile/session) via the URL, where the real statement
 * math and Finish call happen. See reconciliation-session-page.tsx.
 */
export function ReconcilePage() {
  const { activeCompany } = useCompany();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [undoTarget, setUndoTarget] = useState<Reconciliation | null>(null);
  const [undoing, setUndoing] = useState(false);
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  const reconcilableAccounts = useMemo(() => accounts.filter((a) => isRegisterAccountCategory(a.category)), [accounts]);
  // Flat list ordered by category, each option's type shown via rightLabel
  // -- matches both QBO's own account picker (e.g. "Cash on hand ... Bank")
  // and this app's existing convention for every other account picker
  // (bank-transactions-page.tsx, account-selector.tsx, etc.), rather than
  // introducing a one-off bold-header grouped style just for this screen.
  const groupedAccountOptions = useMemo(
    () =>
      groupAccountsByCategory(reconcilableAccounts).flatMap(({ category, accounts: categoryAccounts }) =>
        categoryAccounts.map((account) => ({ value: account.id, label: account.name, rightLabel: ACCOUNT_CATEGORY_LABELS[category] }))
      ),
    [reconcilableAccounts]
  );
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const [userName, setUserName] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUserName(data.user?.email ?? null));
  }, []);

  // Lets other pages deep-link into a specific tab (e.g. the printable
  // report's "Summary"/"Reconcile" nav buttons) via /all-apps/reconcile?view=...
  const initialView = searchParams.get("view");
  const [view, setView] = useState<ReconcileView>(
    initialView === "summary" || initialView === "history" ? initialView : "reconcile"
  );

  const [accountId, setAccountId] = useState("");
  useEffect(() => {
    if (!accountId && reconcilableAccounts.length > 0) setAccountId(reconcilableAccounts[0].id);
  }, [reconcilableAccounts, accountId]);
  const selectedAccount = accounts.find((a) => a.id === accountId);

  // The beginning balance is what the books say is already reconciled
  // (opening balance + every reconciled transaction), not the last
  // statement's typed-in balance -- the server derives it from the ledger.
  const [setup, setSetup] = useState<ReconciliationSetup | null>(null);
  useEffect(() => {
    if (!accountId) return;
    setSetup(null);
    getReconciliationSetup(accountId)
      .then(setSetup)
      .catch(() => setSetup(null));
  }, [accountId]);
  const beginningBalance = setup?.beginningBalance ?? 0;

  const [statementEndingBalance, setStatementEndingBalance] = useState("");
  const [statementEndingDate, setStatementEndingDate] = useState("");

  // Matches QBO: while a required field is focused, show a short
  // description of what it's for; once it loses focus, if it's still
  // empty, that description is replaced by a real validation error
  // (border + icon), not shown at all otherwise.
  const [focusedField, setFocusedField] = useState<"endingBalance" | "endingDate" | null>(null);
  const [touchedFields, setTouchedFields] = useState<Set<"endingBalance" | "endingDate">>(new Set());
  function handleFieldBlur(field: "endingBalance" | "endingDate") {
    setFocusedField(null);
    setTouchedFields((current) => new Set(current).add(field));
  }

  const useStatementLabel = selectedAccount ? isBankOrCreditCardCategory(selectedAccount.category) : true;
  const endingBalanceLabel = useStatementLabel ? "Statement ending balance" : "Ending balance";
  const endingDateLabel = useStatementLabel ? "Statement ending date" : "Ending date";

  const endingBalanceHint = focusedField === "endingBalance" ? "This amount is the ending balance from your bank statement." : undefined;
  const endingBalanceError =
    focusedField !== "endingBalance" && touchedFields.has("endingBalance") && statementEndingBalance.trim() === ""
      ? `${endingBalanceLabel} is required. Enter an amount.`
      : undefined;
  const endingDateHint = focusedField === "endingDate" ? "This date is the ending date from your bank statement." : undefined;
  const endingDateError =
    focusedField !== "endingDate" && touchedFields.has("endingDate") && !statementEndingDate
      ? `${endingDateLabel} is required. Enter a date in the format mm/dd/yyyy.`
      : undefined;
  const adjustmentKind = selectedAccount ? getReconcileAdjustmentKind(selectedAccount.category) : "none";
  const expenseAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const incomeAccountOptions = useMemo(
    () => accounts.filter((a) => a.category === "INCOME" || a.category === "OTHER_INCOME").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const [serviceChargeAmount, setServiceChargeAmount] = useState("");
  const [serviceChargeDate, setServiceChargeDate] = useState("");
  const [serviceChargeExpenseAccountId, setServiceChargeExpenseAccountId] = useState("");
  const [interestEarnedAmount, setInterestEarnedAmount] = useState("");
  const [interestEarnedDate, setInterestEarnedDate] = useState("");
  const [interestEarnedIncomeAccountId, setInterestEarnedIncomeAccountId] = useState("");

  const [historyRecords, setHistoryRecords] = useState<Reconciliation[]>([]);
  const [historyHydrated, setHistoryHydrated] = useState(false);
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  useEffect(() => {
    if (!accountId) return;
    setHistoryHydrated(false);
    listReconciliationsForAccount(accountId)
      .then(setHistoryRecords)
      .catch(() => setHistoryRecords([]))
      .finally(() => setHistoryHydrated(true));
  }, [accountId, historyReloadKey]);

  const [attachments, setAttachments] = useState<ReconciliationAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  useEffect(() => {
    if (!accountId) return;
    listReconciliationAttachments(accountId)
      .then(setAttachments)
      .catch(() => setAttachments([]));
  }, [accountId, historyReloadKey]);

  async function handleAttachFile(file: File | undefined) {
    const reconciliationId = attachTargetId;
    setAttachTargetId(null);
    if (!file || !reconciliationId) return;
    try {
      await uploadReconciliationAttachment(reconciliationId, file);
      setHistoryReloadKey((key) => key + 1);
    } catch (error) {
      toast({ variant: "error", title: error instanceof Error ? error.message : "Couldn't attach that file" });
    }
  }

  async function handleRemoveAttachment(attachment: ReconciliationAttachment) {
    try {
      await deleteReconciliationAttachment(attachment.id);
      setHistoryReloadKey((key) => key + 1);
    } catch (error) {
      toast({ variant: "error", title: error instanceof Error ? error.message : "Couldn't remove that file" });
    }
  }

  async function handleStartOver() {
    if (!window.confirm("Start over? Your saved progress for this account will be discarded.")) return;
    setDiscardingDraft(true);
    try {
      await discardReconciliationDraft(accountId);
      setSetup((current) => (current ? { ...current, draft: null } : current));
    } catch (error) {
      toast({ variant: "error", title: error instanceof Error ? error.message : "Couldn't discard the saved progress" });
    } finally {
      setDiscardingDraft(false);
    }
  }

  async function handleConfirmUndo() {
    if (!undoTarget) return;
    setUndoing(true);
    try {
      await undoReconciliation(undoTarget.id);
      toast({ variant: "success", title: `Reconciliation for ${undoTarget.statementEndingDate} was undone` });
      setUndoTarget(null);
      setHistoryReloadKey((key) => key + 1);
      getReconciliationSetup(accountId).then(setSetup).catch(() => undefined);
    } catch (error) {
      toast({ variant: "error", title: error instanceof Error ? error.message : "Couldn't undo this reconciliation" });
    } finally {
      setUndoing(false);
    }
  }

  const [summaryRecords, setSummaryRecords] = useState<Reconciliation[]>([]);
  const [summaryHydrated, setSummaryHydrated] = useState(false);
  useEffect(() => {
    if (view !== "summary") return;
    setSummaryHydrated(false);
    listReconciliations()
      .then(setSummaryRecords)
      .catch(() => setSummaryRecords([]))
      .finally(() => setSummaryHydrated(true));
  }, [view]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accountId || !statementEndingDate || statementEndingBalance.trim() === "") return;

    const params = new URLSearchParams({
      statementStartDate: setup?.lastStatementEndingDate ?? (selectedAccount ? selectedAccount.createdAt.slice(0, 10) : statementEndingDate),
      statementEndingDate,
      statementEndingBalance,
      statementBeginningBalance: String(beginningBalance)
    });
    if (adjustmentKind !== "none" && serviceChargeAmount.trim() !== "" && serviceChargeDate && serviceChargeExpenseAccountId) {
      params.set("serviceChargeAmount", serviceChargeAmount);
      params.set("serviceChargeDate", serviceChargeDate);
      params.set("serviceChargeExpenseAccountId", serviceChargeExpenseAccountId);
    }
    if (adjustmentKind === "serviceChargeAndInterest" && interestEarnedAmount.trim() !== "" && interestEarnedDate && interestEarnedIncomeAccountId) {
      params.set("interestEarnedAmount", interestEarnedAmount);
      params.set("interestEarnedDate", interestEarnedDate);
      params.set("interestEarnedIncomeAccountId", interestEarnedIncomeAccountId);
    }
    router.push(`/all-apps/reconcile/session/${accountId}?${params.toString()}`);
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
          <p className="text-sm text-[var(--color-text-disabled)]">No reconcilable accounts yet.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-8">
            <div>
              <p className="mb-3 text-base text-[var(--color-text-global)]">Which account do you want to reconcile?</p>
              <div className="w-64">
                <Select
                  label="Account"
                  value={accountId}
                  onChange={setAccountId}
                  options={groupedAccountOptions}
                  placeholder="Select account"
                  allowCustomValue={false}
                />
              </div>
            </div>

            {setup?.draft ? (
              <div className="flex flex-col items-start gap-4 rounded-lg border border-[var(--color-divider-tertiary)] p-4">
                <p className="text-sm text-[var(--color-text-primary)]">
                  You have a reconciliation in progress for the statement ending {setup.draft.statementEndingDate} ({formatMoney(setup.draft.statementEndingBalance)}).
                </p>
                <div className="flex gap-3">
                  <Button type="button" onClick={() => router.push(`/all-apps/reconcile/session/${accountId}?resume=1`)}>
                    Resume reconciling
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleStartOver} disabled={discardingDraft}>
                    Start over
                  </Button>
                </div>
              </div>
            ) : null}

            <div className={setup?.draft ? "hidden" : undefined}>
              <p className="text-base text-[var(--color-text-global)]">Add the following information*</p>
              {setup?.lastReconciliationId && setup.lastStatementEndingDate ? (
                <Link href={`/all-apps/reconcile/report/${setup.lastReconciliationId}`} className="mb-3 inline-block text-xs text-[var(--color-link-action)] hover:underline">
                  Last statement ending date {setup.lastStatementEndingDate}
                </Link>
              ) : (
                <div className="mb-3" />
              )}
              {setup && !setup.beginningBalanceMatchesLastStatement ? (
                <p role="alert" className="mb-3 max-w-xl rounded border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning-text)]">
                  Your beginning balance ({formatPlain(setup.beginningBalance)}) doesn&apos;t match the ending balance of your last reconciled statement (
                  {formatPlain(setup.lastStatementEndingBalance ?? 0)}). A transaction that was already reconciled has since been changed, voided, or un-reconciled.
                  See the{" "}
                  <Link href={`/all-apps/reconcile/discrepancies/${accountId}`} className="underline">
                    reconciliation discrepancy report
                  </Link>{" "}
                  for what changed before continuing.
                </p>
              ) : null}
              <div className="flex flex-wrap items-start gap-6">
                <div className="w-40">
                  <p className="mb-1 text-sm font-semibold text-[var(--color-text-global)]">Beginning balance</p>
                  <p className="flex h-9 items-center text-sm text-[var(--color-text-primary)]">{formatPlain(beginningBalance)}</p>
                </div>
                <div className="w-56">
                  <NumberField
                    label={endingBalanceLabel}
                    currency
                    placeholder="0.00"
                    value={statementEndingBalance}
                    onChange={(e) => setStatementEndingBalance(e.target.value)}
                    onFocus={() => setFocusedField("endingBalance")}
                    onBlur={() => handleFieldBlur("endingBalance")}
                    hint={endingBalanceHint}
                    error={endingBalanceError}
                  />
                </div>
                <div className="w-56">
                  <InputField
                    label={endingDateLabel}
                    type="date"
                    value={statementEndingDate}
                    onChange={(e) => setStatementEndingDate(e.target.value)}
                    onFocus={() => setFocusedField("endingDate")}
                    onBlur={() => handleFieldBlur("endingDate")}
                    hint={endingDateHint}
                    error={endingDateError}
                  />
                </div>
              </div>
            </div>

            {adjustmentKind === "serviceChargeAndInterest" ? (
              <div>
                <p className="mb-3 text-base text-[var(--color-text-global)]">Enter the service charge or interest earned, if necessary</p>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-wrap items-start gap-6">
                    <div className="w-44">
                      <InputField label="Date" type="date" value={serviceChargeDate} onChange={(e) => setServiceChargeDate(e.target.value)} />
                    </div>
                    <div className="w-40">
                      <NumberField label="Service charge" currency placeholder="0.00" value={serviceChargeAmount} onChange={(e) => setServiceChargeAmount(e.target.value)} />
                    </div>
                    <div className="w-56">
                      <Select
                        label="Expense account"
                        value={serviceChargeExpenseAccountId}
                        onChange={setServiceChargeExpenseAccountId}
                        options={expenseAccountOptions}
                        placeholder="Account"
                        allowCustomValue={false}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-start gap-6">
                    <div className="w-44">
                      <InputField label="Date" type="date" value={interestEarnedDate} onChange={(e) => setInterestEarnedDate(e.target.value)} />
                    </div>
                    <div className="w-40">
                      <NumberField label="Interest earned" currency placeholder="0.00" value={interestEarnedAmount} onChange={(e) => setInterestEarnedAmount(e.target.value)} />
                    </div>
                    <div className="w-56">
                      <Select
                        label="Income account"
                        value={interestEarnedIncomeAccountId}
                        onChange={setInterestEarnedIncomeAccountId}
                        options={incomeAccountOptions}
                        placeholder="Account"
                        allowCustomValue={false}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {adjustmentKind === "financeCharge" ? (
              <div>
                <p className="mb-3 text-base text-[var(--color-text-global)]">Enter the finance charge, if necessary</p>
                <div className="flex flex-wrap items-start gap-6">
                  <div className="w-44">
                    <InputField label="Date" type="date" value={serviceChargeDate} onChange={(e) => setServiceChargeDate(e.target.value)} />
                  </div>
                  <div className="w-40">
                    <NumberField label="Finance charge" currency placeholder="0.00" value={serviceChargeAmount} onChange={(e) => setServiceChargeAmount(e.target.value)} />
                  </div>
                  <div className="w-56">
                    <Select
                      label="Expense account"
                      value={serviceChargeExpenseAccountId}
                      onChange={setServiceChargeExpenseAccountId}
                      options={expenseAccountOptions}
                      placeholder="Account"
                      allowCustomValue={false}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <div className={setup?.draft ? "hidden" : undefined}>
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
              <IconButton icon={Printer} label="Print" size="sm" onClick={() => window.print()} />
              <IconButton icon={Share} label="Export" size="sm" onClick={() => window.print()} />
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
                {!summaryHydrated ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                      Loading…
                    </td>
                  </tr>
                ) : summaryRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-sm text-[var(--color-text-primary)]">
                      Each time you reconcile this account, the reconciliation report is saved here. If you're ready to reconcile now, click the Reconcile tab.
                    </td>
                  </tr>
                ) : (
                  summaryRecords.map((record) => {
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
                options={groupedAccountOptions}
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

          {accountId ? (
            <p className="mb-2 text-sm">
              <Link href={`/all-apps/reconcile/discrepancies/${accountId}`} className="text-[var(--color-link-action)] hover:underline">
                Reconciliation discrepancy report
              </Link>
            </p>
          ) : null}
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
                {!historyHydrated ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                      Loading…
                    </td>
                  </tr>
                ) : historyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-sm text-[var(--color-text-primary)]">
                      Each time you reconcile this account, the reconciliation report is saved here. If you're ready to reconcile now, click the Reconcile tab.
                    </td>
                  </tr>
                ) : (
                  historyRecords.map((record) => (
                    <tr key={record.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                      <td className="p-2 align-top text-[13px] text-[var(--color-text-primary)]">{record.statementEndingDate}</td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">
                        {new Date(record.completedAt).toLocaleDateString()}
                      </td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">
                        {formatMoney(record.statementEndingBalance)}
                      </td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{record.enteredCount}</td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-primary)]">
                        {record.discrepancyAdjustmentAmount !== null ? formatMoney(record.discrepancyAdjustmentAmount) : "0.00"}
                      </td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">
                        {attachments
                          .filter((attachment) => attachment.reconciliationId === record.id)
                          .map((attachment) => (
                            <div key={attachment.id} className="flex items-center gap-2">
                              <button type="button" onClick={() => downloadReconciliationAttachment(attachment).catch(() => toast({ variant: "error", title: "Couldn't download that file" }))} className="text-[var(--color-link-action)] hover:underline">
                                {attachment.fileName}
                              </button>
                              <button type="button" aria-label={`Remove ${attachment.fileName}`} onClick={() => handleRemoveAttachment(attachment)} className="text-xs text-[var(--color-text-disabled)] hover:text-[var(--color-text-global)]">
                                ×
                              </button>
                            </div>
                          ))}
                        <button type="button" onClick={() => {
                          setAttachTargetId(record.id);
                          fileInputRef.current?.click();
                        }} className="text-[var(--color-link-action)] hover:underline">
                          Attach
                        </button>
                      </td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link href={`/all-apps/reconcile/report/${record.id}`} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
                            View report
                          </Link>
                          <DropdownMenu
                            trigger={(triggerProps) => (
                              <button
                                type="button"
                                aria-label="More report actions"
                                {...triggerProps}
                                className="rounded p-1 text-[var(--color-link-action)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                              >
                                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                              </button>
                            )}
                            items={[
                              { label: "Print report", onSelect: () => router.push(`/all-apps/reconcile/report/${record.id}?print=1`) },
                              // Only the most recent session can be undone (rows are newest first).
                              ...(record.id === historyRecords[0]?.id ? [{ label: "Undo", onSelect: () => setUndoTarget(record) }] : [])
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <input
        type="file"
        className="hidden"
        ref={fileInputRef}
        onChange={(event) => {
          handleAttachFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <Modal open={undoTarget !== null} onClose={() => setUndoTarget(null)} title="Undo this reconciliation?" size="sm">
        <p className="mb-3 text-sm text-[var(--color-text-primary)]">
          This removes the reconciliation for the statement ending {undoTarget?.statementEndingDate}. Its transactions go back to unreconciled, and any
          service charge, interest or adjustment entry that was added with it is removed.
        </p>
        <p className="mb-6 text-sm text-[var(--color-text-primary)]">You can reconcile the same statement again afterwards.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setUndoTarget(null)}>
            Cancel
          </Button>
          <Button onClick={handleConfirmUndo} disabled={undoing}>
            {undoing ? "Undoing…" : "Undo reconciliation"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
