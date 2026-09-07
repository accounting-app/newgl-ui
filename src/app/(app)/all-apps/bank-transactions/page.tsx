import type { Metadata } from "next";
import { BankTransactionsPage } from "@/components/accounting/bank-transactions-page";

export const metadata: Metadata = {
  title: "Bank Transactions"
};

export default function BankTransactionsRoute() {
  return <BankTransactionsPage />;
}
