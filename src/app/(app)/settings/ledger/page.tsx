"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Download, History, Pencil, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { BulkPasteImport } from "@/components/settings/bulk-paste-import";
import { LedgerDownloadPanel } from "@/components/settings/ledger-download-panel";
import { LedgerFileEditor } from "@/components/settings/ledger-file-editor";
import { LedgerUploadFileModal } from "@/components/settings/ledger-upload-file-modal";
import { LedgerVersionHistory } from "@/components/settings/ledger-version-history";
import { useCompany } from "@/lib/company/company-provider";

type ModalState =
  | { type: "bulkPaste"; name: string }
  | { type: "download"; name: string; displayName: string }
  | { type: "history"; name: string; displayName: string }
  | { type: "upload" }
  | { type: "rename"; name: string; currentLabel: string };

export default function LedgerSettingsPage() {
  return (
    <Suspense fallback={null}>
      <LedgerSettingsPageInner />
    </Suspense>
  );
}

function LedgerSettingsPageInner() {
  const { companies, loading, error, updateCompanyLabel } = useCompany();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openFile, setOpenFile] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Deep link from the home dashboard's "Bulk paste import" shortcut --
  // opens the modal for whichever company is currently active, since that's
  // the only one bulk-paste actually works against. One-shot: strip the
  // query param immediately so re-opening later (e.g. after closing the
  // modal) doesn't re-trigger it.
  useEffect(() => {
    if (searchParams.get("bulkPaste") !== "1" || loading) return;
    const active = companies.find((c) => c.isActive);
    if (active) setModal({ type: "bulkPaste", name: active.name });
    router.replace("/settings/ledger", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, companies]);

  if (openFile) {
    const company = companies.find((c) => c.name === openFile);
    return (
      <LedgerFileEditor
        ledgerName={openFile}
        displayName={company?.label || openFile}
        onCancel={() => setOpenFile(null)}
        onSaved={() => {}}
      />
    );
  }

  function openRename(name: string, currentLabel: string) {
    setRenameValue(currentLabel);
    setRenameError(null);
    setModal({ type: "rename", name, currentLabel });
  }

  async function handleRenameSave() {
    if (modal?.type !== "rename") return;
    setRenameSaving(true);
    setRenameError(null);
    try {
      await updateCompanyLabel(modal.name, renameValue.trim() || null);
      setModal(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Could not update the label");
    } finally {
      setRenameSaving(false);
    }
  }

  return (
    <>
      <Card
        title="Ledger files"
        description="Every .bean file behind your companies. Click a file to open it in the editor, or use the icons to bulk-paste transactions, download, or manage versions."
      >
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" onClick={() => setModal({ type: "upload" })}>
            <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Upload file
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : companies.length === 0 ? (
          <p className="text-sm text-[var(--color-text-primary)]">No files yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-divider-tertiary)]">
            {companies.map((company) => {
              const displayName = company.label || company.name;
              return (
                <li key={company.name} className="flex items-center justify-between gap-4 py-3">
                  <button
                    type="button"
                    onClick={() => setOpenFile(company.name)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-global)]">
                      <span className="truncate">{displayName}</span>
                      {company.isActive ? (
                        <span className="shrink-0 text-[11px] font-normal text-[var(--color-link-action)]">Active</span>
                      ) : null}
                      {company.isPrimary ? (
                        <span className="shrink-0 text-[11px] font-normal text-[var(--color-icon-secondary)]">
                          Primary
                        </span>
                      ) : null}
                    </p>
                    {company.label ? (
                      <p className="truncate text-xs text-[var(--color-icon-secondary)]">{company.name}</p>
                    ) : null}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Rename ${displayName}`}
                      onClick={() => openRename(company.name, company.label ?? "")}
                      className="rounded p-1.5 text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={
                        company.isActive
                          ? `Bulk paste import into ${displayName}`
                          : `Switch to ${displayName} to use bulk paste import`
                      }
                      title={company.isActive ? "Bulk paste import" : "Switch to this company first to bulk-paste import"}
                      disabled={!company.isActive}
                      onClick={() => setModal({ type: "bulkPaste", name: company.name })}
                      className="rounded p-1.5 text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-primary)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                    >
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Download ${displayName}`}
                      title="Download / copy"
                      onClick={() => setModal({ type: "download", name: company.name, displayName })}
                      className="rounded p-1.5 text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Version history for ${displayName}`}
                      title="Version history"
                      onClick={() => setModal({ type: "history", name: company.name, displayName })}
                      className="rounded p-1.5 text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      <History className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal open={modal?.type === "bulkPaste"} onClose={() => setModal(null)} size="lg">
        <BulkPasteImport />
      </Modal>

      <Modal
        open={modal?.type === "download"}
        onClose={() => setModal(null)}
        title="Download / copy"
        description={modal?.type === "download" ? modal.displayName : undefined}
      >
        {modal?.type === "download" ? <LedgerDownloadPanel ledgerName={modal.name} /> : null}
      </Modal>

      <Modal
        open={modal?.type === "history"}
        onClose={() => setModal(null)}
        title="Version history"
        description={modal?.type === "history" ? modal.displayName : undefined}
        size="lg"
      >
        {modal?.type === "history" ? <LedgerVersionHistory ledgerName={modal.name} /> : null}
      </Modal>

      <Modal open={modal?.type === "upload"} onClose={() => setModal(null)} title="Upload a .bean file" size="lg">
        <LedgerUploadFileModal onCreated={() => setModal(null)} />
      </Modal>

      <Modal open={modal?.type === "rename"} onClose={() => setModal(null)} title="Rename file" size="sm">
        <div className="flex flex-col gap-3">
          <InputField
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="e.g. Payroll ledger"
            autoFocus
          />
          {renameError ? <p className="text-sm text-red-600">{renameError}</p> : null}
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={handleRenameSave} disabled={renameSaving}>
              {renameSaving ? "Saving…" : "Save"}
            </Button>
            <Button variant="secondary" onClick={() => setModal(null)} disabled={renameSaving}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
