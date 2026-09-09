"use client";

import { CsvImportWizard, type ImportField } from "@/components/shared/csv-import-wizard";
import type { Customer } from "@/lib/services/customers-service";

const SAMPLE_CSV = "Customer Name,Company Name,Email,Phone\nAcme Corp,Acme Corp LLC,billing@acmecorp.com,555-0100\n";

const FIELDS: ImportField[] = [
  { key: "name", label: "Customer Name", required: true, aliases: ["customer name", "name"] },
  { key: "companyName", label: "Company Name", aliases: ["company name", "company"] },
  { key: "email", label: "Email", aliases: ["email", "email address"] },
  { key: "phone", label: "Phone", aliases: ["phone", "phone number"] },
  { key: "address", label: "Address", aliases: ["address", "address line 1", "address1"] }
];

// Real 3-step "Import customers" wizard -- same shape as
// ImportVendorsModal, both thin configs of CsvImportWizard.
export function ImportCustomersModal({
  onClose,
  onCreateCustomer
}: {
  onClose: () => void;
  onCreateCustomer: (input: Omit<Customer, "id" | "createdAt" | "status">) => Promise<Customer>;
}) {
  return (
    <CsvImportWizard
      title="Import customers"
      entityNamePlural="customers"
      fields={FIELDS}
      sampleCsv={SAMPLE_CSV}
      sampleFileName="customer-import-sample.csv"
      onCreateRow={(row) =>
        onCreateCustomer({
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
