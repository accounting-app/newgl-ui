"use client";

import { useEffect, useRef, useState } from "react";
import { requestConfirmation } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import { printHtml, transactionPrintHtml } from "@/lib/print/transaction-print";
import { getServiceContainer } from "@/lib/services/service-container-v2";
import type { Transaction } from "@/modules/accounting/domain/models";

/** Print for the full-screen forms: prints the transaction as it was last saved. */
export function useTransactionPrint() {
  const { toast } = useToast();
  const { activeCompany } = useCompany();
  return async (txn: Transaction | null, layout: "document" | "check" = "document") => {
    if (!txn) return toast({ variant: "info", title: "Save the transaction first, then print it" });
    try {
      const services = getServiceContainer();
      const [saved, accounts] = await Promise.all([services.transactionService.getTransactionById(txn.id), services.accountService.listAccounts()]);
      printHtml(transactionPrintHtml(saved, accounts, activeCompany?.label || activeCompany?.name || "", layout));
    } catch (err) {
      toast({ variant: "error", title: "Could not print", description: err instanceof Error ? err.message : undefined });
    }
  };
}

const ITEM = "block w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-global)] hover:bg-[var(--color-action-passive-subtle-hover)]";

/**
 * The footer's "More" on a saved transaction: Void and Delete. Reconciled entries still get the API's confirmation, and removing a
 * payment reopens its invoice or bill.
 */
export function MoreMenu({ transaction, onRemoved, className }: { transaction: Transaction | null; onRemoved: () => void; className: string }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function remove(kind: "delete" | "void") {
    setOpen(false);
    if (!transaction) return;
    const yes = await requestConfirmation({ warning: true, title: kind === "void" ? "Void transaction" : "Delete transaction", message: `Are you sure you want to ${kind} this transaction?`, confirmLabel: "Yes", cancelLabel: "No" });
    if (!yes) return;
    setBusy(true);
    try {
      const services = getServiceContainer();
      if (kind === "void") await services.transactionService.voidTransaction(transaction.id);
      else {
        const { registerEntries } = await services.registerService.getTransactionDetail(transaction.id);
        const entry = registerEntries.find((item) => item.accountId === transaction.sourceAccountId) ?? registerEntries[0];
        if (!entry) throw new Error("This transaction has no register entry to delete.");
        await services.registerService.deleteRegisterEntry(entry.id);
      }
      toast({ variant: "success", title: kind === "void" ? "Transaction voided" : "Transaction deleted" });
      onRemoved();
    } catch (err) {
      toast({ variant: "error", title: `Could not ${kind} this transaction`, description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-flex">
      <button type="button" disabled={!transaction || busy} title={transaction ? undefined : "Available once the transaction is saved"} aria-expanded={open} onClick={() => setOpen((v) => !v)} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
        More
      </button>
      {open ? (
        <div className="absolute bottom-full right-0 z-10 mb-2 w-48 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1 shadow-lg">
          <button type="button" className={ITEM} disabled={transaction?.status === "VOIDED"} onClick={() => void remove("void")}>Void</button>
          <button type="button" className={ITEM} onClick={() => void remove("delete")}>Delete</button>
        </div>
      ) : null}
    </div>
  );
}
