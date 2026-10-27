import { BASE_API_URL } from "@/configuration";
import { request } from "@/lib/services/http-service-container";

// Recurring transaction templates for the caller's CURRENTLY ACTIVE company
// (see newgl-api's recurring-templates.ts): a saved transaction form plus a
// schedule. Scheduled ones are posted by `runDueRecurring`, which the app
// calls when it loads.
export type RecurringKind = "EXPENSE" | "CHECK" | "DEPOSIT" | "SALES_RECEIPT" | "JOURNAL_ENTRY";
export type RecurringMode = "SCHEDULED" | "REMINDER" | "UNSCHEDULED";
export type RecurringUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

export type RecurringSchedule = {
  unit: RecurringUnit;
  every: number;
  /** Day of the month, 1-31, or -1 for the last day. */
  onDay?: number;
  /** 0 (Sunday) - 6. */
  onWeekday?: number;
  /** 1-12 (yearly). */
  onMonth?: number;
  startDate: string;
  endType: "NONE" | "BY" | "AFTER";
  endDate?: string;
  endAfter?: number;
};

export type RecurringPayload = {
  referenceNumber?: string;
  memo?: string;
  payee?: string;
  accountLabel?: string;
  sourceAccountId?: string;
  postings: { accountId: string; type: "DEBIT" | "CREDIT"; amount: number }[];
};

export type RecurringTemplate = {
  id: string;
  name: string;
  kind: RecurringKind;
  mode: RecurringMode;
  daysInAdvance: number;
  schedule?: RecurringSchedule;
  occurrences: number;
  nextDate?: string;
  lastRun?: string;
  lastError?: string;
  enabled: boolean;
  payload: RecurringPayload;
  /** The form's own state (lines, method...), so Use / Edit can refill it. */
  formState?: Record<string, unknown>;
  createdAt: string;
};

export type CreateRecurringInput = {
  name: string;
  kind: RecurringKind;
  mode: RecurringMode;
  daysInAdvance?: number;
  schedule?: RecurringSchedule;
  payload: RecurringPayload;
  formState?: Record<string, unknown>;
};

export type UpdateRecurringInput = Partial<Omit<CreateRecurringInput, "kind">> & { enabled?: boolean };

/** Broadcast after the catch-up run posts something, so an open list refreshes itself. */
export const RECURRING_CHANGED_EVENT = "newgl:recurring-changed";

export const listRecurring = () => request<RecurringTemplate[]>(BASE_API_URL, "/recurring-templates");
export const createRecurring = (input: CreateRecurringInput) => request<RecurringTemplate>(BASE_API_URL, "/recurring-templates", { method: "POST", body: JSON.stringify(input) });
export const updateRecurring = (id: string, patch: UpdateRecurringInput) => request<RecurringTemplate>(BASE_API_URL, `/recurring-templates/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
export const advanceRecurring = (id: string) => request<RecurringTemplate>(BASE_API_URL, `/recurring-templates/${id}/advance`, { method: "POST" });
export async function deleteRecurring(id: string): Promise<void> {
  await request(BASE_API_URL, `/recurring-templates/${id}`, { method: "DELETE" });
}
export const runDueRecurring = () => request<{ created: number; failed: number }>(BASE_API_URL, "/recurring-templates/run", { method: "POST" });

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ordinal = (n: number) => (n === -1 ? "last day" : `${n}${["th", "st", "nd", "rd"][n % 100 >= 11 && n % 100 <= 13 ? 0 : Math.min(n % 10, 4) % 4] ?? "th"}`);

/** "Monthly on the 1st", "Every 2 weeks on Friday"... */
export function describeSchedule(s: RecurringSchedule | undefined): string {
  if (!s) return "";
  const n = s.every;
  if (s.unit === "DAY") return n === 1 ? "Daily" : `Every ${n} days`;
  if (s.unit === "WEEK") return `${n === 1 ? "Weekly" : `Every ${n} weeks`} on ${WEEKDAYS[s.onWeekday ?? 0]}`;
  if (s.unit === "MONTH") return `${n === 1 ? "Monthly" : `Every ${n} months`} on ${s.onDay === -1 ? "the last day" : `day ${ordinal(s.onDay ?? 1)}`}`;
  return `${n === 1 ? "Yearly" : `Every ${n} years`} on ${MONTHS[(s.onMonth ?? 1) - 1]} ${ordinal(s.onDay ?? 1)}`;
}
