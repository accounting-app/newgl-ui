"use client";

import { useCustomers } from "@/lib/hooks/use-customers";
import { useProductsServices } from "@/lib/hooks/use-products-services";
import { useInvoices } from "@/lib/hooks/use-invoices";
import { useEstimates } from "@/lib/hooks/use-estimates";
import type { Customer } from "@/lib/services/customers-service";
import type { CreateInvoiceInput } from "@/lib/services/invoices-service";
import type { CreateEstimateInput } from "@/lib/services/estimates-service";

/**
 * Shared data for every Sales & Get Paid / Customer Hub screen --
 * Overview, Sales Transactions, Invoices, Products & Services, Customers,
 * and Estimates all read/write the same collections, so this hook is the
 * one place that owns them, rather than each screen reimplementing its
 * own (the pattern Vendors/Bills/Mileage already share within Expenses &
 * Bills). Customers is the shared entity between the two categories, per
 * QBO_FREE_FEATURES_PLAN.md.
 *
 * Phase 1.5, Steps 6-8: every entity here is real now -- Customers,
 * Products & Services, Invoices, and Estimates all go through their own
 * API-backed hook, so every add/update/remove below is a real network
 * call (async).
 */
export function useSalesData() {
  const { items: customers, hydrated: customersHydrated, add: addCustomerRaw, update: updateCustomer, remove: removeCustomer } = useCustomers();
  const { items: productsServices, hydrated: productsHydrated, add: addProductRaw, update: updateProduct, remove: removeProduct } = useProductsServices();
  const { items: invoices, hydrated: invoicesHydrated, add: addInvoiceRaw, update: updateInvoice, pay: payInvoice, remove: removeInvoice } = useInvoices();
  const { items: estimates, hydrated: estimatesHydrated, add: addEstimateRaw, update: updateEstimate, remove: removeEstimate } = useEstimates();

  /** Full customer record -- the "New customer" form on the Customers screen. */
  async function addCustomerRecord(input: Omit<Customer, "id" | "createdAt" | "status">): Promise<Customer> {
    return addCustomerRaw(input);
  }

  /** Name-only shortcut -- inline "+ Add new" from a Select (Invoice/Estimate customer field). Returns the new customer's id. */
  async function addCustomer(name: string): Promise<string> {
    const created = await addCustomerRecord({ name });
    return created.id;
  }

  async function addInvoice(input: CreateInvoiceInput) {
    return addInvoiceRaw(input);
  }

  async function addProductOrService(input: Parameters<typeof addProductRaw>[0]) {
    await addProductRaw(input);
  }

  async function addEstimate(input: CreateEstimateInput) {
    return addEstimateRaw(input);
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
    payInvoice,
    removeInvoice,
    addProductOrService,
    updateProduct,
    removeProduct,
    addEstimate,
    updateEstimate,
    removeEstimate
  };
}
