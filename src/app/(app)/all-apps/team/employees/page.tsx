import type { Metadata } from "next";
import { EmployeesPage } from "@/components/team/employees-page";

export const metadata: Metadata = {
  title: "Employees"
};

export default function EmployeesRoute() {
  return <EmployeesPage />;
}
