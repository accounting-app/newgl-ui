import type { Metadata } from "next";
import { ReceiptsPage } from "@/components/accounting/receipts-page";

export const metadata: Metadata = {
  title: "Receipts"
};

export default function ReceiptsRoute() {
  return <ReceiptsPage />;
}
