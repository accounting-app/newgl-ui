// Phase-1 local-only shapes for the Sales & Get Paid domain -- same
// convention as expenses-bills-types.ts: mirrors the Postgres tables
// planned for Phase 1.5 closely, so swapping the local store for real API
// calls later is a contained change per screen. Real payment collection
// (QBO's own "QuickBooks Payments") and payouts need a real payments
// processor integration this app doesn't have, so those stay UI-only/
// honestly disabled -- see each screen's own comment. Customer and
// ProductOrService are no longer here -- both are real now (Phase 1.5,
// Step 6), see @/lib/services/customers-service + @/lib/hooks/use-customers
// and @/lib/services/products-services-service +
// @/lib/hooks/use-products-services.

export type EstimateStatus = "OPEN" | "ACCEPTED" | "DECLINED";

export type Estimate = {
  id: string;
  customerId: string;
  estimateNumber?: string;
  estimateDate: string;
  expirationDate?: string;
  amount: number;
  /** Single default item -- same one-category-per-record simplification
   * used by Invoice.productServiceId and Bill.categoryAccountId. */
  productServiceId?: string;
  memo?: string;
  status: EstimateStatus;
  createdAt: string;
};

export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID";

export type Invoice = {
  id: string;
  customerId: string;
  invoiceNumber?: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  /** Single default item/category -- same one-category-per-record
   * simplification as Bill.categoryAccountId. */
  productServiceId?: string;
  memo?: string;
  status: InvoiceStatus;
  createdAt: string;
};
