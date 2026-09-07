"use client";

import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Estimate, Invoice } from "@/lib/local-store/sales-types";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useProductsServices } from "@/lib/hooks/use-products-services";
import type { Customer } from "@/lib/services/customers-service";

/**
 * Shared data for every Sales & Get Paid / Customer Hub screen --
 * Overview, Sales Transactions, Invoices, Products & Services, Customers,
 * and Estimates all read/write the same collections, so this hook is the
 * one place that owns them, rather than each screen reimplementing its
 * own (the pattern Vendors/Bills/Mileage already share within Expenses &
 * Bills). Customers is the shared entity between the two categories, per
 * QBO_FREE_FEATURES_PLAN.md.
 *
 * Phase 1.5, Step 6: Customers and Products & Services are real now (see
 * @/lib/hooks/use-customers and @/lib/hooks/use-products-services) --
 * Invoices and Estimates stay local-only until their own steps (7-8), so
 * addCustomer/addCustomerRecord/addProductOrService are real network
 * calls (async) while addInvoice/addEstimate are still synchronous local
 * writes.
 */
export function useSalesData() {
  const { activeCompany } = useCompany();
  const invoicesKey = activeCompany ? companyScopedKey(activeCompany.name, "invoices") : null;
  const estimatesKey = activeCompany ? companyScopedKey(activeCompany.name, "estimates") : null;

  const { items: customers, hydrated: customersHydrated, add: addCustomerRaw, update: updateCustomer, remove: removeCustomer } = useCustomers();
  const { items: productsServices, hydrated: productsHydrated, add: addProductRaw, update: updateProduct, remove: removeProduct } = useProductsServices();
  const { items: invoices, hydrated: invoicesHydrated, add: addInvoiceRaw, update: updateInvoice, remove: removeInvoice } = useLocalCollection<Invoice>(
    invoicesKey ?? "newgl:phase1:pending:invoices"
  );
  const { items: estimates, hydrated: estimatesHydrated, add: addEstimateRaw, update: updateEstimate, remove: removeEstimate } = useLocalCollection<Estimate>(
    estimatesKey ?? "newgl:phase1:pending:estimates"
  );

  /** Full customer record -- the "New customer" form on the Customers screen. */
  async function addCustomerRecord(input: Omit<Customer, "id" | "createdAt" | "status">): Promise<Customer> {
    return addCustomerRaw(input);
  }

  /** Name-only shortcut -- inline "+ Add new" from a Select (Invoice/Estimate customer field). Returns the new customer's id. */
  async function addCustomer(name: string): Promise<string> {
    const created = await addCustomerRecord({ name });
    return created.id;
  }

  function addInvoice(input: Omit<Invoice, "id" | "createdAt" | "status">) {
    addInvoiceRaw({ id: localId(), createdAt: new Date().toISOString(), status: "OPEN", ...input });
  }

  async function addProductOrService(input: Parameters<typeof addProductRaw>[0]) {
    await addProductRaw(input);
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
