"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InputField } from "@/components/ui/input-field";
import { SelectField } from "@/components/bank-register/select-field";
import { useToast } from "@/components/ui/toast/toast-context";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type {
  Account,
  BankRule,
  BankRuleCondition,
  BankRuleDirection,
  BankRuleField,
  BankRuleOperator
} from "@/modules/accounting/domain/models";

// Portable subset of a rule: what export/import/duplicate move around.
// Deliberately excludes id/createdAt/updatedAt -- importing into another
// company (or re-importing a backup) should always create fresh rules, not
// try to reuse another tenant's ids.
type PortableRule = {
  name: string;
  targetAccountId: string;
  conditions: BankRuleCondition[];
  enabled: boolean;
  priority: number;
  autoPost: boolean;
  direction: BankRuleDirection;
  scopedAccountId?: string;
};

function toPortableRule(rule: BankRule): PortableRule {
  return {
    name: rule.name,
    targetAccountId: rule.targetAccountId,
    conditions: rule.conditions,
    enabled: rule.enabled,
    priority: rule.priority,
    autoPost: rule.autoPost,
    direction: rule.direction,
    scopedAccountId: rule.scopedAccountId
  };
}

function isPortableRule(value: unknown): value is PortableRule {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === "string" &&
    typeof candidate.targetAccountId === "string" &&
    Array.isArray(candidate.conditions) &&
    candidate.conditions.length > 0
  );
}

const DIRECTION_OPTIONS: { value: BankRuleDirection; label: string }[] = [
  { value: "ANY", label: "Either direction" },
  { value: "INFLOW", label: "Money in" },
  { value: "OUTFLOW", label: "Money out" }
];

const FIELD_OPTIONS = [
  { value: "payee", label: "Payee" },
  { value: "memo", label: "Memo" },
  { value: "rawMemo", label: "Raw bank memo" },
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

const FIELD_LABELS: Record<BankRuleField, string> = {
  payee: "Payee",
  memo: "Memo",
  rawMemo: "Raw bank memo",
  amount: "Amount"
};
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
  const { toast } = useToast();
  const [rules, setRules] = useState<BankRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [conditions, setConditions] = useState<DraftCondition[]>([emptyCondition()]);
  const [direction, setDirection] = useState<BankRuleDirection>("ANY");
  const [scopedAccountId, setScopedAccountId] = useState("");
  const [autoPost, setAutoPost] = useState(false);
  const [creating, setCreating] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const accountOptions = useMemo(
    () =>
      accounts
        .filter((a) => a.status !== "ARCHIVED")
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );

  const scopedAccountOptions = useMemo(
    () => [{ value: "", label: "Any account" }, ...accountOptions],
    [accountOptions]
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
      toast({ variant: "error", title: "Add at least one condition with a value." });
      return;
    }

    setCreating(true);
    try {
      await services.bankRuleService.createRule({
        name: name.trim(),
        targetAccountId,
        conditions: validConditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value.trim(),
          valueTo: c.operator === "between" ? c.valueTo.trim() || undefined : undefined
        })),
        direction,
        scopedAccountId: scopedAccountId || undefined,
        autoPost
      });
      toast({ variant: "success", title: "Rule created", description: `"${name.trim()}" was added.` });
      setName("");
      setTargetAccountId("");
      setConditions([emptyCondition()]);
      setDirection("ANY");
      setScopedAccountId("");
      setAutoPost(false);
      await loadAll();
    } catch (err) {
      toast({ variant: "error", title: "Could not create this rule", description: err instanceof Error ? err.message : undefined });
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleEnabled(rule: BankRule) {
    setBusyId(rule.id);
    try {
      await services.bankRuleService.updateRule(rule.id, { enabled: !rule.enabled });
      await loadAll();
      toast({ variant: "success", title: rule.enabled ? "Rule disabled" : "Rule enabled", description: `"${rule.name}"` });
    } catch (err) {
      toast({ variant: "error", title: "Could not update this rule", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(rule: BankRule) {
    setBusyId(rule.id);
    try {
      await services.bankRuleService.deleteRule(rule.id);
      await loadAll();
      toast({ variant: "success", title: "Rule deleted", description: `"${rule.name}" was removed.` });
    } catch (err) {
      toast({ variant: "error", title: "Could not delete this rule", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  function handleDuplicate(rule: BankRule) {
    setName(`${rule.name} (copy)`);
    setTargetAccountId(rule.targetAccountId);
    setConditions(
      rule.conditions.map((c) => ({
        field: c.field,
        operator: c.operator,
        value: c.value,
        valueTo: c.valueTo ?? ""
      }))
    );
    setDirection(rule.direction);
    setScopedAccountId(rule.scopedAccountId ?? "");
    setAutoPost(rule.autoPost);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleExport() {
    const payload = { version: 1, rules: rules.map(toPortableRule) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "bank-rules.json";
    anchor.click();
    URL.revokeObjectURL(url);
    toast({ variant: "success", title: `Exported ${rules.length} rule${rules.length === 1 ? "" : "s"}` });
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const candidates = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { rules?: unknown })?.rules)
          ? (parsed as { rules: unknown[] }).rules
          : null;
      if (!candidates) {
        throw new Error("Not a recognized bank rules file.");
      }

      let created = 0;
      const failures: string[] = [];
      for (const candidate of candidates) {
        if (!isPortableRule(candidate)) {
          failures.push("Skipped a malformed rule entry.");
          continue;
        }
        try {
          await services.bankRuleService.createRule({
            name: candidate.name,
            targetAccountId: candidate.targetAccountId,
            conditions: candidate.conditions,
            enabled: candidate.enabled,
            priority: candidate.priority,
            autoPost: candidate.autoPost,
            direction: candidate.direction,
            scopedAccountId: candidate.scopedAccountId
          });
          created += 1;
        } catch (err) {
          failures.push(`${candidate.name}: ${err instanceof Error ? err.message : "failed"}`);
        }
      }

      await loadAll();
      if (failures.length > 0) {
        toast({
          variant: "error",
          title: `Imported ${created} of ${candidates.length} rule${candidates.length === 1 ? "" : "s"}`,
          description: failures.join("\n")
        });
      } else {
        toast({ variant: "success", title: `Imported ${created} rule${created === 1 ? "" : "s"}` });
      }
    } catch (err) {
      toast({ variant: "error", title: "Could not read this file", description: err instanceof Error ? err.message : undefined });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <Card
        title="New rule"
        description="Every condition must match (AND). Rules run alongside AI suggestions during CSV import — AI's suggestion is used by default when both apply, with the rule shown as an option to switch to instead."
        className="mb-6"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <InputField
                label="Rule name"
                type="text"
                placeholder="e.g. Amazon over $500"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="w-56">
              <SelectField
                label="Categorize as"
                value={targetAccountId}
                onChange={setTargetAccountId}
                options={accountOptions}
                placeholder="Select an account"
                allowCustomValue={false}
              />
            </div>
            <div className="w-44">
              <SelectField
                label="Direction"
                value={direction}
                onChange={(value) => setDirection(value as BankRuleDirection)}
                options={DIRECTION_OPTIONS}
                placeholder="Direction"
                allowCustomValue={false}
              />
            </div>
            <div className="w-56">
              <SelectField
                label="Applies to account"
                value={scopedAccountId}
                onChange={setScopedAccountId}
                options={scopedAccountOptions}
                placeholder="Any account"
                allowCustomValue={false}
              />
            </div>
          </div>

          <Checkbox
            id="bank-rule-auto-post"
            label="Auto-post matched transactions during CSV import"
            checked={autoPost}
            onChange={(e) => setAutoPost(e.target.checked)}
          />

          <div className="flex flex-col gap-2">
            {conditions.map((condition, index) => (
              <div key={index} className="flex flex-wrap items-end gap-2">
                <div className="w-32">
                  <SelectField
                    label="Field"
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
                  <SelectField
                    label="Condition"
                    value={condition.operator}
                    onChange={(value) => updateCondition(index, { operator: value as BankRuleOperator })}
                    options={operatorOptionsFor(condition.field)}
                    placeholder="Operator"
                    allowCustomValue={false}
                    optionSize="sm"
                  />
                </div>
                <div className="w-36">
                  <InputField
                    label={condition.operator === "between" ? "From" : "Value"}
                    type={condition.field === "amount" ? "number" : "text"}
                    value={condition.value}
                    onChange={(e) => updateCondition(index, { value: e.target.value })}
                  />
                </div>
                {condition.operator === "between" ? (
                  <div className="w-36">
                    <InputField
                      label="To"
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

          <div>
            <Button type="submit" disabled={creating || !name.trim() || !targetAccountId}>
              {creating ? "Creating…" : "Create rule"}
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Rules" description="Highest priority first. Disabled rules never match.">
        <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-[var(--color-divider-tertiary)] pb-4">
          <Button type="button" variant="secondary" onClick={handleExport} disabled={rules.length === 0}>
            Export rules
          </Button>
          <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? "Importing…" : "Import rules"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleImportFile(file);
            }}
          />
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-[var(--color-negative)]">{loadError}</p>
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
                    {rule.autoPost ? (
                      <span className="ml-2 text-xs font-normal text-[var(--color-action-standard)]">Auto-post</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-[var(--color-icon-secondary)]">
                    {rule.conditions.map(summarizeCondition).join(" and ")} → {accountNameById.get(rule.targetAccountId) ?? rule.targetAccountId}
                    {rule.direction !== "ANY" ? ` · ${rule.direction === "INFLOW" ? "money in" : "money out"}` : ""}
                    {rule.scopedAccountId ? ` · only ${accountNameById.get(rule.scopedAccountId) ?? rule.scopedAccountId}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" onClick={() => handleDuplicate(rule)}>
                    Duplicate
                  </Button>
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
      </Card>
    </>
  );
}
