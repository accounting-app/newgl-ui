import type { Metadata } from "next";
import { ContractorsPage } from "@/components/expenses-bills/contractors-page";

export const metadata: Metadata = {
  title: "Contractors"
};

export default function ContractorsRoute() {
  return <ContractorsPage />;
}
