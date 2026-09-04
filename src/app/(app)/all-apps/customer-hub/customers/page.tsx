import type { Metadata } from "next";
import { CustomersPage } from "@/components/customer-hub/customers-page";

export const metadata: Metadata = {
  title: "Customers"
};

export default function CustomersRoute() {
  return <CustomersPage />;
}
