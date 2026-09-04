import type { Metadata } from "next";
import { SalesTransactionsPage } from "@/components/sales/sales-transactions-page";

export const metadata: Metadata = {
  title: "Sales transactions"
};

export default function SalesTransactionsRoute() {
  return <SalesTransactionsPage />;
}
