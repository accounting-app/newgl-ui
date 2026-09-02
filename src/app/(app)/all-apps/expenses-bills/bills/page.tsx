import type { Metadata } from "next";
import { BillsPage } from "@/components/expenses-bills/bills-page";

export const metadata: Metadata = {
  title: "Bills"
};

export default function BillsRoute() {
  return <BillsPage />;
}
