import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";
import type { AmountColumnsMode, ColumnMapping, DateFormatOption } from "@/modules/accounting/domain/csv-import";
import type { Tenant } from "@/lib/tenant/tenant-provider";

// Keys newgl-ai returns -- matches newgl-ai's COLUMN_MAPPING_TARGET_FIELDS,
// distinct from the frontend's ColumnMapping field names (translated below).
type BackendColumnMapping = Partial<
  Record<"transactionDate" | "payee" | "memo" | "amount" | "referenceNumber", number | null>
>;

type BackendLayout = {
  hasHeaderRow: boolean | null;
  amountColumnsMode: AmountColumnsMode | null;
  dateFormat: DateFormatOption | null;
  debitColumn: number | null;
  creditColumn: number | null;
};

type ColumnMappingResponse = {
  mapping: BackendColumnMapping;
  layout?: BackendLayout;
  usage: { actions: number; inputTokens: number; outputTokens: number };
  keySource: "platform" | "byok";
};

export type ColumnMappingSuggestion = {
  mapping: Partial<ColumnMapping>;
  // Each property is null when the AI wasn't confident -- keep the user's current choice then.
  format: {
    hasHeaderRow: boolean | null;
    amountColumnsMode: AmountColumnsMode | null;
    dateFormat: DateFormatOption | null;
  };
};

// `rows` are the first raw rows of the file (the AI sees up to 4), header or
// not -- it decides whether row 0 is a header, so the caller must not
// pre-slice one off.
export async function suggestColumnMapping(rows: string[][]): Promise<ColumnMappingSuggestion> {
  const [first = [], ...rest] = rows.slice(0, 4);
  const result = await request<ColumnMappingResponse>(BASE_API_URL, "/ai/column-mapping", {
    method: "POST",
    body: JSON.stringify({ csvHeader: first, sampleRows: rest.length > 0 ? rest : [first] })
  });

  const layout = result.layout;
  return {
    mapping: {
      dateColumn: result.mapping.transactionDate ?? null,
      payeeColumn: result.mapping.payee ?? null,
      descriptionColumn: result.mapping.memo ?? null,
      amountColumn: result.mapping.amount ?? null,
      debitColumn: layout?.debitColumn ?? null,
      creditColumn: layout?.creditColumn ?? null,
      referenceColumn: result.mapping.referenceNumber ?? null
    },
    format: {
      hasHeaderRow: layout?.hasHeaderRow ?? null,
      amountColumnsMode: layout?.amountColumnsMode ?? null,
      dateFormat: layout?.dateFormat ?? null
    }
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
