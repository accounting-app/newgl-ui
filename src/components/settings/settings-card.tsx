import type { ReactNode } from "react";

type SettingsCardProps = Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
}>;

export function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <section className="mb-6 rounded-xl border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-6">
      <h2 className="text-lg font-semibold text-[var(--color-text-global)]">{title}</h2>
      {description ? <p className="mt-1 text-sm text-[var(--color-text-primary)]">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
