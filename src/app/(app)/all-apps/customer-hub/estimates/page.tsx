import type { Metadata } from "next";
import { EstimatesPage } from "@/components/customer-hub/estimates-page";

export const metadata: Metadata = {
  title: "Estimates"
};

export default function EstimatesRoute() {
  return <EstimatesPage />;
}
