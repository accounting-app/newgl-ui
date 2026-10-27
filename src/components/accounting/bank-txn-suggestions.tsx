"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, CircleHelp, Sparkles, ThumbsDown, ThumbsUp } from "lucide-react";
import { suggestCategorization } from "@/lib/services/ai-service";
import type { CategorizationSuggestion } from "@/lib/services/ai-service";
import type { SelectOption } from "@/components/ui/select";
import { getStoredSuggestion, storeSuggestion, suggestionKey } from "@/lib/bank-txn-suggestions-store";

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
  /** Opens the contact panel pre-filled with the AI's merchant guess. */
  onAddSuggestedPayee: (prefill: { name: string; website: string | null }) => void;
};

type State =
  | { status: "loading" }
  | { status: "ready"; suggestion: CategorizationSuggestion }
  | { status: "error"; message: string; settingsLink: boolean };

function explainError(error: unknown): { message: string; settingsLink: boolean } {
  const text = error instanceof Error ? error.message : "";
  if (/turned off/i.test(text)) return { message: "AI features are turned off for this account.", settingsLink: true };
  if (/quota/i.test(text)) return { message: "You've used this month's AI actions. Suggestions will be back when the limit resets.", settingsLink: true };
  return { message: "Suggestions aren't available right now.", settingsLink: false };
}

const NOTICE = "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-text-global)] bg-[color-mix(in_srgb,var(--color-warning-text)_16%,transparent)]";

const INFO_NOTICE = "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-[var(--color-text-global)] bg-[color-mix(in_srgb,var(--color-link-action)_16%,transparent)]";

function InfoDot() {
  return (
    <span aria-hidden="true" className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-link-action)] text-[11px] font-bold leading-none text-white">
      i
    </span>
  );
}

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
export function BankTxnSuggestions({ txn, accountOptions, payeeOptions, onApplyAccount, onApplyPayee, onAddSuggestedPayee }: BankTxnSuggestionsProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [expanded, setExpanded] = useState(true);
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  // Bumped by "Try again" so the effect below runs another request.
  const [attempt, setAttempt] = useState(0);

  const amount = txn.received ? txn.received : -(txn.spent ?? 0);
  // Based on the bank text and amount only: editing the payee or memo afterwards
  // must not trigger (and spend) another AI call.
  const payeeText = txn.description;
  const cacheKey = suggestionKey({ payee: payeeText, amount });

  useEffect(() => {
    let cancelled = false;
    const cached = getStoredSuggestion(txn.id, cacheKey);
    if (cached) {
      setState({ status: "ready", suggestion: cached });
      return;
    }
    setState({ status: "loading" });
    suggestCategorization([{ payee: payeeText, amount }])
      .then((results) => {
        if (cancelled) return;
        const suggestion = results[0];
        if (!suggestion) throw new Error("No suggestion came back.");
        storeSuggestion(txn.id, cacheKey, suggestion);
        setState({ status: "ready", suggestion });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", ...explainError(error) });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cacheKey already covers every input
  }, [cacheKey, attempt]);

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
              ) : (
                <>
                  {" "}
                  <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-medium underline">
                    Try again
                  </button>
                </>
              )}
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
        ) : suggestion?.payeeSuggestion ? (
          <div>
            <div className={INFO_NOTICE}>
              <span>New {contactKind} for you</span>
              <InfoDot />
            </div>
            <p className="mt-3 text-lg font-semibold text-[var(--color-text-global)]">{suggestion.payeeSuggestion.name}</p>
            {suggestion.payeeSuggestion.description ? (
              <p className="mt-1 text-base leading-relaxed text-[var(--color-text-primary)]">{suggestion.payeeSuggestion.description}</p>
            ) : null}
            <div className="mt-2 flex items-end justify-between gap-3">
              {suggestion.payeeSuggestion.website ? (
                <a href={`https://${suggestion.payeeSuggestion.website}`} target="_blank" rel="noopener noreferrer" className="text-base text-[var(--color-link-action)] underline">
                  {`www.${suggestion.payeeSuggestion.website}`}
                </a>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => onAddSuggestedPayee({ name: suggestion.payeeSuggestion!.name, website: suggestion.payeeSuggestion!.website })}
                className="shrink-0 rounded-md border border-[var(--color-divider-tertiary)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
              >
                Add to {contactKind} list
              </button>
            </div>
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
