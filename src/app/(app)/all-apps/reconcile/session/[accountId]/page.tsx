import type { Metadata } from "next";
import { ReconciliationSessionPage } from "@/components/accounting/reconciliation-session-page";

export const metadata: Metadata = {
  title: "Reconcile"
};

export default async function ReconcileSessionRoute({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  return <ReconciliationSessionPage accountId={accountId} />;
}
