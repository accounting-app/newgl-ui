"use client";

import { useRef } from "react";
import { ArrowDown, CircleHelp, History, MapPin, MessageSquareText, Settings, X } from "lucide-react";
import { useToast } from "@/components/ui/toast/toast-context";

const ICON_BUTTON = "flex h-9 items-center gap-1.5 rounded-md px-2 text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)] disabled:cursor-not-allowed disabled:opacity-60";
export const RT_TOOLBAR_LINK = "px-1 text-sm font-semibold text-[var(--color-negative)] hover:underline";

type Props = {
  title: React.ReactNode;
  onClose: () => void;
  /** RightTool links shown between the red icons and Feedback (Export CSV, Paste Excel, Copy...). */
  toolbar?: React.ReactNode;
  onSettings?: () => void;
  settingsLabel?: string;
  /** QBO's Bank Deposit header has no gear. */
  hideSettings?: boolean;
  /** Bank Deposit lists its toolbar links before the pin and arrow. */
  toolbarFirst?: boolean;
  footer: React.ReactNode;
  /** QBO's Expense and Check headers: the pin and arrow sit in the middle. */
  centerTools?: boolean;
  /** QBO's Receive Payment header has no pin or arrow. */
  hideTools?: boolean;
  children: React.ReactNode;
};

// The one look shared by QBO's full-screen forms opened by URL (/expense,
// /salesreceipt, ...?rtAccountId=...&rt=close): title with the history icon,
// RightTool's toolbar, a scrolling body, and a pinned footer bar.
export function FullScreenFormShell({ title, onClose, toolbar, onSettings, settingsLabel = "Settings", footer, centerTools = false, hideSettings = false, toolbarFirst = false, hideTools = false, children }: Props) {
  const { toast } = useToast();
  const bodyRef = useRef<HTMLDivElement>(null);
  const tools = (
    <>
          <button type="button" disabled aria-label="Pin" title="Pin isn't available yet" className={`${ICON_BUTTON} text-[var(--color-negative)]`}><MapPin className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" aria-label="Scroll to bottom" title="Scroll to bottom" onClick={() => bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" })} className={`${ICON_BUTTON} text-[var(--color-negative)]`}><ArrowDown className="h-5 w-5" aria-hidden="true" /></button>
    </>
  );
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[var(--color-container-background-accent)] text-[var(--color-text-primary)]">
      <header className="relative flex items-center justify-between bg-[var(--color-container-background-primary)] px-6 py-3">
        <h1 className="flex items-center gap-3 text-2xl text-[var(--color-text-global)]">
          <History className="h-6 w-6" aria-hidden="true" />
          {title}
        </h1>
        {centerTools ? <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-4">{tools}</div> : null}
        <div className="flex items-center gap-1">
          {centerTools || toolbarFirst || hideTools ? null : tools}
          {toolbar}
          {toolbarFirst && !centerTools ? tools : null}
          <button type="button" onClick={() => toast({ variant: "info", title: "Feedback isn't available yet" })} className={ICON_BUTTON}>
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            {centerTools ? "Give feedback" : "Feedback"}
          </button>
          {hideSettings ? null : <button type="button" onClick={onSettings} disabled={!onSettings} aria-label={settingsLabel} title={settingsLabel} className={`${ICON_BUTTON} ml-3`}><Settings className="h-5 w-5" aria-hidden="true" /></button>}
          <button type="button" onClick={() => toast({ variant: "info", title: "Help isn't available yet" })} aria-label="Help" className={ICON_BUTTON}><CircleHelp className="h-5 w-5" aria-hidden="true" /></button>
          <button type="button" onClick={onClose} aria-label="Close form" className={`${ICON_BUTTON} ml-2`}><X className="h-6 w-6" aria-hidden="true" /></button>
        </div>
      </header>
      <div ref={bodyRef} className="flex-1 overflow-y-auto">{children}</div>
      <footer className="flex items-center justify-between gap-4 border-t border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-6 py-3">{footer}</footer>
    </div>
  );
}

// Closes a full-screen form: a form opened in its own window/tab (the quick-add
// menu) closes that window; one opened in place returns to the previous page.
export function leaveFormPage(router: { back: () => void; push: (href: string) => void }) {
  if (window.opener) window.close();
  else if (window.history.length > 1) router.back();
  else router.push("/all-apps/bank-transactions");
}
