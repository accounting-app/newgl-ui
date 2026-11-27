"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ACCOUNT_CATEGORY_LABELS } from "@/constants/ui";
import type { Account } from "@/modules/accounting/domain/models";

type AccountSelectorProps = {
  accounts: Account[];
  selectedAccountId: string;
  onChange: (accountId: string) => void;
};

// QBO lists the register's accounts grouped by type (Bank first), each group A-Z.
const CATEGORY_ORDER: Account["category"][] = [
  "ACCOUNTS_RECEIVABLE",
  "BANK",
  "CREDIT_CARD",
  "OTHER_CURRENT_ASSET",
  "FIXED_ASSET",
  "ACCOUNTS_PAYABLE",
  "OTHER_CURRENT_LIABILITY",
  "LONG_TERM_LIABILITY",
  "EQUITY"
];

/**
 * The register's account picker, styled like QBO's: a boxed field whose text is
 * selected on focus, a gray chevron cell, and a wide list with the account name
 * on the left and its type in italics on the right.
 */
export function AccountSelector({ accounts, selectedAccountId, onChange }: AccountSelectorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filtering, setFiltering] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const options = useMemo(
    () =>
      [...accounts]
        .sort((a, b) => {
          const rank = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
          return rank !== 0 ? rank : a.name.localeCompare(b.name);
        })
        .map((account) => ({ id: account.id, name: account.name, type: ACCOUNT_CATEGORY_LABELS[account.category] })),
    [accounts]
  );
  const selected = options.find((option) => option.id === selectedAccountId);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.name]);

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!filtering || !text) return options;
    return options.filter((option) => option.name.toLowerCase().includes(text) || option.type.toLowerCase().includes(text));
  }, [filtering, options, query]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setFiltering(false);
      setQuery(selected?.name ?? "");
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, selected?.name]);

  // Keep the keyboard-highlighted row in view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${highlight}"]`)?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function openList() {
    setFiltering(false);
    setHighlight(Math.max(0, options.findIndex((option) => option.id === selectedAccountId)));
    setOpen(true);
  }

  function choose(id: string) {
    setOpen(false);
    setFiltering(false);
    if (id !== selectedAccountId) onChange(id);
    else setQuery(selected?.name ?? "");
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <div className={`flex h-[38px] w-[190px] overflow-hidden rounded border bg-[var(--color-input-background)] ${open ? "border-2 border-[var(--color-link-text)]" : "border border-[var(--color-input-border-primary)]"}`}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label="Register account"
          value={query}
          placeholder="Register account"
          className="min-w-0 flex-1 bg-transparent px-3 text-[15px] text-[var(--color-input-text)] outline-none selection:bg-[#b3d4fc]"
          onFocus={(event) => {
            event.currentTarget.select();
            openList();
          }}
          onClick={() => !open && openList()}
          onChange={(event) => {
            setQuery(event.target.value);
            setFiltering(true);
            setHighlight(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) openList();
              else setHighlight((current) => Math.min(visible.length - 1, current + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((current) => Math.max(0, current - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              const option = visible[highlight];
              if (open && option) choose(option.id);
            } else if (event.key === "Escape") {
              setOpen(false);
              setFiltering(false);
              setQuery(selected?.name ?? "");
            }
          }}
        />
        <button
          type="button"
          aria-label="Toggle account list"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (open) {
              setOpen(false);
              setFiltering(false);
              setQuery(selected?.name ?? "");
            } else {
              inputRef.current?.focus();
              openList();
            }
          }}
          className="flex w-[37px] shrink-0 items-center justify-center border-l border-[var(--color-input-border-primary)] bg-[var(--color-quickadd-background)] text-[var(--color-icon-secondary)] hover:bg-[var(--color-action-passive-subtle-hover)]"
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div
          ref={listRef}
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 max-h-[300px] w-[466px] max-w-[90vw] overflow-y-auto rounded border border-[var(--color-input-border-primary)] bg-[var(--color-container-background-primary)] shadow-[0_2px_6px_rgba(0,0,0,0.18)]"
        >
          {visible.length === 0 ? <p className="px-[10px] py-2 text-[15px] text-[var(--color-icon-secondary)]">No matches</p> : null}
          {visible.map((option, index) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === selectedAccountId}
              data-index={index}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => choose(option.id)}
              className={`flex h-[37px] w-full items-center justify-between gap-4 px-[10px] text-left text-[15px] text-[var(--color-text-primary)] ${
                index === highlight ? "bg-[var(--color-table-row-hover)]" : ""
              } ${option.id === selectedAccountId && index !== highlight ? "bg-[var(--color-table-row-hover)]" : ""}`}
            >
              <span className="truncate">{option.name}</span>
              <span className="shrink-0 italic text-[var(--color-icon-secondary)]">{option.type}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
