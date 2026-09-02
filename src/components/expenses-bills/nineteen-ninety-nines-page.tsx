"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Bill, Vendor } from "@/lib/local-store/expenses-bills-types";

const REPORTING_THRESHOLD = 600;

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function yearOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2].map((year) => ({ value: String(year), label: String(year) }));
}

const TABS = [
  { value: "efile", label: "E-file" },
  { value: "recipients", label: "Recipients & W-9s" },
  { value: "completed", label: "Completed forms" }
] as const;
type TabValue = (typeof TABS)[number]["value"];

// Phase 1: a read-only summary over local-only Vendors + Bills data. Real
// e-filing needs a licensed tax-prep provider integration -- explicitly
// out of scope (see newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md),
// so the E-file and Completed forms tabs say so plainly instead of
// pretending a filing capability exists.
export function NineteenNinetyNinesPage() {
  const { activeCompany } = useCompany();
  const vendorsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const billsKey = activeCompany ? companyScopedKey(activeCompany.name, "bills") : null;
  const { items: vendors, hydrated: vendorsHydrated } = useLocalCollection<Vendor>(vendorsKey ?? "newgl:phase1:pending:vendors");
  const { items: bills, hydrated: billsHydrated } = useLocalCollection<Bill>(billsKey ?? "newgl:phase1:pending:bills");

  const [tab, setTab] = useState<TabValue>("recipients");
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
    <>
      <h1 className="mb-4 text-xl font-semibold text-[var(--color-text-global)]">1099s</h1>
      <div className="mb-4 flex gap-1 border-b border-[var(--color-divider-tertiary)]">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === value ? "border-[var(--color-ui-primary)] text-[var(--color-text-global)]" : "border-transparent text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "efile" ? (
        <Card title="E-file">
          <p className="text-sm text-[var(--color-text-primary)]">
            Online 1099 e-filing isn't available yet -- it needs a licensed tax-prep provider integration we haven't
            built. Use the Recipients & W-9s tab to see who meets the $600 reporting threshold, then file directly
            with the IRS or your accountant.
          </p>
        </Card>
      ) : null}

      {tab === "recipients" ? (
        <Card title="Recipients" description="Contractors who may need a 1099 at tax time, based on paid bills.">
          <div className="mb-4 w-32">
            <Select label="Tax year" value={year} onChange={setYear} options={yearOptions()} placeholder="Year" allowCustomValue={false} />
          </div>
          {!hydrated ? (
            <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-[var(--color-text-disabled)]">
              No 1099 contractors yet. Mark a vendor as a 1099 contractor on the Vendors screen.
            </p>
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
                    <Table.Cell align="right" className="text-[var(--color-text-global)]">{formatMoney(paidThisYear)}</Table.Cell>
                    <Table.Cell>
                      {paidThisYear >= REPORTING_THRESHOLD ? (
                        <Badge variant="warning" size="sm">Meets ${REPORTING_THRESHOLD} threshold</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Below threshold</Badge>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Card>
      ) : null}

      {tab === "completed" ? (
        <Card title="Completed forms">
          <p className="text-sm text-[var(--color-text-disabled)]">
            No filings to show -- e-filing isn't available yet, so nothing has been filed through this app.
          </p>
        </Card>
      ) : null}
    </>
  );
}
