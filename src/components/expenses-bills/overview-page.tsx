"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { Bill, MileageEntry, Vendor } from "@/lib/local-store/expenses-bills-types";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type StatTileProps = { label: string; value: string; loading: boolean };

function StatTile({ label, value, loading }: StatTileProps) {
  return (
    <Card padding="sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">{label}</p>
      {loading ? <Skeleton className="h-7 w-24 rounded" /> : <p className="text-2xl font-semibold text-[var(--color-text-global)]">{value}</p>}
    </Card>
  );
}

// Phase 1: reads the same local-only stores as Vendors/Bills/Mileage --
// see newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function ExpensesBillsOverviewPage() {
  const { activeCompany } = useCompany();
  const vendorsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const billsKey = activeCompany ? companyScopedKey(activeCompany.name, "bills") : null;
  const mileageKey = activeCompany ? companyScopedKey(activeCompany.name, "mileage") : null;
  const { items: vendors, hydrated: vendorsHydrated } = useLocalCollection<Vendor>(vendorsKey ?? "newgl:phase1:pending:vendors");
  const { items: bills, hydrated: billsHydrated } = useLocalCollection<Bill>(billsKey ?? "newgl:phase1:pending:bills");
  const { items: mileage, hydrated: mileageHydrated } = useLocalCollection<MileageEntry>(mileageKey ?? "newgl:phase1:pending:mileage");

  const openBillsTotal = useMemo(() => bills.filter((b) => b.status === "OPEN").reduce((sum, b) => sum + b.amount, 0), [bills]);
  const activeVendorCount = useMemo(() => vendors.filter((v) => v.status === "ACTIVE").length, [vendors]);
  const mileageTotal = useMemo(() => mileage.reduce((sum, e) => sum + e.miles * e.ratePerMile, 0), [mileage]);

  const recentBills = useMemo(
    () => [...bills].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    [bills]
  );
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [v.id, v.name])), [vendors]);

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <StatTile label="Open bills" value={formatMoney(openBillsTotal)} loading={!billsHydrated} />
        <StatTile label="Active vendors" value={String(activeVendorCount)} loading={!vendorsHydrated} />
        <StatTile label="Mileage deduction" value={formatMoney(mileageTotal)} loading={!mileageHydrated} />
      </div>

      <Card title="Recent bills">
        {!billsHydrated ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : recentBills.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">
            No bills yet.{" "}
            <Link href="/all-apps/expenses-bills/bills" className="text-[var(--color-link-action)] hover:underline">
              Add one
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-container-background-secondary)]">
            {recentBills.map((bill) => (
              <li key={bill.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-[var(--color-text-primary)]">{vendorNameById.get(bill.vendorId) ?? "Unknown vendor"}</span>
                <span className="text-[var(--color-text-global)]">{formatMoney(bill.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
