import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseFormPage } from "@/components/accounting/expense-form-page";

export const metadata: Metadata = {
  title: "Expense"
};

// Reached from the "+ Expense" button as /expense?rtAccountId=<payment account>&rt=close
// (QBO's own URL shape). useSearchParams needs a Suspense boundary.
export default function ExpenseRoute() {
  return (
    <Suspense fallback={null}>
      <ExpenseFormPage />
    </Suspense>
  );
}
