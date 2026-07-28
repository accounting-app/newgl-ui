"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";

type CsvDropZoneProps = {
  onFileSelected: (file: File) => void;
  error: string | null;
};

export function CsvDropZone({ onFileSelected, error }: CsvDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4">
      <h2 className="text-xl font-medium text-[var(--color-text-primary)]">Upload your file</h2>

      <div
        className={`rounded border-2 border-dashed p-4 transition-colors ${
          isDragOver ? "border-[var(--color-ui-primary)]" : "border-[var(--color-container-border-secondary)]"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-3 rounded border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-6 py-10 text-center hover:bg-[var(--color-container-background-accent)]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-action-standard-subtle-hover)]">
            <Upload className="h-5 w-5 text-[var(--color-ui-primary)]" aria-hidden="true" />
          </span>
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Upload from this device</span>
          <span className="text-xs text-[var(--color-icon-secondary)]">Browse and select a document to upload</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(event) => handleFiles(event.target.files)}
        />
      </div>

      <p className="text-center text-xs text-[var(--color-icon-secondary)]">Supported formats: CSV</p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
