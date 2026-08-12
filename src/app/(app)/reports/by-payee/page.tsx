import type { Metadata } from "next";
import { ByPayeePage } from "@/components/reports/by-payee-page";

export const metadata: Metadata = {
  title: "By Payee"
};

export default function ByPayeeRoute() {
  return <ByPayeePage />;
}
