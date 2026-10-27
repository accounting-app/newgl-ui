import type { Metadata } from "next";
import { Suspense } from "react";
import { ExpenseFormPage } from "@/components/accounting/expense-form-page";

export const metadata: Metadata = {
  title: "Check"
};

// QBO's own URL shape: /check?rtAccountId=<id>&rt=close. The Check form is the
// Expense form with a mailing address, check number and Print later.
export default function CheckRoute() {
  return (
    <Suspense fallback={null}>
      <ExpenseFormPage kind="check" />
    </Suspense>
  );
}
