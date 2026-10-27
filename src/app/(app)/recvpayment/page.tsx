import type { Metadata } from "next";
import { Suspense } from "react";
import { ReceivePaymentFormPage } from "@/components/accounting/receive-payment-form-page";

export const metadata: Metadata = {
  title: "Receive Payment"
};

// QBO's own URL shape: /recvpayment?rtAccountId=<id>&rt=close. useSearchParams needs a Suspense boundary.
export default function ReceivePaymentRoute() {
  return (
    <Suspense fallback={null}>
      <ReceivePaymentFormPage />
    </Suspense>
  );
}
