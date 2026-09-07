import type { Metadata } from "next";
import { ProductsServicesPage } from "@/components/sales/products-services-page";

export const metadata: Metadata = {
  title: "Products & Services"
};

export default function ProductsServicesRoute() {
  return <ProductsServicesPage />;
}
