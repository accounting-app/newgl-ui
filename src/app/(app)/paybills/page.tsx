import type { Metadata } from "next";
import { Suspense } from "react";
import { PayBillsFormPage } from "@/components/accounting/pay-bills-form-page";

export const metadata: Metadata = {
  title: "Pay Bills"
};

// QBO's own URL shape: /paybills?rtAccountId=<id>&rt=close. useSearchParams needs a Suspense boundary.
export default function PayBillsRoute() {
  return (
    <Suspense fallback={null}>
      <PayBillsFormPage />
    </Suspense>
  );
}
