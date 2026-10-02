import type { Metadata } from "next";
import { ReconciliationReportPage } from "@/components/accounting/reconciliation-report-page";

export const metadata: Metadata = {
  title: "Reconciliation Report"
};

export default async function ReconciliationReportRoute({ params }: { params: Promise<{ reconciliationId: string }> }) {
  const { reconciliationId } = await params;
  return <ReconciliationReportPage reconciliationId={reconciliationId} />;
}
