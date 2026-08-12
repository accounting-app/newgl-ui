"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { SelectField } from "@/components/bank-register/select-field";
import { SettingsCard } from "@/components/settings/settings-card";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Account, BankRule, BankRuleCondition, BankRuleField, BankRuleOperator } from "@/modules/accounting/domain/models";

const FIELD_OPTIONS = [
  { value: "payee", label: "Payee" },
  { value: "memo", label: "Memo" },
  { value: "amount", label: "Amount" }
];

const TEXT_OPERATOR_OPTIONS = [
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "equals", label: "Equals" },
  { value: "starts_with", label: "Starts with" },
  { value: "regex", label: "Matches regex" }
];

const AMOUNT_OPERATOR_OPTIONS = [
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "between", label: "Between" }
];

const FIELD_LABELS: Record<BankRuleField, string> = { payee: "Payee", memo: "Memo", amount: "Amount" };
const OPERATOR_LABELS: Record<BankRuleOperator, string> = {
  contains: "contains",
  not_contains: "does not contain",
  equals: "equals",
  starts_with: "starts with",
  regex: "matches",
  greater_than: "is greater than",
  less_than: "is less than",
  between: "is between"
};

type DraftCondition = { field: BankRuleField; operator: BankRuleOperator; value: string; valueTo: string };

function emptyCondition(): DraftCondition {
  return { field: "payee", operator: "contains", value: "", valueTo: "" };
}

function operatorOptionsFor(field: BankRuleField) {
  return field === "amount" ? AMOUNT_OPERATOR_OPTIONS : TEXT_OPERATOR_OPTIONS;
}

function summarizeCondition(condition: BankRuleCondition): string {
  const value =
    condition.operator === "between" ? `${condition.value} – ${condition.valueTo ?? ""}` : condition.value;
  return `${FIELD_LABELS[condition.field]} ${OPERATOR_LABELS[condition.operator]} "${value}"`;
}

export function BankRulesPage() {
  const services = useMemo(() => getServiceContainer(), []);
  const [rules, setRules] = useState<BankRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [conditions, setConditions] = useState<DraftCondition[]>([emptyCondition()]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.status !== "ARCHIVED")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((a) => map.set(a.id, a.name));
    return map;
  }, [accounts]);

  async function loadAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [ruleList, accountList] = await Promise.all([
        services.bankRuleService.listRules(),
        services.accountService.listAccounts()
      ]);
      setRules(ruleList);
      setAccounts(accountList);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load bank rules");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateCondition(index: number, patch: Partial<DraftCondition>) {
    setConditions((current) => current.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  function addCondition() {
    setConditions((current) => [...current, emptyCondition()]);
  }

  function removeCondition(index: number) {
    setConditions((current) => (current.length === 1 ? current : current.filter((_, i) => i !== index)));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !targetAccountId) return;
    const validConditions = conditions.filter((c) => c.value.trim() !== "");
    if (validConditions.length === 0) {
      setCreateError("Add at least one condition with a value.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await services.bankRuleService.createRule({
        name: name.trim(),
        targetAccountId,
        conditions: validConditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value.trim(),
          valueTo: c.operator === "between" ? c.valueTo.trim() || undefined : undefined
        }))
      });
      setName("");
      setTargetAccountId("");
      setConditions([emptyCondition()]);
      await loadAll();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create this rule");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleEnabled(rule: BankRule) {
    setBusyId(rule.id);
    try {
      await services.bankRuleService.updateRule(rule.id, { enabled: !rule.enabled });
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(rule: BankRule) {
    setBusyId(rule.id);
    try {
      await services.bankRuleService.deleteRule(rule.id);
      await loadAll();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <SettingsCard
        title="New rule"
        description="Every condition must match (AND). Rules run alongside AI suggestions during CSV import — AI's suggestion is used by default when both apply, with the rule shown as an option to switch to instead."
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 min-w-[200px] flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
              Rule name
              <InputField
                type="text"
                placeholder="e.g. Amazon over $500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="flex w-56 flex-col gap-1 text-xs text-[var(--color-icon-secondary)]">
              Categorize as
              <SelectField
                value={targetAccountId}
                onChange={setTargetAccountId}
                options={accountOptions}
                placeholder="Select an account"
                allowCustomValue={false}
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            {conditions.map((condition, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <div className="w-32">
                  <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">Field</p>
                  <SelectField
                    value={condition.field}
                    onChange={(value) => {
                      const field = value as BankRuleField;
                      updateCondition(index, {
                        field,
                        operator: field === "amount" ? "greater_than" : "contains"
                      });
                    }}
                    options={FIELD_OPTIONS}
                    placeholder="Field"
                    allowCustomValue={false}
                    optionSize="sm"
                  />
                </div>
                <div className="w-44">
                  <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">Condition</p>
                  <SelectField
                    value={condition.operator}
                    onChange={(value) => updateCondition(index, { operator: value as BankRuleOperator })}
                    options={operatorOptionsFor(condition.field)}
                    placeholder="Operator"
                    allowCustomValue={false}
                    optionSize="sm"
                  />
                </div>
                <div className="w-36">
                  <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">
                    {condition.operator === "between" ? "From" : "Value"}
                  </p>
                  <InputField
                    type={condition.field === "amount" ? "number" : "text"}
                    value={condition.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                  />
                </div>
                {condition.operator === "between" ? (
                  <div className="w-36">
                    <p className="mb-1 text-[11px] text-[var(--color-icon-secondary)]">To</p>
                    <InputField
                      type="number"
                      value={condition.valueTo}
                      onChange={(e) => updateCondition(index, { valueTo: e.target.value })}
                    />
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => removeCondition(index)}
                  disabled={conditions.length === 1}
                >
                  Remove
                </Button>
              </div>
            ))}
            <div>
              <Button type="button" variant="secondary" onClick={addCondition}>
                Add condition
              </Button>
            </div>
          </div>

          {createError ? <p className="text-sm text-red-600">{createError}</p> : null}
          <div>
            <Button type="submit" disabled={creating || !name.trim() || !targetAccountId}>
              {creating ? "Creating…" : "Create rule"}
            </Button>
          </div>
        </form>
      </SettingsCard>

      <SettingsCard title="Rules" description="Highest priority first. Disabled rules never match.">
        {loading ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">No rules yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-container-background-secondary)]">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-global)]">
                    {rule.name}
                    {!rule.enabled ? (
                      <span className="ml-2 text-xs font-normal text-[var(--color-text-disabled)]">(disabled)</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[var(--color-icon-secondary)]">
                    {rule.conditions.map(summarizeCondition).join(" and ")} → {accountNameById.get(rule.targetAccountId) ?? rule.targetAccountId}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" onClick={() => handleToggleEnabled(rule)} disabled={busyId === rule.id}>
                    {rule.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button variant="secondary" onClick={() => handleDelete(rule)} disabled={busyId === rule.id}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </>
  );
}
