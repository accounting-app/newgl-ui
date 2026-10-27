import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactDetailPage } from "@/components/accounting/contact-detail-page";

export const metadata: Metadata = {
  title: "Vendor details"
};

// QBO's own URL shape: /vendordetail?nameId=<id>. useSearchParams needs a Suspense boundary.
export default function VendorDetailRoute() {
  return (
    <Suspense fallback={null}>
      <ContactDetailPage kind="vendor" />
    </Suspense>
  );
}
