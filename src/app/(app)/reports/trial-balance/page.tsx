import type { Metadata } from "next";
import { TrialBalancePage } from "@/components/reports/trial-balance-page";

export const metadata: Metadata = {
  title: "Trial Balance"
};

export default function TrialBalanceRoute() {
  return <TrialBalancePage />;
}
