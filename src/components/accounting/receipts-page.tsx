"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Filter as FilterIcon, HelpCircle, MessageSquarePlus, SlidersHorizontal, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { companyScopedKey, localId, useLocalCollection } from "@/lib/local-store/use-local-collection";
import type { ReceiptRecord } from "@/lib/local-store/expenses-bills-types";
import { useVendors } from "@/lib/hooks/use-vendors";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import { isRegisterAccountCategory } from "@/modules/accounting/presentation/transaction-type-policy";
import type { Account } from "@/modules/accounting/domain/models";

const PAGE_SIZE = 25;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isReviewed(receipt: ReceiptRecord): boolean {
  return Boolean(receipt.vendorId && receipt.categoryAccountId && receipt.amount);
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// A company-scoped label for the "email receipts in" affordance shown
// below -- display only. There's no real inbound-email pipeline behind
// it (that's a Phase 1.5+ backend feature), so nothing actually receives
// mail sent to this address; it exists to keep the reference layout
// intact rather than to promise a working feature.
function receiptsInboxAddress(companyName: string): string {
  const slug = companyName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "company";
  return `${slug}+receipts@assist.newgl.app`;
}

// Phase 1: records that a receipt exists (filename, size, when) plus
// review fields (vendor/payment account/category/amount) filled in
// manually -- doesn't store the file itself yet, and there's no OCR
// auto-fill (a real backend + AI feature, Phase 1.5+). See
// newgl-specs/plans/qbo-free-features/QBO_FREE_FEATURES_PLAN.md.
export function ReceiptsPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const services = useMemo(() => getServiceContainer(), []);
  const [accounts, setAccounts] = useState<Account[]>([]);
  useEffect(() => {
    services.accountService.listAccounts().then(setAccounts).catch(() => setAccounts([]));
  }, [services]);
  const categoryOptions = useMemo(
    () => accounts.filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE").map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const paymentAccountOptions = useMemo(
    () => accounts.filter((a) => isRegisterAccountCategory(a.category)).map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  );
  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const { items: vendors } = useVendors();
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v.id, label: v.name })), [vendors]);
  const vendorNameById = useMemo(() => new Map(vendors.map((v) => [v.id, v.name])), [vendors]);

  const storageKey = activeCompany ? companyScopedKey(activeCompany.name, "receipts") : null;
  const { items: receipts, hydrated, add, update, remove } = useLocalCollection<ReceiptRecord>(storageKey ?? "newgl:phase1:pending:receipts");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [tab, setTab] = useState<"review" | "reviewed">("review");
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const uploadMenuRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!uploadMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (uploadMenuRef.current && !uploadMenuRef.current.contains(event.target as Node)) setUploadMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setUploadMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [uploadMenuOpen]);

  const forReview = useMemo(
    () => receipts.filter((r) => !isReviewed(r)).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [receipts]
  );
  const reviewed = useMemo(
    () => receipts.filter(isReviewed).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    [receipts]
  );
  const visible = tab === "review" ? forReview : reviewed;
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = visible.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(currentPage * PAGE_SIZE, visible.length);
  const pageRows = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function switchTab(next: "review" | "reviewed") {
    setTab(next);
    setPage(1);
  }

  function handleFileSelected(file: File) {
    add({ id: localId(), fileName: file.name, fileSizeBytes: file.size, uploadedAt: new Date().toISOString() });
    setPage(1);
    toast({
      variant: "success",
      title: "Receipt added",
      description: "File storage isn't connected yet -- fill in the details below to move it to Reviewed."
    });
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  return (
    <>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold text-[var(--color-text-global)]">
          Receipts
          <HelpCircle className="h-4 w-4 text-[var(--color-icon-secondary)]" aria-hidden="true" />
        </h1>
        <div className="flex items-center gap-4">
          <button
            type="button"
            disabled
            title="Not available yet"
            className="cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)]"
          >
            Manage email settings
          </button>
          <button
            type="button"
            disabled
            title="Not available yet"
            className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            Give feedback
          </button>
          <div className="relative" ref={uploadMenuRef}>
            <Button onClick={() => setUploadMenuOpen((v) => !v)} className="flex items-center gap-1.5">
              Upload receipts
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
            {uploadMenuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setUploadMenuOpen(false);
                    inputRef.current?.click();
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]"
                >
                  Upload receipts
                </button>
                <button
                  type="button"
                  disabled
                  title="Google Drive isn't connected yet"
                  className="block w-full cursor-not-allowed px-3 py-1.5 text-left text-sm text-[var(--color-text-disabled)]"
                >
                  Upload from Google Drive
                </button>
              </div>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) handleFileSelected(file);
            }}
          />
        </div>
      </div>

      {/* Email-in banner ("Anyone can autofill multiple receipts... by
          sending files to: <address>") -- disabled for now, since there's
          no real inbound-email pipeline behind it yet (Phase 1.5+ backend
          feature). Re-enable once that exists; see receiptsInboxAddress
          above for the address format this used. */}

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileSelected(file);
        }}
        className={`mb-4 flex flex-col items-center gap-3 rounded-lg border border-dashed py-10 text-center transition-colors ${
          isDragOver ? "border-[var(--color-ui-primary)]" : "border-[var(--color-divider-tertiary)]"
        }`}
      >
        <p className="text-sm text-[var(--color-text-primary)]">Drag and drop documents anywhere in the dotted lines or select another option</p>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Upload from this device
        </Button>
        <p className="text-xs text-[var(--color-icon-secondary)]">Supported formats: PDF, PNG, JPEG, HEIC.</p>
      </div>

      {/* Tabs */}
      <div className="mb-2 flex gap-4 border-b border-[var(--color-divider-tertiary)]">
        <button
          type="button"
          onClick={() => switchTab("review")}
          className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
            tab === "review" ? "border-[var(--color-ui-primary)] text-[var(--color-text-global)]" : "border-transparent text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
          }`}
        >
          For review
        </button>
        <button
          type="button"
          onClick={() => switchTab("reviewed")}
          className={`border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
            tab === "reviewed" ? "border-[var(--color-ui-primary)] text-[var(--color-text-global)]" : "border-transparent text-[var(--color-text-primary)] hover:text-[var(--color-text-global)]"
          }`}
        >
          Reviewed
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled
          title="Filtering isn't available yet"
          className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]"
        >
          <FilterIcon className="h-3.5 w-3.5" aria-hidden="true" />
          Filter
        </button>
        <button
          type="button"
          disabled
          title="Not available yet"
          className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Customize
        </button>
      </div>

      {/* Table -- same header-table/content-table styling used across
          /register and the other Accounting screens, so the app's tables
          stay visually consistent whether they're QBO-parity screens or
          the original register. Column set and row count stay the same
          shape whether the tab has data or not -- only the tbody content
          swaps between real rows and the empty-state message. */}
      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="w-10 px-2 pb-[5px] pt-2 text-left align-middle">
                <input type="checkbox" disabled />
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Receipt</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">
                <span className="inline-flex items-center gap-1">Date <ChevronDown className="h-3 w-3" aria-hidden="true" /></span>
              </th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Vendor</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Payment account</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Amount / Tax</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Category</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {!hydrated ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-[var(--color-text-primary)]">
                  Loading…
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-14 text-center">
                  <p className="text-base font-semibold text-[var(--color-text-global)]">
                    {tab === "review" ? "Add new receipts to get started" : "No reviewed receipts yet"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-text-disabled)]">
                    {tab === "review"
                      ? "We'll pull out the info so you can review it and add it to your books."
                      : "Fill in vendor, category, and amount on a receipt to mark it reviewed."}
                  </p>
                </td>
              </tr>
            ) : (
              pageRows.map((receipt) => (
                <tr key={receipt.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top">
                    <input type="checkbox" disabled />
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-global)]">
                    {receipt.fileName}
                    <p className="text-xs text-[var(--color-icon-secondary)]">{formatBytes(receipt.fileSizeBytes)}</p>
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">
                    {new Date(receipt.uploadedAt).toLocaleDateString()}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] w-40 p-2 align-top">
                    {tab === "review" ? (
                      <Select
                        value={receipt.vendorId ?? ""}
                        onChange={(v) => update(receipt.id, { vendorId: v || undefined })}
                        options={vendorOptions}
                        placeholder="Select vendor"
                        allowCustomValue={false}
                        optionSize="sm"
                      />
                    ) : (
                      <span className="text-[13px] text-[var(--color-text-primary)]">{vendorNameById.get(receipt.vendorId ?? "") ?? "--"}</span>
                    )}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] w-40 p-2 align-top">
                    {tab === "review" ? (
                      <Select
                        value={receipt.paymentAccountId ?? ""}
                        onChange={(v) => update(receipt.id, { paymentAccountId: v || undefined })}
                        options={paymentAccountOptions}
                        placeholder="Select account"
                        allowCustomValue={false}
                        optionSize="sm"
                      />
                    ) : (
                      <span className="text-[13px] text-[var(--color-text-primary)]">{accountNameById.get(receipt.paymentAccountId ?? "") ?? "--"}</span>
                    )}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] w-32 p-2 align-top text-right">
                    {tab === "review" ? (
                      <NumberField
                        currency
                        placeholder="0.00"
                        value={receipt.amount != null ? String(receipt.amount) : ""}
                        onChange={(e) => update(receipt.id, { amount: Number(e.target.value) || undefined })}
                        size="sm"
                      />
                    ) : (
                      <span className="text-[13px] text-[var(--color-text-global)]">{receipt.amount != null ? formatMoney(receipt.amount) : "--"}</span>
                    )}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] w-40 p-2 align-top">
                    {tab === "review" ? (
                      <Select
                        value={receipt.categoryAccountId ?? ""}
                        onChange={(v) => update(receipt.id, { categoryAccountId: v || undefined })}
                        options={categoryOptions}
                        placeholder="Select category"
                        allowCustomValue={false}
                        optionSize="sm"
                      />
                    ) : (
                      <span className="text-[13px] text-[var(--color-text-primary)]">{accountNameById.get(receipt.categoryAccountId ?? "") ?? "--"}</span>
                    )}
                  </td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                    <button type="button" onClick={() => remove(receipt.id)} className="text-sm font-medium text-[var(--color-negative)] hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="mt-2 flex items-center justify-between gap-3 text-sm text-[var(--color-text-primary)]">
        <span>{visible.length === 0 ? "0 - 0 of 0 items" : `${pageStart} - ${pageEnd} of ${visible.length} items`}</span>
        <div className="flex items-center gap-2">
          <IconButton icon={ChevronsLeft} label="First page" size="sm" disabled={currentPage <= 1} onClick={() => setPage(1)} />
          <IconButton icon={ChevronLeft} label="Previous page" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
          <span className="flex items-center gap-1.5">
            Page
            <span className="flex h-7 w-10 items-center justify-center rounded border border-[var(--color-divider-tertiary)]">{currentPage}</span>
            of {totalPages}
          </span>
          <IconButton icon={ChevronRight} label="Next page" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} />
          <IconButton icon={ChevronsRight} label="Last page" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)} />
        </div>
      </div>
    </>
  );
}
