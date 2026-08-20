import type { Metadata } from "next";
import { AgingPage } from "@/components/reports/aging-page";

export const metadata: Metadata = {
  title: "A/R & A/P Aging"
};

export default function AgingRoute() {
  return <AgingPage />;
}
