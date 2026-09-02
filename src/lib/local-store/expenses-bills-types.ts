// Phase-1 local-only shapes for the Expenses & Bills domain -- see
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md. These
// mirror the Postgres tables planned for Phase 1.5 (vendors, bills,
// mileage_entries) closely on purpose, so swapping the local store for
// real API calls later is a contained change per screen.

export type Vendor = {
  id: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  defaultExpenseAccountId?: string;
  is1099Contractor: boolean;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
};

export type BillStatus = "DRAFT" | "OPEN" | "PAID";

export type Bill = {
  id: string;
  vendorId: string;
  billNumber?: string;
  billDate: string;
  dueDate: string;
  amount: number;
  memo?: string;
  status: BillStatus;
  createdAt: string;
};

export type MileageEntry = {
  id: string;
  date: string;
  miles: number;
  ratePerMile: number;
  purpose?: string;
  vendorId?: string;
  createdAt: string;
};

export type ReceiptRecord = {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: string;
  linkedTransactionId?: string;
  vendorId?: string;
  categoryAccountId?: string;
  amount?: number;
  note?: string;
};

// IRS standard mileage rate is set yearly; this is just a sensible Phase-1
// default the user can override per entry, not meant to track the real
// published rate automatically.
export const DEFAULT_MILEAGE_RATE = 0.7;
