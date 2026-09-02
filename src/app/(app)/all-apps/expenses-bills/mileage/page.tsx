import type { Metadata } from "next";
import { MileagePage } from "@/components/expenses-bills/mileage-page";

export const metadata: Metadata = {
  title: "Mileage"
};

export default function MileageRoute() {
  return <MileagePage />;
}
