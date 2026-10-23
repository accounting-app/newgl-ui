"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, CircleHelp, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { suggestCategorization } from "@/lib/services/ai-service";
import type { CategorizationSuggestion } from "@/lib/services/ai-service";
import type { SelectOption } from "@/components/ui/select";

type SuggestionTxn = {
  id: string;
  description: string;
  payee?: string;
  memo?: string;
  spent?: number;
  received?: number;
  categoryAccountId?: string;
};

type BankTxnSuggestionsProps = {
  txn: SuggestionTxn;
  accountOptions: SelectOption[];
  payeeOptions: SelectOption[];
  onApplyAccount: (accountId: string) => void;
  onApplyPayee: (name: string) => void;
};

type State =
  | { status: "loading" }
  | { status: "ready"; suggestion: CategorizationSuggestion }
  | { status: "error"; message: string; settingsLink: boolean };

// One model call per row per session: re-opening the panel (or toggling the
// switch) reuses the answer instead of spending another AI action. Keyed by
// everything the call is based on, so editing the payee/memo asks again.
const suggestionCache = new Map<string, CategorizationSuggestion>();

function explainError(error: unknown): { message: string; settingsLink: boolean } {
  const text = error instanceof Error ? error.message : "";
  if (/turned off/i.test(text)) return { message: "AI features are turned off for this account.", settingsLink: true };
  if (/quota/i.test(text)) return { message: "You've used this month's AI actions. Suggestions will be back when the limit resets.", settingsLink: true };
  return { message: text || "Suggestions aren't available right now.", settingsLink: false };
}

const NOTICE = "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-text-global)] bg-[color-mix(in_srgb,var(--color-warning-text)_16%,transparent)]";

function WarnDot() {
  return (
    <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning-text)] text-[11px] font-bold leading-none text-white">
      !
    </span>
  );
}

// QBO's Suggestions card: the AI's account pick (with its reasoning behind a
// chevron), plus a contact match. Account suggestions come from newgl-ai's
// categorize endpoint -- the same quota, BYOK and "AI off" rules as CSV import.
export function BankTxnSuggestions({ txn, accountOptions, payeeOptions, onApplyAccount, onApplyPayee }: BankTxnSuggestionsProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [expanded, setExpanded] = useState(true);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  const amount = txn.received ? txn.received : -(txn.spent ?? 0);
  const payeeText = txn.payee || txn.description;
  const cacheKey = `${txn.id}|${payeeText}|${txn.memo ?? ""}|${amount}`;

  useEffect(() => {
    let cancelled = false;
    const cached = suggestionCache.get(cacheKey);
    if (cached) {
      setState({ status: "ready", suggestion: cached });
      return;
    }
    setState({ status: "loading" });
    suggestCategorization([{ payee: payeeText, memo: txn.memo || undefined, amount }])
      .then((results) => {
        if (cancelled) return;
        const suggestion = results[0];
        if (!suggestion) throw new Error("No suggestion came back.");
        suggestionCache.set(cacheKey, suggestion);
        setState({ status: "ready", suggestion });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", ...explainError(error) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cacheKey already covers every input
  }, [cacheKey]);

  // Fill an empty Account right away, as QBO does; never overwrite one the user picked.
  const suggestedAccountId = state.status === "ready" ? state.suggestion.accountId : null;
  useEffect(() => {
    if (suggestedAccountId && !txn.categoryAccountId) onApplyAccount(suggestedAccountId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new suggestion arrives
  }, [suggestedAccountId]);

  const suggestedAccountName = accountOptions.find((o) => o.value === suggestedAccountId)?.label;
  const contactKind = txn.received ? "customer" : "vendor";
  const haystack = `${txn.description} ${txn.payee ?? ""}`.toLowerCase();
  const contactMatch = payeeOptions.find((o) => {
    const name = o.label.toLowerCase();
    return name.length > 2 && (haystack.includes(name) || name.includes(txn.description.toLowerCase()));
  });

  const suggestion = state.status === "ready" ? state.suggestion : null;
  const explainText =
    suggestion?.resolvedBy === "rule"
      ? "This payee matches a rule learned from transactions you confirmed earlier."
      : "No similar transactions were found in your books. This suggestion is based on limited text in the full bank description and categories your business generally might use.";

  return (
    <div>
      <div className="rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-global)]">
            <Sparkles className="h-5 w-5 text-[var(--color-link-action)]" aria-hidden="true" />
            Suggestions
          </h3>
          <span className="group relative flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
            Explain why
            <button type="button" aria-label="Explain why" className="text-[var(--color-icon-secondary)]">
              <CircleHelp className="h-5 w-5" aria-hidden="true" />
            </button>
            <span
              role="tooltip"
              className="pointer-events-none absolute right-0 top-full z-10 mt-2 hidden w-64 rounded-lg bg-[#21262a] p-3 text-sm leading-snug text-white shadow-lg group-focus-within:block group-hover:block"
            >
              {explainText}
            </span>
          </span>
        </div>

        {state.status === "loading" ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-9 animate-pulse rounded-md bg-[var(--color-container-background-accent)]" />
            <div className="h-6 w-2/3 animate-pulse rounded-md bg-[var(--color-container-background-accent)]" />
          </div>
        ) : state.status === "error" ? (
          <div className={NOTICE}>
            <span>
              {state.message}
              {state.settingsLink ? (
                <>
                  {" "}
                  <Link href="/settings/ai" className="font-medium underline">
                    AI settings
                  </Link>
                </>
              ) : null}
            </span>
            <WarnDot />
          </div>
        ) : (
          <>
            <div className={NOTICE}>
              <span>
                {suggestion?.resolvedBy === "rule"
                  ? "Based on a rule learned from your earlier transactions."
                  : "Based on transaction details. No related historical transactions."}
              </span>
              <WarnDot />
            </div>

            {suggestedAccountName ? (
              <div className="mt-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    aria-expanded={expanded}
                    className="flex items-center gap-3 py-2 text-left text-lg font-medium text-[var(--color-text-global)]"
                  >
                    {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
                    {suggestedAccountName}
                  </button>
                  {txn.categoryAccountId !== suggestedAccountId ? (
                    <button type="button" onClick={() => suggestedAccountId && onApplyAccount(suggestedAccountId)} className="text-sm font-medium text-[var(--color-link-action)] hover:underline">
                      Apply
                    </button>
                  ) : null}
                </div>
                {expanded && suggestion?.reason ? (
                  <p className="rounded-md bg-[var(--color-container-background-accent)] px-4 py-3 text-base leading-relaxed text-[var(--color-text-primary)]">{suggestion.reason}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm text-[var(--color-text-primary)]">No account suggestion for this transaction.</p>
            )}
          </>
        )}

        <hr className="my-4 border-[var(--color-divider-tertiary)]" />

        {contactMatch ? (
          <div className="flex items-center justify-between gap-3 rounded-md bg-[var(--color-container-background-accent)] px-3 py-2 text-sm text-[var(--color-text-global)]">
            <span>
              {contactKind === "customer" ? "Customer" : "Vendor"} found: <strong>{contactMatch.label}</strong>
            </span>
            {txn.payee !== contactMatch.label ? (
              <button type="button" onClick={() => onApplyPayee(contactMatch.value)} className="font-medium text-[var(--color-link-action)] hover:underline">
                Apply
              </button>
            ) : null}
          </div>
        ) : (
          <div className={NOTICE}>
            <span>No {contactKind} found</span>
            <WarnDot />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 text-sm text-[var(--color-icon-secondary)]">
        Was this helpful?
        <button type="button" aria-label="Helpful" aria-pressed={vote === "up"} onClick={() => setVote(vote === "up" ? null : "up")} className={vote === "up" ? "text-[var(--color-link-action)]" : "hover:text-[var(--color-text-global)]"}>
          <ThumbsUp className="h-5 w-5" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Not helpful" aria-pressed={vote === "down"} onClick={() => setVote(vote === "down" ? null : "down")} className={vote === "down" ? "text-[var(--color-link-action)]" : "hover:text-[var(--color-text-global)]"}>
          <ThumbsDown className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
