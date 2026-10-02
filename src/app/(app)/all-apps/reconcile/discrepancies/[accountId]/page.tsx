import type { Metadata } from "next";
import { ReconciliationDiscrepancyPage } from "@/components/accounting/reconciliation-discrepancy-page";

export const metadata: Metadata = {
  title: "Reconciliation Discrepancy Report"
};

export default async function ReconciliationDiscrepancyRoute({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  return <ReconciliationDiscrepancyPage accountId={accountId} />;
}
