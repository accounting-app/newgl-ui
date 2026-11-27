import type { Metadata } from "next";
import { Suspense } from "react";
import { BillPaymentFormPage } from "@/components/accounting/bill-payment-form-page";

export const metadata: Metadata = {
  title: "Bill Payment"
};

// QBO's own URL shape: /billpayment?txnId=<id>. useSearchParams needs a Suspense boundary.
export default function BillPaymentRoute() {
  return (
    <Suspense fallback={null}>
      <BillPaymentFormPage />
    </Suspense>
  );
}
