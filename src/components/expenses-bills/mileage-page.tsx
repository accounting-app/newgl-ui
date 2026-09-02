"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { Table } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import { DEFAULT_MILEAGE_RATE, type MileageEntry, type Vendor } from "@/lib/local-store/expenses-bills-types";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Phase 1: UI only, local-only data. Doesn't post to the ledger --
// mileage-as-a-reimbursable-expense is a Phase 1.5 question (see the plan
// doc), this just gets the tracking workflow ready.
export function MileagePage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const vendorsKey = activeCompany ? companyScopedKey(activeCompany.name, "vendors") : null;
  const mileageKey = activeCompany ? companyScopedKey(activeCompany.name, "mileage") : null;
  const { items: vendors } = useLocalCollection<Vendor>(vendorsKey ?? "newgl:phase1:pending:vendors");
  const { items: entries, hydrated, add, remove } = useLocalCollection<MileageEntry>(mileageKey ?? "newgl:phase1:pending:mileage");

  const vendorOptions = useMemo(() => vendors.filter((v) => v.status === "ACTIVE").map((v) => ({ value: v.id, label: v.name })), [vendors]);
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [v.id, v.name])), [vendors]);

  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [miles, setMiles] = useState("");
  const [rate, setRate] = useState(String(DEFAULT_MILEAGE_RATE));
  const [purpose, setPurpose] = useState("");
  const [vendorId, setVendorId] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedMiles = Number(miles);
    const parsedRate = Number(rate);
    if (!Number.isFinite(parsedMiles) || parsedMiles <= 0 || !Number.isFinite(parsedRate) || parsedRate <= 0) return;
    add({
      id: localId(),
      date,
      miles: parsedMiles,
      ratePerMile: parsedRate,
      purpose: purpose.trim() || undefined,
      vendorId: vendorId || undefined,
      createdAt: new Date().toISOString()
    });
    toast({ variant: "success", title: "Mileage logged" });
    setMiles("");
    setPurpose("");
  }

  function handleDelete(entry: MileageEntry) {
    remove(entry.id);
  }

  const totalDeduction = useMemo(() => entries.reduce((sum, e) => sum + e.miles * e.ratePerMile, 0), [entries]);
  const totalMiles = useMemo(() => entries.reduce((sum, e) => sum + e.miles, 0), [entries]);
  const [showForm, setShowForm] = useState(entries.length === 0);

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[var(--color-text-global)]">Mileage</h1>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Add a trip"}</Button>
      </div>

      {entries.length === 0 && !showForm ? (
        <Card className="mb-4">
          <p className="text-lg font-semibold text-[var(--color-text-global)]">
            Track business mileage at the standard {formatMoney(DEFAULT_MILEAGE_RATE)}/mile rate
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">
            No automatic GPS tracking yet -- log trips manually below and we'll total up the deduction.
          </p>
        </Card>
      ) : null}

      {showForm ? (
        <Card title="Log a trip" description="Not backed by a server yet -- saved to this browser only." className="mb-6">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <InputField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="w-28">
            <NumberField label="Miles" placeholder="0" value={miles} onChange={(e) => setMiles(e.target.value)} />
          </div>
          <div className="w-32">
            <NumberField label="Rate / mile" currency placeholder="0.70" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="min-w-[180px] flex-1">
            <InputField label="Purpose (optional)" placeholder="Client visit, supply run…" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <div className="w-48">
            <Select label="Vendor (optional)" value={vendorId} onChange={setVendorId} options={vendorOptions} placeholder="None" allowCustomValue={false} />
          </div>
          <Button type="submit" disabled={miles.trim() === "" || rate.trim() === ""}>
            Log trip
          </Button>
          </form>
        </Card>
      ) : null}

      <Card
        title="Mileage log"
        description={entries.length > 0 ? `${totalMiles.toLocaleString()} miles logged · ${formatMoney(totalDeduction)} total` : undefined}
      >
        {!hydrated ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-[var(--color-text-disabled)]">No trips logged yet.</p>
        ) : (
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Date</Table.HeaderCell>
                <Table.HeaderCell>Purpose</Table.HeaderCell>
                <Table.HeaderCell>Vendor</Table.HeaderCell>
                <Table.HeaderCell align="right">Miles</Table.HeaderCell>
                <Table.HeaderCell align="right">Amount</Table.HeaderCell>
                <Table.HeaderCell />
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {entries.map((entry) => (
                <Table.Row key={entry.id}>
                  <Table.Cell className="text-[var(--color-text-primary)]">{entry.date}</Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">{entry.purpose || "--"}</Table.Cell>
                  <Table.Cell className="text-[var(--color-text-primary)]">
                    {entry.vendorId ? vendorNameById.get(entry.vendorId) ?? "--" : "--"}
                  </Table.Cell>
                  <Table.Cell align="right" className="text-[var(--color-text-primary)]">
                    {entry.miles.toLocaleString()}
                  </Table.Cell>
                  <Table.Cell align="right" className="text-[var(--color-text-global)]">
                    {formatMoney(entry.miles * entry.ratePerMile)}
                  </Table.Cell>
                  <Table.Cell align="right">
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(entry)}>
                      Delete
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </Card>
    </>
  );
}
