import type { Metadata } from "next";
import { ReceiptsPage } from "@/components/expenses-bills/receipts-page";

export const metadata: Metadata = {
  title: "Receipts"
};

export default function ReceiptsRoute() {
  return <ReceiptsPage />;
}
