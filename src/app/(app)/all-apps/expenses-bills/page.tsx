import type { Metadata } from "next";
import { ExpensesBillsOverviewPage } from "@/components/expenses-bills/overview-page";

export const metadata: Metadata = {
  title: "Expenses & Bills"
};

export default function ExpensesBillsOverviewRoute() {
  return <ExpensesBillsOverviewPage />;
}
