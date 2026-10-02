import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";

export type InputFieldSize = "sm" | "md" | "lg";

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label?: string;
  error?: string;
  hint?: string;
  size?: InputFieldSize;
};

// Baseline that used to live ONLY under a `.tw-override` ancestor -- outside
// it this had no border, no intentional background/text color, just
// whatever the browser's native dark-mode form control happened to render
// (see UI_DESIGN_SYSTEM_PLAN.md Part 2). Baked in directly here.
// Exported so composite fields (NumberField) can build on the exact same
// visual base instead of duplicating the token mapping.
export const INPUT_BASE_CLASSES =
  "w-full font-normal leading-[1.2] transition-[background-color,border-color,box-shadow] duration-200 " +
  "border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] text-[var(--color-input-text)] " +
  "placeholder:text-[var(--color-text-disabled)] " +
  "focus:outline-none focus-visible:border-[var(--override-focus)] focus-visible:shadow-[0_0_0_1px_var(--override-focus)] " +
  "disabled:cursor-not-allowed disabled:border-[var(--color-input-disabled-border)] " +
  "disabled:bg-[var(--color-input-disabled-background)] disabled:text-[var(--color-input-disabled-text)]";

export const INPUT_SIZE_CLASSES: Record<InputFieldSize, string> = {
  sm: "h-8 rounded-[var(--radius-x-small)] px-3 text-[13px]",
  md: "h-9 rounded px-3 text-sm",
  // Substantial-feeling fields for standalone forms (auth pages, wizards)
  // where the default md height reads as too thin next to a full-width
  // primary button -- same tokens, just more breathing room.
  lg: "h-12 rounded-lg px-4 text-base"
};

const BASE_CLASSES = INPUT_BASE_CLASSES;
const SIZE_CLASSES = INPUT_SIZE_CLASSES;

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, error, hint, size = "md", className = "", id, ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const input = (
    <input
      {...props}
      id={inputId}
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={`${BASE_CLASSES} ${SIZE_CLASSES[size]} ${
        error ? "border-[var(--color-negative)] bg-[var(--color-negative-subtle-hover)] focus-visible:border-[var(--color-negative)] focus-visible:shadow-[0_0_0_1px_var(--color-negative)]" : ""
      } ${className}`.trim()}
    />
  );

  // Preserves DOM parity with existing call sites that don't pass
  // label/error/hint -- only wraps when there's something to wrap for.
  if (!label && !error && !hint) {
    return input;
  }

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label
          htmlFor={inputId}
          className={`flex items-center gap-1 whitespace-nowrap text-xs ${error ? "font-medium text-[var(--color-negative)]" : "text-[var(--color-icon-secondary)]"}`}
        >
          {error ? <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {label}
        </label>
      ) : null}
      {input}
      {error ? (
        <p className="flex items-start gap-1 text-xs text-[var(--color-negative)]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p className="text-xs text-[var(--color-icon-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
});
