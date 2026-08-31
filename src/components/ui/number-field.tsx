import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { INPUT_BASE_CLASSES, INPUT_SIZE_CLASSES } from "@/components/ui/input-field";
import type { InputFieldSize } from "@/components/ui/input-field";

type NumberFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  label?: string;
  error?: string;
  hint?: string;
  size?: InputFieldSize;
  /** Right-align digits -- the accounting-app default, since amounts read better right-aligned in a column. */
  align?: "left" | "right";
  /** Renders a leading "$" affix. Purely visual -- the input's value is still a plain number string. */
  currency?: boolean;
};

// Amount inputs (register, journal entry, reports, transaction forms) kept
// reimplementing right-alignment and a "$" prefix per call site -- this is
// that pattern promoted to a real component (UI_DESIGN_SYSTEM_PLAN.md Part 1).
export const NumberField = forwardRef<HTMLInputElement, NumberFieldProps>(function NumberField(
  { label, error, hint, size = "md", align = "right", currency = false, className = "", id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const input = (
    <div className="relative">
      {currency ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-disabled)]"
        >
          $
        </span>
      ) : null}
      <input
        {...props}
        id={inputId}
        ref={ref}
        type="number"
        aria-invalid={error ? true : undefined}
        className={`${INPUT_BASE_CLASSES} ${INPUT_SIZE_CLASSES[size]} ${
          align === "right" ? "text-right" : "text-left"
        } ${currency ? "pl-6" : ""} ${className}`.trim()}
      />
    </div>
  );

  if (!label && !error && !hint) {
    return input;
  }

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={inputId} className="text-xs text-[var(--color-icon-secondary)]">
          {label}
        </label>
      ) : null}
      {input}
      {error ? (
        <p className="text-xs text-[var(--color-negative)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--color-icon-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
});
