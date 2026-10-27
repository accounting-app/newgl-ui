import type { Metadata } from "next";
import { Suspense } from "react";
import { JournalFormPage } from "@/components/accounting/journal-form-page";

export const metadata: Metadata = {
  title: "Journal Entry"
};

// QBO's own URL shape: /journal?rtAccountId=<id>&rt=close. useSearchParams needs a Suspense boundary.
export default function JournalRoute() {
  return (
    <Suspense fallback={null}>
      <JournalFormPage />
    </Suspense>
  );
}
