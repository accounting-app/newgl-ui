// Promoted to src/components/ui/select.tsx (UI_DESIGN_SYSTEM_PLAN.md Part 1).
// Kept as a re-export so existing call sites don't need to change import
// paths as part of Stage 1 -- they migrate to importing from ui/ directly
// in later stages.
export { Select as SelectField } from "@/components/ui/select";
export type { SelectOption as SelectFieldOption } from "@/components/ui/select";
