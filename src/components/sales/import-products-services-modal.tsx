"use client";

import { CsvImportWizard, type ImportField } from "@/components/shared/csv-import-wizard";
import type { CreateProductInput, ProductOrService } from "@/lib/services/products-services-service";

const SAMPLE_CSV = "Name,Type,Sales Price,Description\nConsulting hour,Service,150,Hourly consulting rate\n";

const FIELDS: ImportField[] = [
  { key: "name", label: "Name", required: true, aliases: ["name", "product/service name", "item name"] },
  { key: "type", label: "Type", aliases: ["type", "item type"] },
  { key: "salesPrice", label: "Sales Price", aliases: ["sales price", "price", "rate"] },
  { key: "description", label: "Description", aliases: ["description"] }
];

function parseType(raw: string): CreateProductInput["type"] {
  return raw.trim().toLowerCase().startsWith("prod") ? "PRODUCT" : "SERVICE";
}

function parsePrice(raw: string): number | undefined {
  const cleaned = raw.replace(/[$,]/g, "").trim();
  if (!cleaned) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Real 3-step "Import items" wizard -- same shape as ImportVendorsModal /
// ImportCustomersModal, both thin configs of CsvImportWizard. Only real
// difference from those two: Type and Sales Price need parsing (enum
// normalization, currency-string-to-number) instead of being passed
// through as raw strings.
export function ImportProductsServicesModal({
  onClose,
  onCreateProduct
}: {
  onClose: () => void;
  onCreateProduct: (input: CreateProductInput) => Promise<ProductOrService>;
}) {
  return (
    <CsvImportWizard
      title="Import items"
      entityNamePlural="items"
      fields={FIELDS}
      sampleCsv={SAMPLE_CSV}
      sampleFileName="products-services-import-sample.csv"
      onCreateRow={(row) =>
        onCreateProduct({
          name: row.name,
          type: parseType(row.type),
          salesPrice: parsePrice(row.salesPrice),
          description: row.description || undefined
        })
      }
      onClose={onClose}
    />
  );
}
