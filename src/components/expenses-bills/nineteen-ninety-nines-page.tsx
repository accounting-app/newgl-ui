"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Bill, Vendor } from "@/lib/local-store/expenses-bills-types";

// 1099 REPORTING threshold in the US is $600/year -- shown for reference,
// not enforced (this is a summary, not a filing tool; see the plan doc for
// why real e-filing is explicitly out of scope).
const REPORTING_THRESHOLD = 600;

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function yearOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2].map((year) => ({ value: String(year), label: String(year) }));
}

// Phase 1: a read-only summary over local-only Vendors + Bills data, no
// filing capability. Real e-filing needs a licensed tax provider
// integration -- out of scope, see newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function NineteenNinetyNinesPage() {
  const { activeCompany } = useCompany();
  const vendorsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const billsKey = activeCompany ? companyScopedKey(activeCompany.name, "bills") : null;
  const { items: vendors, hydrated: vendorsHydrated } = useLocalCollection<Vendor>(vendorsKey ?? "newgl:phase1:pending:vendors");
  const { items: bills, hydrated: billsHydrated } = useLocalCollection<Bill>(billsKey ?? "newgl:phase1:pending:bills");

  const [year, setYear] = useState(String(new Date().getFullYear()));

  const contractors = useMemo(() => vendors.filter((v) => v.is1099Contractor), [vendors]);
  const rows = useMemo(
    () =>
      contractors.map((vendor) => {
        const paidThisYear = bills
          .filter((bill) => bill.vendorId === vendor.id && bill.status === "PAID" && bill.billDate.startsWith(year))
          .reduce((sum, bill) => sum + bill.amount, 0);
        return { vendor, paidThisYear };
      }),
    [contractors, bills, year]
  );

  const hydrated = vendorsHydrated && billsHydrated;

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <Card title="1099 summary" description="A read-only summary of paid bills to 1099 contractors -- not a filing tool.">
      <div className="mb-4 w-32">
        <Select label="Tax year" value={year} onChange={setYear} options={yearOptions()} placeholder="Year" allowCustomValue={false} />
      </div>
      {!hydrated ? (
        <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--color-text-disabled)]">No 1099 contractors yet.</p>
      ) : (
        <Table.Root>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Contractor</Table.HeaderCell>
              <Table.HeaderCell align="right">Paid in {year}</Table.HeaderCell>
              <Table.HeaderCell>Reporting</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {rows.map(({ vendor, paidThisYear }) => (
              <Table.Row key={vendor.id}>
                <Table.Cell className="font-medium text-[var(--color-text-global)]">{vendor.name}</Table.Cell>
                <Table.Cell align="right" className="text-[var(--color-text-global)]">
                  {formatMoney(paidThisYear)}
                </Table.Cell>
                <Table.Cell>
                  {paidThisYear >= REPORTING_THRESHOLD ? (
                    <Badge variant="warning" size="sm">
                      Meets ${REPORTING_THRESHOLD} threshold
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">
                      Below threshold
                    </Badge>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      )}
    </Card>
  );
}
