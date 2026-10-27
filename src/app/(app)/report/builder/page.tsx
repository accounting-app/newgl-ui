import type { Metadata } from "next";
import { Suspense } from "react";
import { ReportBuilderPage } from "@/components/reports/report-builder-page";

export const metadata: Metadata = {
  title: "Report"
};

// QBO's own URL shape: /report/builder?rptId=...&type=temp&token=PANDL&title=...
// useSearchParams needs a Suspense boundary.
export default function ReportBuilderRoute() {
  return (
    <Suspense fallback={null}>
      <ReportBuilderPage />
    </Suspense>
  );
}
