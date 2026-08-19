import { useId } from "react";

type RadioOption = {
  value: string;
  label: string;
  description?: string;
};

type RadioGroupProps = {
  name?: string;
  label?: string;
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

// Replaces the CSV import wizard's sign-convention picker
// (UI_DESIGN_SYSTEM_PLAN.md Part 1) -- the only radio-button usage in the
// app today, but a distinct interaction pattern from Checkbox worth its own
// small component rather than another one-off.
export function RadioGroup({ name, label, options, value, onChange, disabled }: RadioGroupProps) {
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <fieldset className="flex flex-col gap-2">
      {label ? <legend className="mb-1 text-xs text-[var(--color-icon-secondary)]">{label}</legend> : null}
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]"
        >
          <input
            type="radio"
            name={groupName}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            onChange={() => onChange(option.value)}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-action-standard)] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span>
            {option.label}
            {option.description ? (
              <span className="block text-xs text-[var(--color-icon-secondary)]">{option.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
