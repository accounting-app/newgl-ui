import type { Metadata } from "next";
import { BankRulesPage } from "@/components/settings/bank-rules-page";

export const metadata: Metadata = {
  title: "Bank Rules"
};

export default function BankRulesRoute() {
  return <BankRulesPage />;
}
