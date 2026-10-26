import type { Metadata } from "next";
import { Suspense } from "react";
import { DepositFormPage } from "@/components/accounting/deposit-form-page";

export const metadata: Metadata = {
  title: "Bank Deposit"
};

// QBO's own URL shape: /deposit?rtAccountId=<id>&rt=close. useSearchParams needs a Suspense boundary.
export default function DepositRoute() {
  return (
    <Suspense fallback={null}>
      <DepositFormPage />
    </Suspense>
  );
}
