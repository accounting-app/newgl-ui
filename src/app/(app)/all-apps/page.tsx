import { redirect } from "next/navigation";
import { ALL_APPS_CATEGORIES } from "@/constants/apps";

// Bare /all-apps has nothing of its own to show -- lands on the first item
// of the first category (Chart of Accounts today), same as clicking "All
// apps" is expected to default to its first submenu option.
export default function AllAppsIndexPage() {
  const firstHref = ALL_APPS_CATEGORIES[0]?.items[0]?.href ?? "/";
  redirect(firstHref);
}
