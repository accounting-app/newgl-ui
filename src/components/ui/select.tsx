"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, HelpCircle } from "lucide-react";
import { InputField } from "@/components/ui/input-field";

export type SelectOption = {
  value: string;
  label: string;
  rightLabel?: string;
  keywords?: string[];
  /** Renders a bold, non-clickable section header above this option whenever it differs from the previous option's group (e.g. QBO's own ASSET/LIABILITY/... headers on the Account type picker). Options must already be sorted by group -- this doesn't re-group them. */
  group?: string;
  /**
   * Short helper text for this option. When set, a small (?) toggle renders
   * next to the option -- clicking it expands this text underneath, same as
   * QBO's own Account type picker. Purely opt-in: options without a
   * `description` render exactly as before.
   */
  description?: string;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  allowCustomValue?: boolean;
  optionSize?: "default" | "sm";
  /**
   * QBO-style option list: a checkmark marks the selected option (instead
   * of bold text + a strong highlight) and a subtle highlight instead.
   * Opt-in per select -- other call sites keep the existing look.
   */
  showCheckmark?: boolean;
};

// Promoted from bank-register/select-field.tsx (UI_DESIGN_SYSTEM_PLAN.md
// Part 1) -- already the most mature input in the app (search-filter,
// add-new action, custom-value support), just needed a home in ui/, its
// custom inline chevron swapped for lucide, and its option-list styling
// (previously only defined under a `.tw-override` ancestor) baked in
// directly so it renders correctly everywhere.
export function Select({
  value,
  onChange,
  options,
  placeholder,
  label,
  error,
  disabled,
  fullWidth = true,
  className = "",
  onAddNew,
  addNewLabel = "+ Add new",
  allowCustomValue = true,
  optionSize = "default",
  showCheckmark = false
}: SelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [openDescriptionValue, setOpenDescriptionValue] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const generatedId = useId();

  useEffect(() => {
    if (!isOpen) setOpenDescriptionValue(null);
  }, [isOpen]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  useEffect(() => {
    // A matched option's label always wins, even in allowCustomValue mode --
    // otherwise selecting a real option (e.g. a customer/vendor id) displays
    // its raw id instead of its name once this effect re-syncs `query` from
    // the now-changed `value` prop. Only fall back to the raw value when it
    // doesn't match any option, i.e. the user actually typed a custom value.
    if (selectedOption) {
      setQuery(selectedOption.label);
      return;
    }
    setQuery(allowCustomValue ? value : "");
  }, [allowCustomValue, selectedOption, value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (event.target instanceof Node && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        if (!allowCustomValue) {
          setQuery(selectedOption?.label ?? "");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [allowCustomValue, selectedOption?.label]);

  const filteredOptions = useMemo(() => {
    if (!isFiltering) return options;
    const text = query.trim().toLowerCase();
    if (!text) return options;
    return options.filter((option) => {
      if (option.label.toLowerCase().includes(text)) return true;
      if (option.rightLabel?.toLowerCase().includes(text)) return true;
      if (!option.keywords) return false;
      return option.keywords.some((keyword) => keyword.toLowerCase().includes(text));
    });
  }, [isFiltering, options, query]);

  function handleSelectOption(option: SelectOption) {
    setQuery(option.label);
    setIsFiltering(false);
    onChange(option.value);
    setIsOpen(false);
  }

  const optionTextClassName = optionSize === "sm" ? "text-[13px]" : "text-sm";
  const optionLabelClassName =
    optionSize === "sm" ? "text-[13px] text-[var(--color-text-primary)]" : "text-left text-[var(--color-text-primary)]";
  const optionRightLabelClassName =
    optionSize === "sm" ? "text-[13px] text-[var(--color-icon-secondary)]" : "text-right text-[var(--color-icon-secondary)]";

  const field = (
    <div
      ref={containerRef}
      className={`relative ${fullWidth ? "w-full min-w-0" : "min-w-fit w-fit"} ${className}`}
    >
      <div className="relative">
        <InputField
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          id={label ? generatedId : undefined}
          onFocus={() => setIsOpen(true)}
          onClick={() => {
            setIsOpen(true);
            setIsFiltering(false);
          }}
          onChange={(event) => {
            const text = event.target.value;
            setQuery(text);
            setIsFiltering(true);
            if (allowCustomValue) {
              onChange(text);
            }
            setIsOpen(true);
          }}
          className={`${fullWidth ? "w-full" : "w-[208px]"} pr-9`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setIsFiltering(false);
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);
            if (!nextOpen && !allowCustomValue) {
              setQuery(selectedOption?.label ?? "");
            }
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-[var(--color-icon-secondary)] hover:bg-[var(--color-action-passive-subtle-hover)] disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)]"
          aria-label="Toggle options list"
        >
          <ChevronDown className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {isOpen && !disabled ? (
        <div className="absolute left-0 z-50 mt-1 max-h-64 w-max min-w-full max-w-[min(90vw,56rem)] overflow-y-auto rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-md">
          {onAddNew ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setIsOpen(false);
                setIsFiltering(false);
                onAddNew();
              }}
              className="block w-full border-b border-[var(--color-divider-tertiary)] px-4 py-2 text-left text-sm font-medium text-[var(--color-link-text)] hover:bg-[var(--color-action-passive-subtle-hover)]"
            >
              {addNewLabel}
            </button>
          ) : null}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected = option.value === value;
              const showGroupHeader = option.group && option.group !== filteredOptions[index - 1]?.group;
              const isDescriptionOpen = openDescriptionValue === option.value;
              const rowHighlightClassName = isSelected
                ? showCheckmark
                  ? "bg-[var(--color-action-passive-subtle-hover)]"
                  : "bg-[var(--color-action-passive-subtle-active)] hover:bg-[var(--color-action-passive-subtle-hover)] focus-visible:bg-[var(--color-action-passive-subtle-focus)] active:bg-[var(--color-action-passive-subtle-active)]"
                : "hover:bg-[var(--color-action-passive-subtle-hover)]";
              return (
                <div key={option.value}>
                  {showGroupHeader ? (
                    <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
                      {option.group}
                    </p>
                  ) : null}
                  <div className={`flex items-center ${rowHighlightClassName}`}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelectOption(option)}
                      className={`grid flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2 pl-4 text-left ${optionTextClassName} ${
                        option.description ? "pr-2" : "pr-4"
                      }`}
                    >
                      <span
                        className={`flex min-w-0 items-center gap-2 whitespace-nowrap ${optionLabelClassName} ${
                          isSelected && !showCheckmark ? "font-bold" : ""
                        }`}
                      >
                        {showCheckmark ? (
                          isSelected ? (
                            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                          ) : (
                            <span className="w-4 shrink-0" aria-hidden="true" />
                          )
                        ) : null}
                        <span className="truncate">{option.label}</span>
                      </span>
                      {option.rightLabel ? (
                        <span className={`shrink-0 ${optionRightLabelClassName}`}>{option.rightLabel}</span>
                      ) : null}
                    </button>
                    {option.description ? (
                      <button
                        type="button"
                        aria-label={`About ${option.label}`}
                        aria-expanded={isDescriptionOpen}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setOpenDescriptionValue(isDescriptionOpen ? null : option.value)}
                        className="mr-3 shrink-0 rounded p-1 text-[var(--color-icon-secondary)] hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-global)]"
                      >
                        <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                  {isDescriptionOpen && option.description ? (
                    <p className="px-4 pb-2 pl-11 pr-4 text-xs text-[var(--color-icon-secondary)]">{option.description}</p>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="px-4 py-2 text-sm text-[var(--color-icon-secondary)]">No matches</p>
          )}
        </div>
      ) : null}
    </div>
  );

  if (!label && !error) {
    return field;
  }

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={generatedId} className="text-xs text-[var(--color-icon-secondary)]">
          {label}
        </label>
      ) : null}
      {field}
      {error ? <p className="text-xs text-[var(--color-negative)]">{error}</p> : null}
    </div>
  );
}
