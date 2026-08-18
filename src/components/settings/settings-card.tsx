import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

// Generalized to src/components/ui/card.tsx (UI_DESIGN_SYSTEM_PLAN.md Part
// 1). Kept as a thin re-export -- with the mb-6 stacking margin every
// settings page currently relies on -- so existing call sites don't need to
// change as part of Stage 1; they migrate to Card directly in later stages.
type SettingsCardProps = Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
}>;

export function SettingsCard({ title, description, children }: SettingsCardProps) {
  return (
    <Card title={title} description={description} className="mb-6">
      {children}
    </Card>
  );
}
