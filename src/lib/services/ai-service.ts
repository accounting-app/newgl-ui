import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";
import type { ColumnMapping } from "@/modules/accounting/domain/csv-import";
import type { Tenant } from "@/lib/tenant/tenant-provider";

// Keys newgl-ai returns -- matches newgl-ai's COLUMN_MAPPING_TARGET_FIELDS,
// distinct from the frontend's ColumnMapping field names (translated below).
type BackendColumnMapping = Partial<
  Record<"transactionDate" | "payee" | "memo" | "amount" | "referenceNumber", number | null>
>;

type ColumnMappingResponse = {
  mapping: BackendColumnMapping;
  usage: { actions: number; inputTokens: number; outputTokens: number };
  keySource: "platform" | "byok";
};

// AI never suggests debitColumn/creditColumn -- those only exist for the
// two-column amount mode, which the target field list doesn't cover
// (AI_INTEGRATION_PLAN.md Part 7, feature #1).
export async function suggestColumnMapping(
  csvHeader: string[],
  sampleRows: string[][]
): Promise<Partial<ColumnMapping>> {
  const result = await request<ColumnMappingResponse>(BASE_API_URL, "/ai/column-mapping", {
    method: "POST",
    body: JSON.stringify({ csvHeader, sampleRows: sampleRows.slice(0, 3) })
  });

  return {
    dateColumn: result.mapping.transactionDate ?? null,
    payeeColumn: result.mapping.payee ?? null,
    descriptionColumn: result.mapping.memo ?? null,
    amountColumn: result.mapping.amount ?? null,
    referenceColumn: result.mapping.referenceNumber ?? null
  };
}

export type CategorizationSuggestion = {
  accountId: string | null;
  confidence: number | null;
  resolvedBy: "rule" | "ai";
};

type CategorizeResponse = {
  results: CategorizationSuggestion[];
  usage: { actions: number; inputTokens: number; outputTokens: number };
  keySource: "platform" | "byok" | null;
};

// Results are index-aligned with the input array -- caller matches them back
// to rows by position (AI_INTEGRATION_PLAN.md Part 7, feature #3).
export async function suggestCategorization(
  transactions: { payee: string; memo?: string; amount: number }[]
): Promise<CategorizationSuggestion[]> {
  const result = await request<CategorizeResponse>(BASE_API_URL, "/ai/categorize", {
    method: "POST",
    body: JSON.stringify({ transactions })
  });
  return result.results;
}

// Fire-and-forget from the caller's point of view (AI_INTEGRATION_PLAN.md
// Part 7, feature #2 closing the loop with feature #3): every confirmed
// import row teaches the payee->account mapping, so next time that payee
// shows up it resolves via a learned rule instead of a fresh model call.
export async function learnPayeeRules(rules: { payee: string; accountId: string }[]): Promise<void> {
  if (rules.length === 0) return;
  await request(BASE_API_URL, "/ai/rules/learn", {
    method: "POST",
    body: JSON.stringify({ rules })
  });
}

export async function setAiFeaturesEnabled(aiEnabled: boolean): Promise<Tenant> {
  return request<Tenant>(BASE_API_URL, "/tenants/ai-enabled", {
    method: "PATCH",
    body: JSON.stringify({ aiEnabled })
  });
}
