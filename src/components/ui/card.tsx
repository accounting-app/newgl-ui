import type { HTMLAttributes, ReactNode } from "react";

export type CardPadding = "sm" | "md" | "lg";

type CardProps = HTMLAttributes<HTMLElement> & {
  title?: string;
  description?: string;
  padding?: CardPadding;
  children: ReactNode;
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8"
};

// Generalizes SettingsCard (UI_DESIGN_SYSTEM_PLAN.md Part 1) -- the same
// bordered-panel look ~30 files hand-build inline at inconsistent
// radius/padding, most visibly dashboard-metrics.tsx's 5+ tiles.
export function Card({ title, description, padding = "md", className = "", children, ...props }: CardProps) {
  return (
    <section
      {...props}
      className={`rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] ${PADDING_CLASSES[padding]} ${className}`.trim()}
    >
      {title ? <Card.Header title={title} description={description} /> : null}
      {children}
    </section>
  );
}

Card.Header = function CardHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-[var(--color-text-global)]">{title}</h2>
      {description ? <p className="mt-1 text-sm text-[var(--color-text-primary)]">{description}</p> : null}
    </div>
  );
};

Card.Body = function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
};

Card.Footer = function CardFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-4 flex items-center justify-end gap-2 border-t border-[var(--color-divider-tertiary)] pt-4 ${className}`.trim()}>
      {children}
    </div>
  );
};
