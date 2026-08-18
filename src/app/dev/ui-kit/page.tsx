import { notFound } from "next/navigation";
import { UiKitShowcase } from "@/components/dev/ui-kit-showcase";

// The living design-system reference (UI_DESIGN_SYSTEM_PLAN.md Part 4,
// Stage 1) -- every ui/ component in every variant, for visual QA as the
// component set evolves. Hidden outside development: this 404s in any
// non-development NODE_ENV, so it never ships as real production surface.
export default function UiKitPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <UiKitShowcase />;
}
