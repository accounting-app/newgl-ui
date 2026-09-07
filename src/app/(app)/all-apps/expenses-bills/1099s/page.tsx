import type { Metadata } from "next";
import { NineteenNinetyNinesPage } from "@/components/expenses-bills/nineteen-ninety-nines-page";

export const metadata: Metadata = {
  title: "1099s"
};

export default function NineteenNinetyNinesRoute() {
  return <NineteenNinetyNinesPage />;
}
