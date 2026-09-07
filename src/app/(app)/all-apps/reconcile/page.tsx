import type { Metadata } from "next";
import { ReconcilePage } from "@/components/accounting/reconcile-page";

export const metadata: Metadata = {
  title: "Reconcile"
};

export default function ReconcileRoute() {
  return <ReconcilePage />;
}
