"use client";

import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, Download, FileText, MessageSquarePlus, Search, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { useVendors } from "@/lib/hooks/use-vendors";
import type { UpdateVendorInput, Vendor } from "@/lib/services/vendors-service";
import { useBills } from "@/lib/hooks/use-bills";
import type { Bill } from "@/lib/services/bills-service";

// The IRS 1099-NEC/MISC reporting threshold -- a contractor paid less than
// this in the tax year doesn't need one filed, though tracking them here
// is still fine (e.g. for next year). Matches QBO's own "reportable"
// framing on this screen.
const REPORTABLE_THRESHOLD = 600;

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

function maskTaxId(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return value;
  return `XX-XXX${digits.slice(-4)}`;
}

// -- E-file tab -----------------------------------------------------------
// Matches the reference layout (hero, checklist, dates, a short "how it
// works" walkthrough, FAQs), but real online e-filing needs a licensed
// tax-prep provider integration this app doesn't have -- so both CTA
// buttons are honestly disabled, and the reference's pricing table and
// "how they compare" plan comparison (both specific to Intuit's own paid
// tiers) are replaced with one clear notice instead of inventing prices
// or plans this app doesn't sell.
function EFileTab({ onGoToRecipients }: { onGoToRecipients: () => void }) {
  const { toast } = useToast();
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  function notAvailable() {
    toast({ variant: "info", title: "Not available yet", description: "Online e-filing needs a licensed tax-prep provider integration this app doesn't have yet." });
  }

  const faqs: { q: string; a: string }[] = [
    { q: "What is a 1099?", a: "A 1099-NEC reports nonemployee compensation of $600 or more paid to a contractor during the year; a 1099-MISC covers certain other payments (rent, royalties, etc). Businesses generally must send one to each qualifying recipient and file a copy with the IRS." },
    { q: "Can I print & mail my filing instead of e-filing?", a: "Yes. If you're filing fewer than 10 combined W-2s and 1099s for the year, the IRS lets you file on paper. You can print the forms from the Recipients & W-9s tab once you've filled in each contractor's details." },
    { q: "What 1099 forms are commonly used?", a: "The two most common are the 1099-NEC (nonemployee compensation) and the 1099-MISC (rents, royalties, and other miscellaneous income)." },
    { q: "What info do I need to prepare a 1099?", a: "Each recipient's legal name, current address, and taxpayer ID (SSN or EIN) -- usually collected on a Form W-9 before you pay them -- plus the total amount paid during the tax year." },
    { q: "Do I need to file with my state as well as the IRS?", a: "Some states require a separate state 1099 filing in addition to the federal one; requirements vary by state, so check your state's department of revenue." },
    { q: "What if I made a mistake on a filed form?", a: "You can file a corrected 1099 with the IRS. Since online e-filing isn't available in this app yet, corrections would need to go through the IRS directly or your accountant." },
    { q: "What if I can't file by the IRS deadline?", a: "The IRS offers a 30-day extension via Form 8809, though it isn't automatic for forms reporting nonemployee compensation. File as soon as possible either way to limit penalties." }
  ];

  return (
    <div className="flex flex-col gap-16">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-4xl font-semibold leading-tight text-[var(--color-text-global)]">Fast track your 1099s with autofilled forms</h2>
          <div className="mt-6 flex flex-col gap-1.5">
            {["Save time and minimize errors with forms ready to review", "Makes updates as needed—so you're always in control", "Autofilled from the vendors you already track here"].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-positive)]" aria-hidden="true" />
                <span className="text-sm text-[var(--color-text-primary)]">{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={notAvailable}>Try autofilled forms</Button>
            <Button variant="secondary" onClick={onGoToRecipients}>
              Prep my own forms
            </Button>
          </div>
          <p className="mt-3 text-sm text-[var(--color-text-disabled)]">Online e-filing isn&apos;t available in this app yet -- see the FAQs below for printing and mailing instead.</p>

          <div className="mt-10 flex gap-16">
            <div>
              <p className="font-semibold text-[var(--color-text-global)]">January 1 - May 7</p>
              <p className="text-sm text-[var(--color-text-primary)]">Typical IRS filing window</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--color-text-global)]">January 31</p>
              <p className="text-sm text-[var(--color-text-primary)]">Deadline to mail 1099 copies to recipients</p>
            </div>
          </div>
        </div>

        <div className="flex w-full max-w-sm shrink-0 items-center justify-center rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] p-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <Sparkles className="h-10 w-10 text-[var(--color-ui-primary)]" aria-hidden="true" />
            <p className="font-medium text-[var(--color-text-global)]">Autofilled 1099 preview</p>
            <p className="text-sm text-[var(--color-text-disabled)]">Not available yet -- this is a preview of the planned layout.</p>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-6 text-center text-lg text-[var(--color-text-primary)]">Autofilled forms — simplified from start to finish</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { title: "1. Pull from your vendors", body: "Contractors you've already flagged for 1099 tracking are the starting list -- no separate entry." },
            { title: "2. Review the amounts", body: "Reportable payments are totaled up automatically once bills are marked paid." },
            { title: "3. Print or file", body: "Once online e-filing is connected, forms go out from here -- for now, print and mail instead." }
          ].map((step) => (
            <div key={step.title} className="rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] p-5">
              <p className="font-semibold text-[var(--color-text-global)]">{step.title}</p>
              <p className="mt-1 text-sm text-[var(--color-text-primary)]">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-[var(--color-info-border)] bg-[var(--color-container-background-accent)] p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ui-primary)]" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-primary)]">
          Online 1099 e-filing (and its per-form pricing) isn&apos;t available in this app yet. Use the{" "}
          <button type="button" onClick={onGoToRecipients} className="font-medium text-[var(--color-link-action)] hover:underline">
            Recipients &amp; W-9s
          </button>{" "}
          tab to gather what you need, then file directly with the IRS or through your accountant.
        </p>
      </div>

      <div>
        <p className="mb-2 text-lg font-semibold text-[var(--color-text-global)]">FAQs</p>
        <div className="flex flex-col divide-y divide-[var(--color-divider-tertiary)] border-t border-[var(--color-divider-tertiary)]">
          {faqs.map(({ q, a }) => {
            const isOpen = openFaq === q;
            return (
              <div key={q}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : q)}
                  className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-medium text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                >
                  {q}
                  <span className="flex shrink-0 items-center gap-1 text-[var(--color-link-action)]">
                    {isOpen ? "Hide" : "Show"}
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </span>
                </button>
                {isOpen ? <p className="pb-4 text-sm text-[var(--color-text-primary)]">{a}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// -- Recipients & W-9s tab --------------------------------------------------
function RecipientsTab({
  vendors,
  bills,
  hydrated,
  updateVendor
}: {
  vendors: Vendor[];
  bills: Bill[];
  hydrated: boolean;
  updateVendor: (id: string, patch: UpdateVendorInput) => Promise<Vendor>;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
  const contractors = useMemo(() => vendors.filter((v) => v.is1099Contractor), [vendors]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return contractors.filter((v) => (query === "" || v.name.toLowerCase().includes(query)) && (statusFilter === "" || v.status === statusFilter));
  }, [contractors, search, statusFilter]);

  // What each recipient was actually paid in the selected tax year --
  // paid bills only (a DRAFT/OPEN bill hasn't moved money yet), per the
  // plan doc's "vendors + their paid-bill totals for the tax year".
  const paidTotalByVendor = useMemo(() => {
    const totals = new Map<string, number>();
    bills
      .filter((b) => b.status === "PAID" && b.billDate.startsWith(taxYear))
      .forEach((b) => totals.set(b.vendorId, (totals.get(b.vendorId) ?? 0) + b.amount));
    return totals;
  }, [bills, taxYear]);

  function exportCsv() {
    const header = `Recipient,Company Name,Full Name,Address,TIN/SSN,W-9 Status,Total Paid (${taxYear})\n`;
    const rows = filtered.map((v) =>
      [v.name, v.companyName ?? "", v.name, v.address ?? "", v.taxId ?? "", v.w9Received ? "Received" : "Missing", (paidTotalByVendor.get(v.id) ?? 0).toFixed(2)]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `1099-recipients-${taxYear}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h2 className="text-3xl font-semibold text-[var(--color-text-global)]">Everyone you&apos;ll file for at tax time</h2>
      <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-primary)]">
        Vendors flagged for 1099 tracking on the Vendors screen show up here. Double-check each one has an address and taxpayer ID before you file.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled title="Not available yet" className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          Missing W-9 info? Import W-9s
        </button>
        <a href="/all-apps/expenses-bills/vendors" className="rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)]">
          Open Vendors list
        </a>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-icon-secondary)]" aria-hidden="true" />
            <InputField placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="w-40">
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "View all" },
                { value: "ACTIVE", label: "Active" },
                { value: "ARCHIVED", label: "Inactive" }
              ]}
              placeholder="View all"
              allowCustomValue={false}
              optionSize="sm"
            />
          </div>
          <div className="w-28">
            <Select value={taxYear} onChange={setTaxYear} options={yearOptions()} placeholder="Year" allowCustomValue={false} optionSize="sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Export as CSV
          </Button>
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            Vendor Contact List
          </button>
          <a href="/all-apps/expenses-bills/vendors" className="rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)]">
            Include more recipients
          </a>
        </div>
      </div>

      <div className="tw-override mt-4 overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">Recipient</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Company name</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">1099 tracking</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Address</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">TIN/SSN</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">W-9 status</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Total paid ({taxYear})</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {!hydrated ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-16 text-center">
                  <Search className="mx-auto mb-3 h-8 w-8 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                  <p className="text-lg font-semibold text-[var(--color-text-global)]">You&apos;re all caught up</p>
                  <p className="mt-1 text-sm text-[var(--color-text-disabled)]">
                    Think someone is missing?{" "}
                    <a href="/all-apps/expenses-bills/vendors" className="text-[var(--color-link-action)] hover:underline">
                      Include more recipients
                    </a>
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((vendor) => (
                <tr key={vendor.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top text-[13px] font-medium text-[var(--color-text-global)]">{vendor.name}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{vendor.companyName || "--"}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]">
                    <Badge variant="info" size="sm">
                      Tracked
                    </Badge>
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] w-56 p-2 align-top">
                    <InputField
                      size="sm"
                      placeholder="Add address"
                      defaultValue={vendor.address ?? ""}
                      onBlur={(e) => {
                        if (e.target.value !== (vendor.address ?? "")) {
                          updateVendor(vendor.id, { address: e.target.value.trim() || undefined })
                            .then(() => toast({ variant: "success", title: "Address saved" }))
                            .catch((err) => toast({ variant: "error", title: "Could not save address", description: err instanceof Error ? err.message : undefined }));
                        }
                      }}
                    />
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] w-40 p-2 align-top">
                    <InputField
                      size="sm"
                      placeholder="Add TIN/SSN"
                      defaultValue={vendor.taxId ? maskTaxId(vendor.taxId) : ""}
                      onFocus={(e) => {
                        if (vendor.taxId) e.target.value = vendor.taxId;
                      }}
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        if (raw !== (vendor.taxId ?? "")) {
                          updateVendor(vendor.id, { taxId: raw || undefined })
                            .then(() => toast({ variant: "success", title: "Taxpayer ID saved" }))
                            .catch((err) => toast({ variant: "error", title: "Could not save taxpayer ID", description: err instanceof Error ? err.message : undefined }));
                        }
                        e.target.value = raw ? maskTaxId(raw) : "";
                      }}
                    />
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px]">
                    <Checkbox
                      label={vendor.w9Received ? "Received" : "Missing"}
                      checked={vendor.w9Received}
                      onChange={(e) =>
                        updateVendor(vendor.id, { w9Received: e.target.checked })
                          .then(() => toast({ variant: "success", title: e.target.checked ? "W-9 marked received" : "W-9 marked missing" }))
                          .catch((err) => toast({ variant: "error", title: "Could not update W-9 status", description: err instanceof Error ? err.message : undefined }))
                      }
                    />
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px]">
                    <p className="text-[var(--color-text-global)]">{formatMoney(paidTotalByVendor.get(vendor.id) ?? 0)}</p>
                    {(paidTotalByVendor.get(vendor.id) ?? 0) >= REPORTABLE_THRESHOLD ? (
                      <Badge variant="warning" size="sm">
                        Reportable
                      </Badge>
                    ) : (
                      <span className="text-xs text-[var(--color-text-disabled)]">Below $600</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// -- Completed forms tab -----------------------------------------------------
function CompletedFormsTab() {
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  return (
    <div>
      {!bannerDismissed ? (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-[var(--color-warning-bg)] bg-[var(--color-warning-bg)] p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning-text)]" aria-hidden="true" />
            <p className="text-sm text-[var(--color-warning-text)]">Online 1099 e-filing isn&apos;t available in this app yet, so nothing here has been filed.</p>
          </div>
          <button type="button" onClick={() => setBannerDismissed(true)} aria-label="Dismiss" className="text-[var(--color-warning-text)]">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[var(--color-text-global)]">Current filings</span>
          <div className="w-28">
            <Select value={year} onChange={setYear} options={yearOptions()} placeholder="Year" allowCustomValue={false} optionSize="sm" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            View summary
          </button>
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            Download
          </button>
        </div>
      </div>

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[800px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">Name</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Filing date</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Form</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Recipient&apos;s copy</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Status</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Actions</th>
            </tr>
          </thead>
          <tbody className="content-table">
            <tr>
              <td colSpan={6} className="px-3 py-16 text-center">
                <FileText className="mx-auto mb-3 h-8 w-8 text-[var(--color-icon-secondary)]" aria-hidden="true" />
                <p className="text-lg font-semibold text-[var(--color-text-global)]">No 1099&apos;s found</p>
                <p className="mt-1 text-sm text-[var(--color-text-disabled)]">There are no 1099 e-filings to show.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-end gap-3 text-sm text-[var(--color-text-primary)]">
        <span>0 - 0 of 0 items</span>
        <IconButton icon={ChevronLeft} label="Previous page" size="sm" disabled />
        <span className="flex h-7 w-8 items-center justify-center rounded border border-[var(--color-divider-tertiary)]">1</span>
        <span>of 1</span>
        <IconButton icon={ChevronRight} label="Next page" size="sm" disabled />
      </div>
    </div>
  );
}

// Phase 1.5, Step 4: a real report over real Vendors + paid Bills data --
// each 1099 recipient's actual total paid for the selected tax year, per
// the plan doc ("a report over vendors + their paid-bill totals"). Real
// e-filing needs a licensed tax-prep provider integration -- explicitly
// out of scope (see newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md),
// so the E-file and Completed forms tabs say so plainly instead of
// pretending a filing capability exists. Matches the reference's 3-tab
// layout; the reference E-file tab's specific per-form pricing and
// paid-tier comparison table are Intuit's own commercial terms, not
// something this app sells, so those are replaced with one honest
// notice instead of invented prices.
export function NineteenNinetyNinesPage() {
  const { activeCompany } = useCompany();
  const { items: vendors, hydrated, update } = useVendors();
  const { items: bills } = useBills();

  const [tab, setTab] = useState<TabValue>("efile");

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">1099s</h1>
        <button type="button" disabled title="Not available yet" className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          Give feedback
        </button>
      </div>

      <div className="mb-6 flex gap-1 border-b border-[var(--color-divider-tertiary)]">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === value ? "border-[var(--color-positive)] text-[var(--color-text-global)]" : "border-transparent text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "efile" ? <EFileTab onGoToRecipients={() => setTab("recipients")} /> : null}
      {tab === "recipients" ? <RecipientsTab vendors={vendors} bills={bills} hydrated={hydrated} updateVendor={update} /> : null}
      {tab === "completed" ? <CompletedFormsTab /> : null}
    </>
  );
}
