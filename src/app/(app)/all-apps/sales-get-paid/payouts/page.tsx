import type { Metadata } from "next";
import { PayoutsPage } from "@/components/sales/payouts-page";

export const metadata: Metadata = {
  title: "Payouts"
};

export default function PayoutsRoute() {
  return <PayoutsPage />;
}
