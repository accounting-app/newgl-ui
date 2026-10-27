import type { Metadata } from "next";
import { RecurringTransactionsPage } from "@/components/accounting/recurring-transactions-page";

export const metadata: Metadata = {
  title: "Recurring Transactions"
};

export default function RecurringTransactionsRoute() {
  return <RecurringTransactionsPage />;
}
