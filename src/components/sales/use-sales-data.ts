"use client";

import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Customer, Invoice, ProductOrService } from "@/lib/local-store/sales-types";

/**
 * Shared Phase-1 local data for every Sales & Get Paid screen -- Overview,
 * Sales Transactions, Invoices, and Products & Services all read/write the
 * same three collections, so this hook is the one place that owns the
 * storage keys and the "create inline from a Select" helpers, rather than
 * each screen reimplementing them (the pattern Vendors/Bills/Mileage
 * already share within Expenses & Bills).
 */
export function useSalesData() {
  const { activeCompany } = useCompany();
  const customersKey = activeCompany ? companyScopedKey(activeCompany.name, "customers") : null;
  const invoicesKey = activeCompany ? companyScopedKey(activeCompany.name, "invoices") : null;
  const productsKey = activeCompany ? companyScopedKey(activeCompany.name, "products-services") : null;

  const { items: customers, hydrated: customersHydrated, add: addCustomerRaw } = useLocalCollection<Customer>(customersKey ?? "newgl:phase1:pending:customers");
  const { items: invoices, hydrated: invoicesHydrated, add: addInvoiceRaw, update: updateInvoice, remove: removeInvoice } = useLocalCollection<Invoice>(
    invoicesKey ?? "newgl:phase1:pending:invoices"
  );
  const { items: productsServices, hydrated: productsHydrated, add: addProductRaw, update: updateProduct, remove: removeProduct } = useLocalCollection<ProductOrService>(
    productsKey ?? "newgl:phase1:pending:products-services"
  );

  function addCustomer(name: string): string {
    const id = localId();
    addCustomerRaw({ id, name, status: "ACTIVE", createdAt: new Date().toISOString() });
    return id;
  }

  function addInvoice(input: Omit<Invoice, "id" | "createdAt" | "status">) {
    addInvoiceRaw({ id: localId(), createdAt: new Date().toISOString(), status: "OPEN", ...input });
  }

  function addProductOrService(input: Omit<ProductOrService, "id" | "createdAt" | "status">) {
    addProductRaw({ id: localId(), createdAt: new Date().toISOString(), status: "ACTIVE", ...input });
  }

  return {
    customers,
    invoices,
    productsServices,
    loading: !customersHydrated || !invoicesHydrated || !productsHydrated,
    addCustomer,
    addInvoice,
    updateInvoice,
    removeInvoice,
    addProductOrService,
    updateProduct,
    removeProduct
  };
}
