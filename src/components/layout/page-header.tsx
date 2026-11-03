"use client";

import { MessageSquarePlus } from "lucide-react";
import type { ReactNode } from "react";

// QBO's list-screen header: a breadcrumb row with Give feedback on the right,
// then the 32px title with the screen's action buttons on the right. Shared by
// Bank transactions and Chart of accounts so the two stay pixel-identical.
export function PageHeader({ section, title, actions }: { section: string; title: string; actions?: ReactNode }) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm leading-[21px] text-[var(--color-text-primary)]">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
          <span>{section}</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{title}</span>
        </nav>
        <button type="button" disabled className="flex cursor-not-allowed items-center gap-1.5 font-medium text-[var(--color-text-disabled)]">
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          Give feedback
        </button>
      </div>
      <div className="mb-[22px] flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[32px] font-normal leading-10 text-[var(--color-text-global)]">{title}</h1>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </>
  );
}
