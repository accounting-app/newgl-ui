"use client";

import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Customer, Estimate, Invoice, ProductOrService } from "@/lib/local-store/sales-types";

/**
 * Shared Phase-1 local data for every Sales & Get Paid / Customer Hub
 * screen -- Overview, Sales Transactions, Invoices, Products & Services,
 * Customers, and Estimates all read/write the same collections, so this
 * hook is the one place that owns the storage keys and the "create inline
 * from a Select" helpers, rather than each screen reimplementing them (the
 * pattern Vendors/Bills/Mileage already share within Expenses & Bills).
 * Customers is the shared entity between the two categories, per
 * QBO_FREE_FEATURES_PLAN.md.
 */
export function useSalesData() {
  const { activeCompany } = useCompany();
  const customersKey = activeCompany ? companyScopedKey(activeCompany.name, "customers") : null;
  const invoicesKey = activeCompany ? companyScopedKey(activeCompany.name, "invoices") : null;
  const productsKey = activeCompany ? companyScopedKey(activeCompany.name, "products-services") : null;
  const estimatesKey = activeCompany ? companyScopedKey(activeCompany.name, "estimates") : null;

  const { items: customers, hydrated: customersHydrated, add: addCustomerRaw, update: updateCustomer, remove: removeCustomer } = useLocalCollection<Customer>(
    customersKey ?? "newgl:phase1:pending:customers"
  );
  const { items: invoices, hydrated: invoicesHydrated, add: addInvoiceRaw, update: updateInvoice, remove: removeInvoice } = useLocalCollection<Invoice>(
    invoicesKey ?? "newgl:phase1:pending:invoices"
  );
  const { items: productsServices, hydrated: productsHydrated, add: addProductRaw, update: updateProduct, remove: removeProduct } = useLocalCollection<ProductOrService>(
    productsKey ?? "newgl:phase1:pending:products-services"
  );
  const { items: estimates, hydrated: estimatesHydrated, add: addEstimateRaw, update: updateEstimate, remove: removeEstimate } = useLocalCollection<Estimate>(
    estimatesKey ?? "newgl:phase1:pending:estimates"
  );

  /** Full customer record -- the "New customer" form on the Customers screen. */
  function addCustomerRecord(input: Omit<Customer, "id" | "createdAt" | "status">): string {
    const id = localId();
    addCustomerRaw({ id, status: "ACTIVE", createdAt: new Date().toISOString(), ...input });
    return id;
  }

  /** Name-only shortcut -- inline "+ Add new" from a Select (Invoice/Estimate customer field). */
  function addCustomer(name: string): string {
    return addCustomerRecord({ name });
  }

  function addInvoice(input: Omit<Invoice, "id" | "createdAt" | "status">) {
    addInvoiceRaw({ id: localId(), createdAt: new Date().toISOString(), status: "OPEN", ...input });
  }

  function addProductOrService(input: Omit<ProductOrService, "id" | "createdAt" | "status">) {
    addProductRaw({ id: localId(), createdAt: new Date().toISOString(), status: "ACTIVE", ...input });
  }

  function addEstimate(input: Omit<Estimate, "id" | "createdAt" | "status">) {
    addEstimateRaw({ id: localId(), createdAt: new Date().toISOString(), status: "OPEN", ...input });
  }

  return {
    customers,
    invoices,
    productsServices,
    estimates,
    loading: !customersHydrated || !invoicesHydrated || !productsHydrated || !estimatesHydrated,
    addCustomer,
    addCustomerRecord,
    updateCustomer,
    removeCustomer,
    addInvoice,
    updateInvoice,
    removeInvoice,
    addProductOrService,
    updateProduct,
    removeProduct,
    addEstimate,
    updateEstimate,
    removeEstimate
  };
}
