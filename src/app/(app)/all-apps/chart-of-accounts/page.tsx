import type { Metadata } from "next";
import { ChartOfAccountsPage } from "@/components/settings/chart-of-accounts-page";

export const metadata: Metadata = {
  title: "Chart of Accounts"
};

export default function ChartOfAccountsRoute() {
  return <ChartOfAccountsPage />;
}
