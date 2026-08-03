import type { Metadata } from "next";
import { BankRegisterLayout } from "@/components/bank-register/bank-register-layout";

export const metadata: Metadata = {
  title: "Register"
};

export default function RegisterPage() {
  return <BankRegisterLayout />;
}
