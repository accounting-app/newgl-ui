"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { RECURRING_CHANGED_EVENT, runDueRecurring } from "@/lib/services/recurring-service";

// Posts every scheduled recurring transaction that has come due (including
// ones missed while nobody had the app open) -- once per company per browser
// session, right after the app loads.
export function RecurringRunner() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const key = activeCompany?.name ?? null;

  useEffect(() => {
    if (!key) return;
    const flag = `newgl:recurring-run:${key}`;
    try {
      if (window.sessionStorage.getItem(flag)) return;
      window.sessionStorage.setItem(flag, "1");
    } catch {
      // storage unavailable: run anyway, once per mount
    }
    runDueRecurring()
      .then(({ created, failed }) => {
        if (created > 0 || failed > 0) window.dispatchEvent(new Event(RECURRING_CHANGED_EVENT));
        if (created > 0) toast({ variant: "success", title: created === 1 ? "1 recurring transaction was posted" : `${created} recurring transactions were posted` });
        if (failed > 0) toast({ variant: "error", title: `${failed} recurring transaction${failed === 1 ? "" : "s"} could not be posted`, description: "Open Recurring Transactions to see why." });
      })
      .catch(() => undefined);
  }, [key, toast]);

  return null;
}
