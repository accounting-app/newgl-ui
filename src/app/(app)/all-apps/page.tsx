import { redirect } from "next/navigation";
import { MORE_APPS_CATEGORIES } from "@/constants/apps";

// Bare /all-apps has nothing of its own to show -- lands on the first item
// of the first "More apps" category, same as clicking "More apps" on the
// side rail (Accounting/Expenses/Sales have their own rail items).
export default function AllAppsIndexPage() {
  const firstHref = MORE_APPS_CATEGORIES[0]?.items[0]?.href ?? "/";
  redirect(firstHref);
}
