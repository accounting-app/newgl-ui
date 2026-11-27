"use client";

import { Calendar } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { INPUT_BASE_CLASSES } from "@/components/ui/input-field";

const toDisplay = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}` : "");

/** "M/D/YYYY" (or M/D, or a two-digit year) to ISO; null when it isn't a real date. */
function toIso(text: string): string | null {
  const match = /^\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2}|\d{4}))?\s*$/.exec(text);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = !match[3] ? new Date().getFullYear() : match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

/** A date typed and shown as MM/DD/YYYY whatever the browser's locale; `value` stays ISO. */
export function DateField({ value, onChange, id, className = "", disabled }: { value: string; onChange: (iso: string) => void; id?: string; className?: string; disabled?: boolean }) {
  const [text, setText] = useState(() => toDisplay(value));
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => setText(toDisplay(value)), [value]);

  function commit() {
    const iso = toIso(text);
    if (iso) {
      setText(toDisplay(iso));
      if (iso !== value) onChange(iso);
    } else {
      setText(toDisplay(value));
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="MM/DD/YYYY"
        value={text}
        disabled={disabled}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setText(event.target.value);
          const iso = /\d{4}\s*$/.test(event.target.value) ? toIso(event.target.value) : null;
          if (iso) onChange(iso);
        }}
        onBlur={commit}
        onKeyDown={(event) => event.key === "Enter" && commit()}
        className={`${INPUT_BASE_CLASSES} h-9 w-full rounded pl-3 pr-9 text-sm`}
      />
      <button
        type="button"
        aria-label="Open calendar"
        disabled={disabled}
        onClick={() => picker.current?.showPicker?.()}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-icon-secondary)]"
      >
        <Calendar className="h-4 w-4" aria-hidden="true" />
      </button>
      <input ref={picker} type="date" tabIndex={-1} aria-hidden="true" value={value} onChange={(event) => event.target.value && onChange(event.target.value)} className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0" />
    </div>
  );
}
