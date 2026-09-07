// Phase-1 local-only shapes for the Expenses & Bills domain -- see
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md. Vendor,
// MileageEntry, and Bill are no longer here -- all three are real now
// (Phase 1.5, Steps 1-3), see @/lib/services/vendors-service +
// @/lib/hooks/use-vendors, @/lib/services/mileage-service +
// @/lib/hooks/use-mileage-entries, and @/lib/services/bills-service +
// @/lib/hooks/use-bills.

export type ReceiptRecord = {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  uploadedAt: string;
  linkedTransactionId?: string;
  vendorId?: string;
  paymentAccountId?: string;
  categoryAccountId?: string;
  amount?: number;
  taxAmount?: number;
  note?: string;
};

// IRS standard mileage rate is set yearly; this is just a sensible Phase-1
// default the user can override per entry, not meant to track the real
// published rate automatically.
export const DEFAULT_MILEAGE_RATE = 0.725;
