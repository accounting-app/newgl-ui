"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Vendor } from "@/lib/local-store/expenses-bills-types";

// Not a separate entity -- without Payroll (out of scope, see the plan
// doc), a "contractor" here is just a vendor flagged 1099-eligible.
// Read-only; add/edit happens on the Vendors screen so there's one place
// that owns vendor data, not two.
export function ContractorsPage() {
  const { activeCompany } = useCompany();
  const storageKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const { items: vendors, hydrated } = useLocalCollection<Vendor>(storageKey ?? "newgl:phase1:pending:vendors");
  const contractors = vendors.filter((v) => v.is1099Contractor);

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <Card title="Contractors">
      <p className="mb-4 text-sm text-[var(--color-text-primary)]">
        Vendors marked as 1099 contractors. Add or edit one from{" "}
        <Link href="/all-apps/expenses-bills/vendors" className="text-[var(--color-link-action)] hover:underline">
          Vendors
        </Link>
        .
      </p>
      {!hydrated ? (
        <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
      ) : contractors.length === 0 ? (
        <p className="text-sm text-[var(--color-text-disabled)]">
          No contractors yet. Mark a vendor as a 1099 contractor on the Vendors screen to see them here.
        </p>
      ) : (
        <Table.Root>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Vendor</Table.HeaderCell>
              <Table.HeaderCell>Email</Table.HeaderCell>
              <Table.HeaderCell>Phone</Table.HeaderCell>
              <Table.HeaderCell>Status</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {contractors.map((vendor) => (
              <Table.Row key={vendor.id}>
                <Table.Cell className="font-medium text-[var(--color-text-global)]">{vendor.name}</Table.Cell>
                <Table.Cell className="text-[var(--color-text-primary)]">{vendor.email || "--"}</Table.Cell>
                <Table.Cell className="text-[var(--color-text-primary)]">{vendor.phone || "--"}</Table.Cell>
                <Table.Cell className="text-[var(--color-text-primary)]">{vendor.status === "ACTIVE" ? "Active" : "Archived"}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </Card>
  );
}
