import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactDetailPage } from "@/components/accounting/contact-detail-page";

export const metadata: Metadata = {
  title: "Customer details"
};

// QBO's own URL shape: /customerdetail?nameId=<id>. useSearchParams needs a Suspense boundary.
export default function CustomerDetailRoute() {
  return (
    <Suspense fallback={null}>
      <ContactDetailPage kind="customer" />
    </Suspense>
  );
}
