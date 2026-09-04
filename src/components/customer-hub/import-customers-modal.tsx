"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast/toast-context";

const STEPS = ["Upload", "Map data", "Import"];

const SAMPLE_CSV = "Customer Name,Company Name,Email,Phone\nAcme Corp,Acme Corp LLC,billing@acmecorp.com,555-0100\n";

function downloadSampleFile() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "customer-import-sample.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// Matches the reference 3-step "Import customers" wizard -- same shape as
// ImportVendorsModal. Phase 1, UI only: file selection and the sample-file
// download are real; parsing/mapping columns and creating real Customer
// records from a file is import logic, not UI, so it's deferred.
export function ImportCustomersModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [fileName, setFileName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function notAvailable() {
    toast({ variant: "info", title: "Not available yet", description: "Mapping and importing columns isn't wired up yet -- this wizard is a UI preview for now." });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-container-background-primary)]">
      <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-6 py-3">
        <h2 className="text-xl font-semibold text-[var(--color-text-global)]">Import customers</h2>
        <div className="flex items-center gap-4">
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)]">
            Help
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 border-b border-[var(--color-divider-tertiary)] px-6 py-4">
        {STEPS.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  index === 0 ? "bg-[var(--color-ui-primary)] text-white" : "border border-[var(--color-divider-tertiary)] text-[var(--color-text-disabled)]"
                }`}
              >
                {index + 1}
              </span>
              <span className={`text-xs uppercase tracking-wide ${index === 0 ? "text-[var(--color-text-global)]" : "text-[var(--color-text-disabled)]"}`}>{step}</span>
            </div>
            {index < STEPS.length - 1 ? <span className="h-px w-16 bg-[var(--color-divider-tertiary)]" /> : null}
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h3 className="mb-3 text-lg font-semibold text-[var(--color-text-global)]">First time importing customers?</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text-primary)]">
              <li>All your customer information must be in one file</li>
              <li>The top row of your file must contain a header title for each column of information</li>
              <li>
                <span className="font-semibold">Customer Name</span> is the only required field
              </li>
            </ul>
          </div>
          <Button variant="secondary" onClick={notAvailable}>
            Feedback
          </Button>
        </div>

        <div className="flex flex-wrap gap-6">
          <div className="w-[340px] rounded-lg border border-[var(--color-divider-tertiary)] p-5">
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={fileName}
                className="h-9 flex-1 rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-3 text-sm text-[var(--color-input-text)]"
              />
              <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                Browse
              </Button>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")} />
            </div>
            <button type="button" onClick={downloadSampleFile} className="mt-2 text-sm text-[var(--color-link-action)] hover:underline">
              Download a sample file
            </button>
          </div>

          <div className="w-[340px] rounded-lg border border-[var(--color-divider-tertiary)] p-5">
            <p className="mb-3 text-sm font-medium text-[var(--color-text-global)]">Select Google Sheet</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value=""
                placeholder="Connect Google Sheets web-based spreadsheet program"
                className="h-9 flex-1 rounded border border-[var(--color-input-border-primary)] bg-[var(--color-input-background)] px-3 text-sm text-[var(--color-text-disabled)]"
              />
              <Button variant="secondary" onClick={notAvailable}>
                Connect
              </Button>
            </div>
            <button type="button" onClick={notAvailable} className="mt-2 text-sm text-[var(--color-link-action)] hover:underline">
              Preview a sample
            </button>
            <p className="mt-4 text-xs text-[var(--color-icon-secondary)]">Google Sheets isn&apos;t connected yet.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--color-divider-tertiary)] px-6 py-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={notAvailable} disabled={!fileName}>
          Next
        </Button>
      </div>
    </div>
  );
}
