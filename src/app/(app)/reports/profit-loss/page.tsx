import type { Metadata } from "next";
import { ReportsPage } from "@/components/reports/reports-page";

export const metadata: Metadata = {
  title: "Profit and Loss"
};

export default function ProfitAndLossPage() {
  return <ReportsPage reportType="profit_loss" />;
}
