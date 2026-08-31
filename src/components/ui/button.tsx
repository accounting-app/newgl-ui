import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentType } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  iconLeft?: ComponentType<{ className?: string }>;
  iconRight?: ComponentType<{ className?: string }>;
};

// Baseline that used to live ONLY under a `.tw-override` ancestor (see
// UI_DESIGN_SYSTEM_PLAN.md Part 2) -- every page that didn't opt into that
// wrapper rendered a completely unstyled <button>. Baked in directly here so
// Button looks the same everywhere it's mounted, with no ancestor dependency.
const BASE_CLASSES =
  "inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap select-none " +
  "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-[var(--override-focus)] focus-visible:ring-offset-1 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 min-w-[64px] px-3 text-xs",
  md: "h-[34px] min-w-[80px] px-5 text-sm",
  lg: "h-10 min-w-[96px] px-6 text-sm"
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "btn-primary border border-[var(--color-ui-primary)] bg-[var(--color-action-standard)] text-[var(--color-text-inverse)] " +
    "hover:border-[var(--color-ui-positive)] hover:bg-[var(--color-ui-positive)]",
  secondary:
    "border border-[var(--color-button-border)] bg-transparent text-[var(--color-text-primary)] " +
    "hover:bg-[var(--color-action-standard-subtle-hover)] hover:shadow-[inset_0_0_0_1px_var(--color-container-border-primary)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--color-text-primary)] " +
    "hover:bg-[var(--color-action-passive-subtle-hover)]",
  destructive:
    "border border-red-600 bg-transparent text-[var(--color-negative)] hover:bg-red-600 hover:text-white"
};

const ICON_SIZE: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-4 w-4"
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  iconLeft: IconLeft,
  iconRight: IconRight,
  className = "",
  type = "button",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const iconClass = ICON_SIZE[size];
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`${BASE_CLASSES} ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <Loader2 className={`${iconClass} animate-spin`} aria-hidden="true" />
      ) : IconLeft ? (
        <IconLeft className={iconClass} aria-hidden="true" />
      ) : null}
      {children}
      {!loading && IconRight ? <IconRight className={iconClass} aria-hidden="true" /> : null}
    </button>
  );
}
