import type { Metadata } from "next";
import { CustomerHubOverviewPage } from "@/components/customer-hub/overview-page";

export const metadata: Metadata = {
  title: "Customer Hub"
};

export default function CustomerHubRoute() {
  return <CustomerHubOverviewPage />;
}
