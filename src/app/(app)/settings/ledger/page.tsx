"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, Download, History, Pencil, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input-field";
import { Modal } from "@/components/ui/modal";
import { BulkPasteImport } from "@/components/settings/bulk-paste-import";
import { LedgerDownloadPanel } from "@/components/settings/ledger-download-panel";
import { LedgerFileEditor } from "@/components/settings/ledger-file-editor";
import { LedgerUploadFileModal } from "@/components/settings/ledger-upload-file-modal";
import { LedgerVersionHistory } from "@/components/settings/ledger-version-history";
import { BASE_API_URL } from "@/configuration";
import { useCompany } from "@/lib/company/company-provider";
import { getAccessToken, request } from "@/lib/services/http-service-container";
import {
  deleteLedgerFile,
  downloadLedgerFile,
  listLedgerFiles,
  listLedgerFileVersions,
  restoreLedgerFileVersion,
  updateLedgerFileLabel,
  uploadLedgerFile,
  type LedgerFile
} from "@/lib/services/ledger-files-service";

// One row is either the company's own primary .bean content (the one
// register/reports/accounts actually read) or an extra file scoped to
// that same company. Both render the same way in the list; only the
// backing load/save/download/version calls differ.
type FileRow = { kind: "primary"; name: string; label?: string } | (LedgerFile & { kind: "extra" });

type ModalState =
  | { type: "bulkPaste" }
  | { type: "download"; row: FileRow }
  | { type: "history"; row: FileRow }
  | { type: "upload" }
  | { type: "rename"; row: FileRow }
  | { type: "delete"; row: Extract<FileRow, { kind: "extra" }> };

type LedgerSummary = { name: string; version: number; contentHash: string; transactionCount: number; accountCount: number };

export default function LedgerSettingsPage() {
  return (
    <Suspense fallback={null}>
      <LedgerSettingsPageInner />
    </Suspense>
  );
}

function LedgerSettingsPageInner() {
  const { activeCompany, updateCompanyLabel } = useCompany();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [extraFiles, setExtraFiles] = useState<LedgerFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [openFile, setOpenFile] = useState<FileRow | null>(null);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setExtraFiles(await listLedgerFiles());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCompany) return;
    loadFiles();
    // Re-fetch whenever the active company changes -- the list is scoped
    // server-side to whichever company is active, so a different company
    // means a different list.
  }, [activeCompany?.name, loadFiles]);

  // Deep link from the home dashboard's "Bulk paste import" shortcut.
  useEffect(() => {
    if (searchParams.get("bulkPaste") !== "1") return;
    setModal({ type: "bulkPaste" });
    router.replace("/settings/ledger", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  const rows: FileRow[] = [
    { kind: "primary", name: activeCompany.name, label: activeCompany.label },
    ...extraFiles.map((f) => ({ ...f, kind: "extra" as const }))
  ];

  if (openFile) {
    return (
      <LedgerFileEditor
        displayName={openFile.label || openFile.name}
        load={
          openFile.kind === "primary"
            ? async () => {
                const accessToken = await getAccessToken();
                const response = await fetch(`${BASE_API_URL}/ledgers/${encodeURIComponent(openFile.name)}/download`, {
                  headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {}
                });
                if (!response.ok) throw new Error(`Could not load this file (${response.status})`);
                return response.text();
              }
            : () => downloadLedgerFile(openFile.id)
        }
        save={
          openFile.kind === "primary"
            ? async (content) => {
                const accessToken = await getAccessToken();
                const response = await fetch(`${BASE_API_URL}/ledgers/${encodeURIComponent(openFile.name)}/upload`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "text/plain",
                    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
                  },
                  body: content
                });
                if (!response.ok) {
                  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                  throw new Error(payload?.error ?? `Save failed (${response.status})`);
                }
                return response.json() as Promise<LedgerSummary>;
              }
            : (content) => uploadLedgerFile(openFile.id, content)
        }
        onCancel={() => setOpenFile(null)}
        onSaved={loadFiles}
      />
    );
  }

  function openRename(row: FileRow) {
    setRenameValue(row.label ?? "");
    setRenameError(null);
    setModal({ type: "rename", row });
  }

  async function handleRenameSave() {
    if (modal?.type !== "rename") return;
    setRenameSaving(true);
    setRenameError(null);
    try {
      const trimmed = renameValue.trim() || null;
      if (modal.row.kind === "primary") {
        await updateCompanyLabel(modal.row.name, trimmed);
      } else {
        await updateLedgerFileLabel(modal.row.id, trimmed);
        await loadFiles();
      }
      setModal(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Could not update the label");
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleDeleteConfirm() {
    if (modal?.type !== "delete") return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLedgerFile(modal.row.id);
      await loadFiles();
      setModal(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete this file");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card
        title={`Files for ${activeCompany.label || activeCompany.name}`}
        description="Only files for the company selected above (top left) are shown here -- switch companies to see a different set. Click a file to open it in the editor, or use the icons to download or manage versions."
      >
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" onClick={() => setModal({ type: "upload" })}>
            <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Upload file
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>
        ) : loadError ? (
          <p className="text-sm text-red-600">{loadError}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-[var(--color-divider-tertiary)]">
            {rows.map((row) => {
              const displayName = row.label || row.name;
              const key = row.kind === "primary" ? `primary:${row.name}` : `file:${row.id}`;
              return (
                <li key={key} className="flex items-center justify-between gap-4 py-3">
                  <button type="button" onClick={() => setOpenFile(row)} className="min-w-0 flex-1 text-left">
                    <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-global)]">
                      <span className="truncate">{displayName}</span>
                      {row.kind === "primary" ? (
                        <span className="shrink-0 text-[11px] font-normal text-[var(--color-icon-secondary)]">
                          Main ledger
                        </span>
                      ) : null}
                    </p>
                    {row.label ? <p className="truncate text-xs text-[var(--color-icon-secondary)]">{row.name}</p> : null}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Rename ${displayName}`}
                      title="Rename"
                      onClick={() => openRename(row)}
                      className="rounded p-1.5 text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {row.kind === "primary" ? (
                      <button
                        type="button"
                        aria-label="Bulk paste import"
                        title="Bulk paste import"
                        onClick={() => setModal({ type: "bulkPaste" })}
                        className="rounded p-1.5 text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-primary)]"
                      >
                        <ClipboardList className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Download ${displayName}`}
                      title="Download / copy"
                      onClick={() => setModal({ type: "download", row })}
                      className="rounded p-1.5 text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Version history for ${displayName}`}
                      title="Version history"
                      onClick={() => setModal({ type: "history", row })}
                      className="rounded p-1.5 text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-[var(--color-text-primary)]"
                    >
                      <History className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {row.kind === "extra" ? (
                      <button
                        type="button"
                        aria-label={`Delete ${displayName}`}
                        title="Delete"
                        onClick={() => {
                          setDeleteError(null);
                          setModal({ type: "delete", row });
                        }}
                        className="rounded p-1.5 text-[var(--color-icon-secondary)] transition-colors hover:bg-[var(--color-action-passive-subtle-hover)] hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : null}
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
        description={modal?.type === "download" ? modal.row.label || modal.row.name : undefined}
      >
        {modal?.type === "download" ? (
          <LedgerDownloadPanel
            fileBaseName={modal.row.name}
            dateRangeSupported={modal.row.kind === "primary"}
            fetchContent={async (range) => {
              const row = modal.row;
              if (row.kind === "primary") {
                const params = new URLSearchParams();
                if (range?.from) params.set("from", range.from);
                if (range?.to) params.set("to", range.to);
                const query = params.toString();
                const accessToken = await getAccessToken();
                const response = await fetch(
                  `${BASE_API_URL}/ledgers/${encodeURIComponent(row.name)}/download${query ? `?${query}` : ""}`,
                  { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }
                );
                if (!response.ok) throw new Error(`Export failed (${response.status})`);
                return response.text();
              }
              return downloadLedgerFile(row.id);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={modal?.type === "history"}
        onClose={() => setModal(null)}
        title="Version history"
        description={modal?.type === "history" ? modal.row.label || modal.row.name : undefined}
        size="lg"
      >
        {modal?.type === "history" ? (
          <LedgerVersionHistory
            listVersions={() =>
              modal.row.kind === "primary"
                ? request(BASE_API_URL, `/ledgers/${encodeURIComponent(modal.row.name)}/versions`)
                : listLedgerFileVersions(modal.row.id)
            }
            restoreVersion={async (version) => {
              if (modal.row.kind === "primary") {
                await request(BASE_API_URL, `/ledgers/${encodeURIComponent(modal.row.name)}/versions/${version}/restore`, {
                  method: "POST"
                });
              } else {
                await restoreLedgerFileVersion(modal.row.id, version);
              }
            }}
            onRestored={loadFiles}
          />
        ) : null}
      </Modal>

      <Modal open={modal?.type === "upload"} onClose={() => setModal(null)} title="Upload a .bean file" size="lg">
        <LedgerUploadFileModal
          onCreated={() => {
            setModal(null);
            loadFiles();
          }}
        />
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

      <Modal open={modal?.type === "delete"} onClose={() => setModal(null)} title="Delete file" size="sm">
        {modal?.type === "delete" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[var(--color-text-primary)]">
              Delete <span className="font-medium">{modal.row.label || modal.row.name}</span>? This permanently
              removes it and can&apos;t be undone.
            </p>
            {deleteError ? <p className="text-sm text-red-600">{deleteError}</p> : null}
            <div className="flex items-center gap-2">
              <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
              <Button variant="secondary" onClick={() => setModal(null)} disabled={deleting}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
