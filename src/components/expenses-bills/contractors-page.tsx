"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    <>
      <h1 className="mb-4 text-xl font-semibold text-[var(--color-text-global)]">Contractors</h1>
      <Card>
        {!hydrated ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : contractors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-container-background-accent)] text-[var(--color-icon-secondary)]">
              <Users className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="text-lg font-semibold text-[var(--color-text-global)]">Track your contractors here</p>
            <p className="max-w-sm text-sm text-[var(--color-text-primary)]">
              Mark a vendor as a 1099 contractor to see them in this list, ready for 1099 tracking at tax time.
            </p>
            <Link href="/all-apps/expenses-bills/vendors">
              <Button>Go to Vendors</Button>
            </Link>
          </div>
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
    </>
  );
}
