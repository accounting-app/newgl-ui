import type { Metadata } from "next";
import { Suspense } from "react";
import { SalesReceiptFormPage } from "@/components/accounting/sales-receipt-form-page";

export const metadata: Metadata = {
  title: "Sales Receipt"
};

// Reached from "+ Sales Receipt" as /salesreceipt?rtAccountId=<deposit account>&rt=close
// (QBO's own URL shape). useSearchParams needs a Suspense boundary.
export default function SalesReceiptRoute() {
  return (
    <Suspense fallback={null}>
      <SalesReceiptFormPage />
    </Suspense>
  );
}
