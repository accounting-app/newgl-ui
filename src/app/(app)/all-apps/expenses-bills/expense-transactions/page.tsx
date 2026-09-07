import type { Metadata } from "next";
import { ExpenseTransactionsPage } from "@/components/expenses-bills/expense-transactions-page";

export const metadata: Metadata = {
  title: "Expense Transactions"
};

export default function ExpenseTransactionsRoute() {
  return <ExpenseTransactionsPage />;
}
