import type { Metadata } from "next";
import { VendorsPage } from "@/components/expenses-bills/vendors-page";

export const metadata: Metadata = {
  title: "Vendors"
};

export default function VendorsRoute() {
  return <VendorsPage />;
}
