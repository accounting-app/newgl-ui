"use client";

import { useState } from "react";
import { ChevronDown, GripVertical, History, Plus, Settings, Sparkles, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast/toast-context";
import { localId } from "@/lib/local-store/use-local-collection";
import type { Vendor } from "@/lib/services/vendors-service";
import type { Account } from "@/modules/accounting/domain/models";

export type TxnFormType = "BILL" | "EXPENSE" | "CHECK" | "VENDOR_CREDIT" | "CREDIT_CARD_CREDIT";

const TITLES: Record<TxnFormType, string> = {
  BILL: "Bill",
  EXPENSE: "Expense",
  CHECK: "Check",
  VENDOR_CREDIT: "Vendor Credit",
  CREDIT_CARD_CREDIT: "Credit Card Credit"
};

const AMOUNT_LABELS: Record<TxnFormType, string> = {
  BILL: "Balance due",
  EXPENSE: "Amount",
  CHECK: "Amount",
  VENDOR_CREDIT: "Credit amount",
  CREDIT_CARD_CREDIT: "Amount"
};

type LineItem = { id: string; categoryAccountId: string; description: string; amount: string };

function newLineItem(): LineItem {
  return { id: localId(), categoryAccountId: "", description: "", amount: "" };
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const today = () => new Date().toISOString().slice(0, 10);

// One shared shell for QBO's five "expense-side" transaction forms (Bill,
// Expense, Check, Vendor Credit, Credit Card Credit) -- their header
// fields differ (handled in the switch below) but the line-items table,
// memo/attachments, and footer are the same shape every time.
//
// Phase 1, UI only per the user's direction ("focus mainly on the UI for
// now; later we'll look at the features of each option little by
// little") -- line items are real local component state (add/remove
// rows, category/description/amount all editable, total computed live),
// but Save/Save and close don't post a real transaction yet. Making that
// real means deciding how a Bill's "for review/unpaid/paid" lifecycle,
// a Check's check-number sequence, and a Credit's negative-postings
// convention each map onto the real ledger -- exactly the "features"
// the user asked to defer, not something to guess at here.
export type BillSaveInput = {
  vendorId: string;
  billNumber: string;
  billDate: string;
  dueDate: string;
  amount: number;
  categoryAccountId: string;
  memo: string;
};

export function TransactionFormModal({
  type,
  accounts,
  vendors,
  nextCheckNumber,
  onSaveBill,
  onClose
}: {
  type: TxnFormType;
  accounts: Account[];
  vendors: Vendor[];
  nextCheckNumber: number;
  /** Only meaningful for type "BILL" -- Bills already has real local
   * persistence (unlike Expense/Check/Vendor Credit/Credit Card Credit,
   * which need a real ledger transaction posted, deferred for now), so
   * when the caller passes this, Save actually creates a Bill instead
   * of just showing the "UI preview only" toast. */
  onSaveBill?: (input: BillSaveInput) => Promise<void>;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [payeeId, setPayeeId] = useState("");
  const [paymentAccountId, setPaymentAccountId] = useState("");
  const [mailingAddress, setMailingAddress] = useState("");
  const [billDate, setBillDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [billNo, setBillNo] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [refNo, setRefNo] = useState("");
  const [checkNo, setCheckNo] = useState(String(nextCheckNumber));
  const [printLater, setPrintLater] = useState(false);
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<LineItem[]>([newLineItem(), newLineItem()]);
  const [showLinesTable, setShowLinesTable] = useState(true);

  const vendorOptions = vendors.map((v) => ({ value: v.id, label: v.name }));
  const categoryOptions = accounts
    .filter((a) => a.category === "EXPENSE" || a.category === "OTHER_EXPENSE")
    .map((a) => ({ value: a.id, label: a.name }));
  const bankAccountOptions = accounts
    .filter((a) => a.category === "BANK" || a.category === "CREDIT_CARD")
    .map((a) => ({ value: a.id, label: a.name }));
  const selectedPaymentAccount = accounts.find((a) => a.id === paymentAccountId);

  const total = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);

  function updateLine(id: string, patch: Partial<LineItem>) {
    setLines((current) => current.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((current) => [...current, newLineItem()]);
  }
  function removeLine(id: string) {
    setLines((current) => current.filter((l) => l.id !== id));
  }
  function clearLines() {
    setLines([newLineItem(), newLineItem()]);
  }

  async function handleSave(andClose: boolean) {
    if (type === "BILL" && onSaveBill) {
      const categoryAccountId = lines.find((l) => l.categoryAccountId)?.categoryAccountId ?? "";
      if (!payeeId || total <= 0 || !categoryAccountId) {
        toast({ variant: "error", title: "Choose a vendor, a category, and at least one line amount first" });
        return;
      }
      try {
        await onSaveBill({
          vendorId: payeeId,
          billNumber: billNo.trim(),
          billDate,
          dueDate,
          amount: total,
          categoryAccountId,
          memo: memo.trim()
        });
        toast({ variant: "success", title: "Bill added" });
        if (andClose) onClose();
      } catch (err) {
        toast({ variant: "error", title: "Could not save this bill", description: err instanceof Error ? err.message : undefined });
      }
      return;
    }
    toast({
      variant: "info",
      title: "UI preview only",
      description: `Saving a real ${TITLES[type].toLowerCase()} isn't wired up yet -- that's next, once the screens are all in place.`
    });
    if (andClose) onClose();
  }

  const showAutofillPanel = type === "BILL" || type === "EXPENSE";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-container-background-accent)]">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-6 py-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-[var(--color-text-global)]">
          <History className="h-5 w-5 text-[var(--color-icon-secondary)]" aria-hidden="true" />
          {type === "CHECK" ? `Check #${checkNo || nextCheckNumber}` : TITLES[type]}
        </h2>
        <div className="flex items-center gap-4">
          <button type="button" disabled title="Not available yet" className="flex cursor-not-allowed items-center gap-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            Give feedback
          </button>
          <IconButton icon={Settings} label="Settings" size="sm" />
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showAutofillPanel ? (
          <div className="w-[280px] shrink-0 overflow-y-auto border-r border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-[var(--color-text-global)]">
              <Sparkles className="h-4 w-4 text-[var(--color-ui-primary)]" aria-hidden="true" />
              Autofill this {type === "BILL" ? "bill" : "expense"}
            </div>
            <p className="mb-4 text-sm text-[var(--color-text-primary)]">
              Drag and drop documents anywhere in the dotted lines, or select one of the options to autofill from file
            </p>
            <p className="mb-4 text-xs text-[var(--color-icon-secondary)]">Supported formats: PDF, PNG, JPEG, HEIC.</p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled
                title="Autofill from file isn't available yet"
                className="flex flex-1 cursor-not-allowed flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--color-divider-tertiary)] py-4 text-xs font-medium text-[var(--color-text-disabled)]"
              >
                <Upload className="h-5 w-5" aria-hidden="true" />
                Select files
              </button>
            </div>
            <p className="mt-6 text-xs text-[var(--color-icon-secondary)]">
              Review before you save. Autofill isn't available yet -- this panel is a placeholder for now.
            </p>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto">
          {/* Header fields */}
          <div className="flex items-start justify-between gap-8 bg-[var(--color-container-background-accent)] px-6 py-6">
            <div className="flex-1">
              {type === "BILL" ? (
                <>
                  <div className="mb-4 w-72">
                    <Select label="Vendor" value={payeeId} onChange={setPayeeId} options={vendorOptions} placeholder="Choose a vendor" allowCustomValue={false} />
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="w-64">
                      <Textarea label="Mailing address" value={mailingAddress} onChange={(e) => setMailingAddress(e.target.value)} rows={3} />
                    </div>
                    <div className="w-40">
                      <Select label="Terms" value="" onChange={() => {}} options={[]} placeholder="" allowCustomValue={false} />
                    </div>
                    <div className="w-40">
                      <InputField label="Bill date" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
                    </div>
                    <div className="w-40">
                      <InputField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <div className="w-36">
                      <InputField label="Bill no." value={billNo} onChange={(e) => setBillNo(e.target.value)} />
                    </div>
                  </div>
                </>
              ) : null}

              {type === "EXPENSE" ? (
                <div className="flex flex-wrap gap-6">
                  <div className="w-64">
                    <Select label="Payee" value={payeeId} onChange={setPayeeId} options={vendorOptions} placeholder="Who did you pay?" allowCustomValue />
                  </div>
                  <div className="w-64">
                    <Select label="Payment account" value={paymentAccountId} onChange={setPaymentAccountId} options={bankAccountOptions} placeholder="Select account" allowCustomValue={false} />
                    {selectedPaymentAccount ? <p className="mt-1 text-xs text-[var(--color-icon-secondary)]">Balance {formatMoney(selectedPaymentAccount.currentBalance)}</p> : null}
                  </div>
                  <div className="w-40">
                    <InputField label="Payment Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </div>
                  <div className="w-44">
                    <Select label="Payment Method" value="" onChange={() => {}} options={[]} placeholder="" allowCustomValue={false} />
                  </div>
                  <div className="w-36">
                    <InputField label="Ref no." value={refNo} onChange={(e) => setRefNo(e.target.value)} />
                  </div>
                </div>
              ) : null}

              {type === "CHECK" ? (
                <>
                  <div className="mb-4 flex flex-wrap gap-6">
                    <div className="w-64">
                      <Select label="Payee" value={payeeId} onChange={setPayeeId} options={vendorOptions} placeholder="Who did you pay?" allowCustomValue />
                    </div>
                    <div className="w-64">
                      <Select label="Bank Account" value={paymentAccountId} onChange={setPaymentAccountId} options={bankAccountOptions} placeholder="Select account" allowCustomValue={false} />
                      {selectedPaymentAccount ? <p className="mt-1 text-xs text-[var(--color-icon-secondary)]">Balance {formatMoney(selectedPaymentAccount.currentBalance)}</p> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-6">
                    <div className="w-64">
                      <Textarea label="Mailing address" value={mailingAddress} onChange={(e) => setMailingAddress(e.target.value)} rows={3} />
                    </div>
                    <div className="w-40">
                      <InputField label="Payment date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                    </div>
                    <div className="w-32">
                      <InputField label="Check no." value={checkNo} onChange={(e) => setCheckNo(e.target.value)} />
                    </div>
                    <Checkbox label="Print later" checked={printLater} onChange={(e) => setPrintLater(e.target.checked)} />
                  </div>
                </>
              ) : null}

              {type === "VENDOR_CREDIT" ? (
                <>
                  <div className="mb-4 w-72">
                    <Select label="Vendor" value={payeeId} onChange={setPayeeId} options={vendorOptions} placeholder="Choose a vendor" allowCustomValue={false} />
                  </div>
                  <div className="flex flex-wrap gap-6">
                    <div className="w-64">
                      <Textarea label="Mailing address" value={mailingAddress} onChange={(e) => setMailingAddress(e.target.value)} rows={3} />
                    </div>
                    <div className="w-40">
                      <InputField label="Payment date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                    </div>
                    <div className="w-36">
                      <InputField label="Ref no." value={refNo} onChange={(e) => setRefNo(e.target.value)} />
                    </div>
                  </div>
                </>
              ) : null}

              {type === "CREDIT_CARD_CREDIT" ? (
                <div className="flex flex-wrap gap-6">
                  <div className="w-64">
                    <Select label="Payee" value={payeeId} onChange={setPayeeId} options={vendorOptions} placeholder="Who did you pay?" allowCustomValue />
                  </div>
                  <div className="w-64">
                    <Select label="Bank/Credit account" value={paymentAccountId} onChange={setPaymentAccountId} options={bankAccountOptions} placeholder="Select account" allowCustomValue={false} />
                    {selectedPaymentAccount ? <p className="mt-1 text-xs text-[var(--color-icon-secondary)]">Balance {formatMoney(selectedPaymentAccount.currentBalance)}</p> : null}
                  </div>
                  <div className="w-40">
                    <InputField label="Payment Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </div>
                  <div className="w-36">
                    <InputField label="Ref no." value={refNo} onChange={(e) => setRefNo(e.target.value)} />
                  </div>
                </div>
              ) : null}
            </div>

            <div className="shrink-0 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">{AMOUNT_LABELS[type]}</p>
              <p className="text-3xl font-semibold text-[var(--color-text-global)]">{formatMoney(total)}</p>
            </div>
          </div>

          {/* Line items */}
          <button
            type="button"
            onClick={() => setShowLinesTable((v) => !v)}
            aria-label={showLinesTable ? "Collapse line items" : "Expand line items"}
            className="flex w-full items-center justify-center border-b border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] py-1.5 text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showLinesTable ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>

          {showLinesTable ? (
            <div className="bg-[var(--color-container-background-primary)] px-6 py-4">
              <div className="mb-1 flex justify-end gap-1">
                <IconButton icon={Settings} label="Table settings" size="sm" />
              </div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-divider-tertiary)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-icon-secondary)]">
                    <th className="w-8 py-2"> </th>
                    <th className="w-8 py-2">#</th>
                    <th className="py-2">Category</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Amount</th>
                    <th className="w-16 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.id} className="border-b border-dotted border-[var(--color-divider-tertiary)]">
                      <td className="py-2 text-[var(--color-icon-secondary)]">
                        <GripVertical className="h-4 w-4 cursor-grab" aria-hidden="true" />
                      </td>
                      <td className="py-2 text-[var(--color-text-primary)]">{index + 1}</td>
                      <td className="py-2 pr-2">
                        <Select
                          value={line.categoryAccountId}
                          onChange={(value) => updateLine(line.id, { categoryAccountId: value })}
                          options={categoryOptions}
                          placeholder="Select a category"
                          allowCustomValue={false}
                          optionSize="sm"
                        />
                      </td>
                      <td className="py-2 pr-2">
                        <InputField size="sm" value={line.description} onChange={(e) => updateLine(line.id, { description: e.target.value })} />
                      </td>
                      <td className="py-2 pr-2">
                        <NumberField size="sm" currency placeholder="0.00" value={line.amount} onChange={(e) => updateLine(line.id, { amount: e.target.value })} />
                      </td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => removeLine(line.id)} aria-label="Remove line" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-negative)]">
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={addLine}>
                    <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    Add lines
                  </Button>
                  <Button variant="secondary" size="sm" onClick={clearLines}>
                    Clear all lines
                  </Button>
                </div>
                <p className="text-sm font-semibold text-[var(--color-text-global)]">Total {formatMoney(total)}</p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-6">
                <div>
                  <Textarea label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} rows={4} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-[var(--color-icon-secondary)]">Attachments</p>
                  <div className="rounded-lg border border-dashed border-[var(--color-divider-tertiary)] py-6 text-center">
                    <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-sm font-medium text-[var(--color-text-disabled)]">
                      Add attachment
                    </button>
                    <p className="mt-1 text-xs text-[var(--color-icon-secondary)]">Max file size: 20 MB</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] px-6 py-3">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <div className="flex items-center gap-4 text-sm">
          {type === "CHECK" ? (
            <>
              <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">
                Print check
              </button>
              <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">
                Order checks
              </button>
            </>
          ) : null}
          {type === "BILL" ? (
            <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">
              Print
            </button>
          ) : null}
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed text-[var(--color-text-disabled)]">
            Make recurring
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => handleSave(false)}>
            Save
          </Button>
          <div className="flex overflow-hidden rounded-full">
            <Button className="rounded-r-none" onClick={() => handleSave(true)}>
              {type === "BILL" ? "Save and schedule payment" : "Save and close"}
            </Button>
            <Button className="rounded-l-none border-l border-l-white/20 px-2" aria-label="More save options" disabled title="Not available yet">
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
