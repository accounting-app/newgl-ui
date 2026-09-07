import type { Metadata } from "next";
import { SalesOverviewPage } from "@/components/sales/overview-page";

export const metadata: Metadata = {
  title: "Sales & Get Paid"
};

export default function SalesGetPaidRoute() {
  return <SalesOverviewPage />;
}
