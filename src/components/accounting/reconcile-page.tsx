"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HelpCircle, Printer, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useCompany } from "@/lib/company/company-provider";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { listReconciliations, listReconciliationsForAccount, type Reconciliation } from "@/lib/services/reconciliation-service";
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

  const [view, setView] = useState<ReconcileView>("reconcile");

  const [accountId, setAccountId] = useState("");
  useEffect(() => {
    if (!accountId && reconcilableAccounts.length > 0) setAccountId(reconcilableAccounts[0].id);
  }, [reconcilableAccounts, accountId]);
  const selectedAccount = accounts.find((a) => a.id === accountId);

  const [previousReconciliation, setPreviousReconciliation] = useState<Reconciliation | null>(null);
  useEffect(() => {
    if (!accountId) return;
    listReconciliationsForAccount(accountId)
      .then((list) => setPreviousReconciliation(list[0] ?? null))
      .catch(() => setPreviousReconciliation(null));
  }, [accountId]);
  const beginningBalance = previousReconciliation?.statementEndingBalance ?? 0;

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
  useEffect(() => {
    if (!accountId) return;
    setHistoryHydrated(false);
    listReconciliationsForAccount(accountId)
      .then(setHistoryRecords)
      .catch(() => setHistoryRecords([]))
      .finally(() => setHistoryHydrated(true));
  }, [accountId]);

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
      statementStartDate: previousReconciliation?.statementEndingDate ?? (selectedAccount ? selectedAccount.createdAt.slice(0, 10) : statementEndingDate),
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

            <div>
              <p className="text-base text-[var(--color-text-global)]">Add the following information*</p>
              {previousReconciliation ? (
                <p className="mb-3 text-xs text-[var(--color-link-action)]">Last statement ending date {previousReconciliation.statementEndingDate}</p>
              ) : (
                <div className="mb-3" />
              )}
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
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">--</td>
                      <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                        <Link href={`/all-apps/reconcile/report/${record.id}`} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
                          View report
                        </Link>
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
