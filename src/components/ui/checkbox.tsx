import { forwardRef, useEffect, useRef } from "react";
import type { InputHTMLAttributes } from "react";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  /** Table "select all" headers: some rows selected, not all. Purely visual -- doesn't change `checked`. */
  indeterminate?: boolean;
};

// Replaces the 5 raw <input type="checkbox"> call sites scattered across
// review tables (UI_DESIGN_SYSTEM_PLAN.md Part 1) -- same accent-color
// approach as the native checkbox already looked fine as-is, this mainly
// adds indeterminate support and a consistent label pattern.
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, indeterminate = false, className = "", id, ...props },
  forwardedRef
) {
  const localRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (localRef.current) {
      localRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  function setRefs(node: HTMLInputElement | null) {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }

  const input = (
    <input
      {...props}
      id={id}
      ref={setRefs}
      type="checkbox"
      className={`h-4 w-4 cursor-pointer accent-[var(--color-action-standard)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`.trim()}
    />
  );

  if (!label) return input;

  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
      {input}
      {label}
    </label>
  );
});
