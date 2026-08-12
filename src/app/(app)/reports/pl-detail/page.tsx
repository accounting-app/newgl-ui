import type { Metadata } from "next";
import { PLDetailPage } from "@/components/reports/pl-detail-page";

export const metadata: Metadata = {
  title: "P&L Detail"
};

export default function PLDetailRoute() {
  return <PLDetailPage />;
}
