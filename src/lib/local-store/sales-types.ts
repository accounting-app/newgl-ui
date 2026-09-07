// Phase-1 local-only shapes for the Sales & Get Paid domain -- same
// convention as expenses-bills-types.ts: mirrors the Postgres tables
// planned for Phase 1.5 closely, so swapping the local store for real API
// calls later is a contained change per screen. Real payment collection
// (QBO's own "QuickBooks Payments") and payouts need a real payments
// processor integration this app doesn't have, so those stay UI-only/
// honestly disabled -- see each screen's own comment. Customer,
// ProductOrService, and Invoice are no longer here -- all three are real
// now (Phase 1.5, Steps 6-7), see @/lib/services/customers-service +
// @/lib/hooks/use-customers, @/lib/services/products-services-service +
// @/lib/hooks/use-products-services, and @/lib/services/invoices-service +
// @/lib/hooks/use-invoices. Estimate stays local-only, its own step
// later.

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
