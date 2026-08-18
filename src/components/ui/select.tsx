"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { InputField } from "@/components/ui/input-field";

export type SelectOption = {
  value: string;
  label: string;
  rightLabel?: string;
  keywords?: string[];
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
  optionSize = "default"
}: SelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const generatedId = useId();

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  useEffect(() => {
    if (allowCustomValue) {
      setQuery(value);
      return;
    }
    setQuery(selectedOption?.label ?? "");
  }, [allowCustomValue, selectedOption?.label, value]);

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
            filteredOptions.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelectOption(option)}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2 text-left ${optionTextClassName} ${
                    isSelected
                      ? "bg-[var(--color-action-passive-subtle-active)] hover:bg-[var(--color-action-passive-subtle-hover)] focus-visible:bg-[var(--color-action-passive-subtle-focus)] active:bg-[var(--color-action-passive-subtle-active)]"
                      : "hover:bg-[var(--color-action-passive-subtle-hover)]"
                  }`}
                >
                  <span className={`whitespace-nowrap ${optionLabelClassName} ${isSelected ? "font-bold" : ""}`}>
                    {option.label}
                  </span>
                  {option.rightLabel ? (
                    <span className={`shrink-0 ${optionRightLabelClassName}`}>{option.rightLabel}</span>
                  ) : null}
                </button>
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
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
