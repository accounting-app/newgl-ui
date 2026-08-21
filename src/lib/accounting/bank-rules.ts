import type { BankRule, BankRuleCondition } from "@/modules/accounting/domain/models";

export type MatchableRow = { payee: string; memo: string; amount: number | null };

function textValue(row: MatchableRow, field: "payee" | "memo"): string {
  return (field === "payee" ? row.payee : row.memo).toLowerCase();
}

function conditionMatches(row: MatchableRow, condition: BankRuleCondition): boolean {
  if (condition.field === "amount") {
    if (row.amount === null) return false;
    const value = Number(condition.value);
    if (!Number.isFinite(value)) return false;
    switch (condition.operator) {
      case "greater_than":
        return row.amount > value;
      case "less_than":
        return row.amount < value;
      case "between": {
        const valueTo = Number(condition.valueTo);
        if (!Number.isFinite(valueTo)) return false;
        const [low, high] = value <= valueTo ? [value, valueTo] : [valueTo, value];
        return row.amount >= low && row.amount <= high;
      }
      default:
        return false;
    }
  }

  const haystack = textValue(row, condition.field);
  const needle = condition.value.toLowerCase();
  switch (condition.operator) {
    case "contains":
      return haystack.includes(needle);
    case "not_contains":
      return !haystack.includes(needle);
    case "equals":
      return haystack === needle;
    case "starts_with":
      return haystack.startsWith(needle);
    case "regex": {
      const rawValue = condition.field === "payee" ? row.payee : row.memo;
      try {
        return new RegExp(condition.value, "i").test(rawValue);
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

function directionMatches(rule: BankRule, row: MatchableRow): boolean {
  if (rule.direction === "ANY" || row.amount === null) return true;
  return rule.direction === "OUTFLOW" ? row.amount < 0 : row.amount > 0;
}

/**
 * A rule matches a row when it's enabled, every condition matches (AND), its
 * direction (money in/out/either) fits the row's amount sign, and -- when the
 * rule is scoped to a specific account -- the import's main account matches.
 */
export function ruleMatchesRow(rule: BankRule, row: MatchableRow, mainAccountId?: string): boolean {
  if (!rule.enabled) return false;
  if (rule.scopedAccountId && rule.scopedAccountId !== mainAccountId) return false;
  if (!directionMatches(rule, row)) return false;
  return rule.conditions.every((condition) => conditionMatches(row, condition));
}

/**
 * First matching rule for a row, highest priority first (rules are already
 * sorted that way by the API). Returns null when nothing matches -- callers
 * decide what to do with that (leave the row's category alone, in the CSV
 * import wizard).
 */
export function findMatchingRule(rules: BankRule[], row: MatchableRow, mainAccountId?: string): BankRule | null {
  return rules.find((rule) => ruleMatchesRow(rule, row, mainAccountId)) ?? null;
}
