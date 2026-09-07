"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { BarChart3, Car, ChevronDown, Gauge, QrCode, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, usePersistedJSON } from "@/lib/local-store/use-local-collection";
import { DEFAULT_MILEAGE_RATE } from "@/lib/local-store/expenses-bills-types";
import { useMileageEntries } from "@/lib/hooks/use-mileage-entries";
import type { CreateMileageEntryInput, MileageEntry, MileageTripType } from "@/lib/services/mileage-service";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Whole-dollar amount, no cents -- matches the reference's "$0" (not "$0.00") deduction figures. */
function formatWholeMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Per-mile rate needs 3 decimal places (the IRS rate itself is quoted that way, e.g. $0.725) -- formatMoney's 2-decimal currency formatter would round it. */
function formatRate(value: number): string {
  return `$${value.toFixed(3)}`;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TABS = [
  { value: "unreviewed", label: "Unreviewed" },
  { value: "business", label: "Business" },
  { value: "personal", label: "Personal" },
  { value: "all", label: "All" }
] as const;
type TabValue = (typeof TABS)[number]["value"];

function yearOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1, currentYear - 2].map((year) => ({ value: String(year), label: String(year) }));
}

function locationLabel(entry: MileageEntry): string {
  if (entry.startAddress && entry.endAddress) return `${entry.startAddress} → ${entry.endAddress}`;
  return entry.startAddress || entry.endAddress || "--";
}

// Matches the reference intro screen shown before the mileage log. There's
// no companion mobile app to actually scan this QR code into (or GPS
// auto-tracking behind it) -- kept honestly non-functional (the QR box is
// decorative, not a real link) while "Add a trip manually" and "Skip for
// now" are real, so nothing here overpromises a capability the app
// doesn't have. Whether to keep this screen at all is still open -- for
// now it only shows once per company (skipped automatically for
// companies that already have trips logged).
function MileageOnboarding({ onAddTripManually, onSkip }: { onAddTripManually: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col gap-8 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] p-10 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-xl">
        <h2 className="text-3xl font-semibold leading-tight text-[var(--color-text-global)]">
          Track mileage automatically and get <span className="text-[var(--color-positive)]">{formatRate(DEFAULT_MILEAGE_RATE)} a mile</span>
        </h2>
        <p className="mt-4 text-base text-[var(--color-text-primary)]">
          <span className="font-semibold text-[var(--color-text-global)]">Get the free mobile app.</span> Point your device&apos;s camera at the code and a link will pop up.
        </p>

        <div className="mt-6 flex flex-wrap items-start gap-6">
          <div title="A companion mobile app isn't available yet" className="flex w-40 flex-col items-center gap-2 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-4">
            <QrCode className="h-20 w-20 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            <p className="text-center text-xs text-[var(--color-text-disabled)]">Point your camera at the QR code</p>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p className="font-semibold text-[var(--color-text-global)]">Record trips manually</p>
              <p className="mt-1 text-sm text-[var(--color-text-primary)]">Enter your mileage by hand each time you drive for work.</p>
            </div>
            <span className="text-sm font-semibold text-[var(--color-text-disabled)]">OR</span>
            <button type="button" onClick={onAddTripManually} className="text-left text-sm font-medium text-[var(--color-link-action)] hover:underline">
              Add a trip manually
            </button>
            <button type="button" onClick={onSkip} className="text-left text-sm font-medium text-[var(--color-link-action)] hover:underline">
              Skip for now
            </button>
          </div>
        </div>
      </div>

      <div className="hidden shrink-0 items-center justify-center sm:flex">
        <Car className="h-32 w-32 text-[var(--color-positive)]" aria-hidden="true" />
      </div>
    </div>
  );
}

const ADD_TRIP_MENU_ITEMS = ["Manage vehicles", "Import trips", "Download my trips", "Download company trips", "Manage favorite locations", "Manage mileage rules"];

function AddTripDrawer({ onSave, onClose }: { onSave: (input: CreateMileageEntryInput, roundTrip: boolean) => void; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [tripDate, setTripDate] = useState(today);
  const [distance, setDistance] = useState("");
  const [startAddress, setStartAddress] = useState("");
  const [endAddress, setEndAddress] = useState("");
  const [tripType, setTripType] = useState<MileageTripType>("BUSINESS");
  const [purpose, setPurpose] = useState("");
  const [roundTrip, setRoundTrip] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedMiles = Number(distance);
    if (!Number.isFinite(parsedMiles) || parsedMiles <= 0) return;
    onSave(
      {
        date: tripDate,
        miles: parsedMiles,
        ratePerMile: DEFAULT_MILEAGE_RATE,
        type: tripType,
        startAddress: startAddress.trim() || undefined,
        endAddress: endAddress.trim() || undefined,
        purpose: purpose.trim() || undefined
      },
      roundTrip
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-[420px] max-w-full flex-col bg-[var(--color-container-background-primary)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-global)]">Add trip</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            <InputField label="Trip date *" type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} required />
            <NumberField label="Distance (mi) *" placeholder="Add distance" value={distance} onChange={(e) => setDistance(e.target.value)} required />
            <InputField label="Start point" placeholder="Add Address" value={startAddress} onChange={(e) => setStartAddress(e.target.value)} />
            <InputField label="End point" placeholder="Add Address" value={endAddress} onChange={(e) => setEndAddress(e.target.value)} />

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-global)]">
                <input type="radio" name="trip-type" checked={tripType === "BUSINESS"} onChange={() => setTripType("BUSINESS")} />
                Business
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--color-text-global)]">
                <input type="radio" name="trip-type" checked={tripType === "PERSONAL"} onChange={() => setTripType("PERSONAL")} />
                Personal
              </label>
            </div>

            <InputField label="Business purpose *" placeholder="Add purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} required={tripType === "BUSINESS"} />

            <div>
              <p className="mb-1 text-xs text-[var(--color-icon-secondary)]">Vehicle</p>
              {/* Single-vehicle system for now -- no fleet management, so
                  this isn't a real picker (see the honestly-disabled
                  "Manage vehicles" item in the Add trip menu). */}
              <p className="flex h-9 items-center rounded border border-[var(--color-input-disabled-border)] bg-[var(--color-input-disabled-background)] px-3 text-sm text-[var(--color-input-disabled-text)]">My vehicle</p>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-divider-tertiary)] pt-4">
              <span className="text-sm font-medium text-[var(--color-text-global)]">Round Trip</span>
              <button
                type="button"
                role="switch"
                aria-checked={roundTrip}
                onClick={() => setRoundTrip((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition-colors ${roundTrip ? "bg-[var(--color-ui-primary)]" : "bg-[var(--color-container-background-accent)]"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${roundTrip ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            <p className="text-xs text-[var(--color-icon-secondary)]">Enabling this option will create 2 trip entries. One going from start to end and another in the opposite direction.</p>
          </div>

          <div className="mt-auto flex justify-end pt-6">
            <Button type="submit" disabled={distance.trim() === "" || (tripType === "BUSINESS" && purpose.trim() === "")}>
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Phase 1.5, Step 2: real persistence -- see
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md and
// @/lib/hooks/use-mileage-entries. Still doesn't post to the ledger --
// mileage-as-a-reimbursable-expense is a Phase 1.5 question (see the plan
// doc), this just gets the tracking workflow ready. Matches the reference
// dashboard (potential deduction, business/total miles, per-mile rate,
// Unreviewed/Business/Personal/All tabs). "Unreviewed" is honestly always
// empty -- there's no auto-tracked trip source to review, every entry
// here was typed in by hand already.
export function MileagePage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const { items: entries, hydrated, add, remove } = useMileageEntries();

  const onboardingKey = activeCompany ? companyScopedKey(activeCompany.name, "mileage-onboarding-skipped") : "newgl:phase1:pending:mileage-onboarding-skipped";
  const [onboardingSkipped, setOnboardingSkipped] = usePersistedJSON(onboardingKey, false);
  const [showAddTripDrawer, setShowAddTripDrawer] = useState(false);
  const showOnboarding = hydrated && entries.length === 0 && !onboardingSkipped;

  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
  const [tab, setTab] = useState<TabValue>("unreviewed");
  const [search, setSearch] = useState("");
  const [addTripMenuOpen, setAddTripMenuOpen] = useState(false);
  const addTripMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addTripMenuRef.current && !addTripMenuRef.current.contains(event.target as Node)) setAddTripMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const yearEntries = useMemo(() => entries.filter((e) => e.date.startsWith(taxYear)), [entries, taxYear]);
  const businessEntries = useMemo(() => yearEntries.filter((e) => e.type === "BUSINESS"), [yearEntries]);
  const personalEntries = useMemo(() => yearEntries.filter((e) => e.type === "PERSONAL"), [yearEntries]);
  const totalBusinessMiles = useMemo(() => businessEntries.reduce((sum, e) => sum + e.miles, 0), [businessEntries]);
  const totalMiles = useMemo(() => yearEntries.reduce((sum, e) => sum + e.miles, 0), [yearEntries]);
  const potentialDeduction = useMemo(() => businessEntries.reduce((sum, e) => sum + e.miles * e.ratePerMile, 0), [businessEntries]);

  const now = new Date();
  const currentMonthName = now.toLocaleString("en-US", { month: "long" });
  const businessTripsThisMonth = useMemo(
    () => businessEntries.filter((e) => new Date(e.date).getMonth() === now.getMonth() && String(now.getFullYear()) === taxYear).length,
    [businessEntries, now, taxYear]
  );

  const monthlyBusinessMiles = useMemo(() => {
    const totals = new Array(12).fill(0);
    businessEntries.forEach((e) => {
      const month = Number(e.date.slice(5, 7)) - 1;
      totals[month] += e.miles;
    });
    return totals;
  }, [businessEntries]);
  const maxMonthlyMiles = Math.max(...monthlyBusinessMiles, 1);

  const tabRows = tab === "unreviewed" ? [] : tab === "business" ? businessEntries : tab === "personal" ? personalEntries : yearEntries;
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tabRows
      .filter((e) => query === "" || locationLabel(e).toLowerCase().includes(query) || (e.purpose ?? "").toLowerCase().includes(query))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [tabRows, search]);

  async function handleSaveTrip(input: CreateMileageEntryInput, roundTrip: boolean) {
    try {
      await add(input);
      if (roundTrip) {
        await add({ ...input, startAddress: input.endAddress, endAddress: input.startAddress });
      }
      toast({ variant: "success", title: roundTrip ? "2 trips logged" : "Trip logged" });
      setShowAddTripDrawer(false);
    } catch (err) {
      toast({ variant: "error", title: "Could not log this trip", description: err instanceof Error ? err.message : undefined });
    }
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (showOnboarding) {
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold text-[var(--color-text-global)]">Mileage</h1>
        <MileageOnboarding
          onAddTripManually={() => {
            setOnboardingSkipped(true);
            setShowAddTripDrawer(true);
          }}
          onSkip={() => setOnboardingSkipped(true)}
        />
        {showAddTripDrawer ? <AddTripDrawer onSave={handleSaveTrip} onClose={() => setShowAddTripDrawer(false)} /> : null}
      </>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Mileage</h1>
        <div className="relative" ref={addTripMenuRef}>
          <div className="flex overflow-hidden rounded-full">
            <Button className="rounded-r-none" onClick={() => setShowAddTripDrawer(true)}>
              Add trip
            </Button>
            <Button className="rounded-l-none border-l border-l-white/20 px-2" aria-label="More add-trip options" onClick={() => setAddTripMenuOpen((v) => !v)}>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
          {addTripMenuOpen ? (
            <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
              {ADD_TRIP_MENU_ITEMS.map((label) => (
                <button
                  key={label}
                  type="button"
                  disabled
                  title="Not available yet"
                  className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-sm text-[var(--color-text-disabled)]"
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-4">
        <p className="mb-1 text-sm text-[var(--color-text-primary)]">Tax Year:</p>
        <div className="w-40">
          <Select value={taxYear} onChange={setTaxYear} options={yearOptions()} placeholder="Year" allowCustomValue={false} />
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-[var(--color-divider-tertiary)]">
        <div className="p-5">
          <p className="text-base text-[var(--color-text-primary)]">Potential deduction for {taxYear}</p>
          <p className="text-3xl font-semibold text-[var(--color-text-global)]">{formatWholeMoney(potentialDeduction)}</p>
        </div>

        <div className="flex flex-col gap-0 border-t border-[var(--color-divider-tertiary)] lg:flex-row">
          <div className="flex-1 p-5">
            <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] pb-4">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-positive)]" aria-hidden="true" />
                <div>
                  <p className="font-medium text-[var(--color-text-global)]">Potential deduction</p>
                  <p className="text-sm text-[var(--color-text-disabled)]">
                    {businessTripsThisMonth} Business trip{businessTripsThisMonth === 1 ? "" : "s"} in {currentMonthName}
                  </p>
                </div>
              </div>
              <p className="font-medium text-[var(--color-text-global)]">{formatWholeMoney(potentialDeduction)}</p>
            </div>
            <div className="flex items-center justify-between pt-4">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--color-container-border-primary,var(--color-divider-tertiary))]" aria-hidden="true" />
                <div>
                  <p className="font-medium text-[var(--color-text-global)]">0 Unreviewed</p>
                  <p className="text-sm text-[var(--color-text-disabled)]">Keep reviewing to get more deductions</p>
                </div>
              </div>
              <p className="font-medium text-[var(--color-text-global)]">$0</p>
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center bg-[var(--color-container-background-accent)] p-5">
            {totalBusinessMiles > 0 ? (
              <div className="flex h-32 w-full items-end gap-1.5">
                {monthlyBusinessMiles.map((value, i) => (
                  <div key={MONTH_LABELS[i]} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-[var(--color-positive)]" style={{ height: `${Math.max((value / maxMonthlyMiles) * 96, value > 0 ? 4 : 0)}px` }} title={`${value} mi`} />
                    <span className="text-[9px] text-[var(--color-icon-secondary)]">{MONTH_LABELS[i]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center">
                <BarChart3 className="h-8 w-8 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                <p className="font-medium text-[var(--color-text-global)]">No data to display</p>
                <p className="text-sm text-[var(--color-text-disabled)]">Add trip to view data</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-[var(--color-divider-tertiary)] p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-global)]">
            <Gauge className="h-5 w-5 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            <div>
              <p className="font-medium">{totalBusinessMiles.toFixed(2)}</p>
              <p className="text-xs text-[var(--color-text-disabled)]">Total business miles</p>
            </div>
            <span className="mx-2 h-8 w-px bg-[var(--color-divider-tertiary)]" />
            <div>
              <p className="font-medium">{totalMiles}</p>
              <p className="text-xs text-[var(--color-text-disabled)]">Total miles</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <Car className="h-5 w-5 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            <div>
              <p className="font-medium text-[var(--color-text-global)]">My vehicle</p>
              <p className="text-xs text-[var(--color-text-disabled)]">
                Primary vehicle · <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-[var(--color-link-action)]">Manage vehicles</button>
              </p>
            </div>
          </div>

          <div className="text-sm">
            <p className="font-medium text-[var(--color-text-global)]">
              {formatRate(DEFAULT_MILEAGE_RATE)} <span className="font-normal text-[var(--color-text-disabled)]">Per mile</span>
            </p>
            <p className="max-w-xs text-xs text-[var(--color-text-disabled)]">You&apos;re driving towards a sizable mileage allowance. Keep it up!</p>
          </div>
        </div>
      </div>

      <div className="mb-3 flex gap-6 border-b border-[var(--color-divider-tertiary)]">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
              tab === value ? "border-[var(--color-positive)] text-[var(--color-text-global)]" : "border-transparent text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative mb-3 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
        <InputField placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="w-10 px-2 pb-[5px] pt-2 text-left align-middle">
                <input type="checkbox" disabled />
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Date</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Location</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Distance</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Potential deductions</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Vehicle</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Type</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {!hydrated ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-16 text-center">
                  <p className="text-lg font-semibold text-[var(--color-text-global)]">No trips here - yet!</p>
                  <p className="mt-1 text-sm text-[var(--color-text-disabled)]">Click the Add trip button to create one</p>
                </td>
              </tr>
            ) : (
              filteredRows.map((entry) => (
                <tr key={entry.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top">
                    <input type="checkbox" disabled />
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{entry.date}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{locationLabel(entry)}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">{entry.miles.toLocaleString()} mi</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">
                    {entry.type === "BUSINESS" ? formatMoney(entry.miles * entry.ratePerMile) : "$0.00"}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">My vehicle</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{entry.type === "BUSINESS" ? "Business" : "Personal"}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                    <button type="button" onClick={() => remove(entry.id)} className="text-sm font-medium text-[var(--color-negative)] hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAddTripDrawer ? <AddTripDrawer onSave={handleSaveTrip} onClose={() => setShowAddTripDrawer(false)} /> : null}
    </>
  );
}
