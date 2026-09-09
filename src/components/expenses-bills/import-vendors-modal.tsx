"use client";

import { CsvImportWizard, type ImportField } from "@/components/shared/csv-import-wizard";
import type { CreateVendorInput, Vendor } from "@/lib/services/vendors-service";

const SAMPLE_CSV = "Vendor Name,Company Name,Email,Phone\nAcme Office Supply,Acme Office Supply LLC,billing@acme.com,555-0100\n";

const FIELDS: ImportField[] = [
  { key: "name", label: "Vendor Name", required: true, aliases: ["vendor name", "name"] },
  { key: "companyName", label: "Company Name", aliases: ["company name", "company"] },
  { key: "email", label: "Email", aliases: ["email", "email address"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number"] },
  { key: "address", label: "Address", aliases: ["address", "address line 1", "address1"] }
];

// Real 3-step "Import vendors" wizard (Upload / Map data / Import) --
// parses the file, lets you map its columns to Vendor fields (auto-
// guessed from the header row), then creates a real Vendor per row via
// the same API the Vendors screen itself uses. See CsvImportWizard for
// the shared step-machine this and ImportCustomersModal are both thin
// configs of.
export function ImportVendorsModal({ onClose, onCreateVendor }: { onClose: () => void; onCreateVendor: (input: CreateVendorInput) => Promise<Vendor> }) {
  return (
    <CsvImportWizard
      title="Import vendors"
      entityNamePlural="vendors"
      fields={FIELDS}
      sampleCsv={SAMPLE_CSV}
      sampleFileName="vendor-import-sample.csv"
      onCreateRow={(row) =>
        onCreateVendor({
          name: row.name,
          companyName: row.companyName || undefined,
          email: row.email || undefined,
          phone: row.phone || undefined,
          address: row.address || undefined
        })
      }
      onClose={onClose}
    />
  );
}
