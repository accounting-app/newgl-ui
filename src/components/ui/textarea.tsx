import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  hint?: string;
};

// Replaces 3 ad-hoc textareas (bulk paste import, chart-of-accounts
// description, journal-entry memo), each previously with its own one-off
// classes -- same label/error/hint contract as InputField for consistency
// (UI_DESIGN_SYSTEM_PLAN.md Part 1).
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className = "", id, ...props },
  ref
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  const textarea = (
    <textarea
      {...props}
      id={textareaId}
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={`w-full rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-3 py-2 text-sm text-[var(--color-input-text)] placeholder:text-[var(--color-text-disabled)] transition-[background-color,border-color,box-shadow] duration-200 focus:outline-none focus-visible:border-[var(--override-focus)] focus-visible:shadow-[0_0_0_1px_var(--override-focus)] disabled:cursor-not-allowed disabled:border-[var(--color-input-disabled-border)] disabled:bg-[var(--color-input-disabled-background)] disabled:text-[var(--color-input-disabled-text)] ${className}`.trim()}
    />
  );

  if (!label && !error && !hint) {
    return textarea;
  }

  return (
    <div className="flex flex-col gap-1">
      {label ? (
        <label htmlFor={textareaId} className="text-xs text-[var(--color-icon-secondary)]">
          {label}
        </label>
      ) : null}
      {textarea}
      {error ? (
        <p className="text-xs text-[var(--color-negative)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[var(--color-icon-secondary)]">{hint}</p>
      ) : null}
    </div>
  );
});
