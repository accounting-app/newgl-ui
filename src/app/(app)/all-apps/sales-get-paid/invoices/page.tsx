import type { Metadata } from "next";
import { InvoicesPage } from "@/components/sales/invoices-page";

export const metadata: Metadata = {
  title: "Invoices"
};

export default function InvoicesRoute() {
  return <InvoicesPage />;
}
