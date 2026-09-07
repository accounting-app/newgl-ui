"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Customer, Invoice, ProductOrService } from "@/lib/local-store/sales-types";

const today = () => new Date().toISOString().slice(0, 10);

// Real, local-only invoice creation -- the AR mirror of Bills' add form.
// Collecting a real payment against it (QBO's own "QuickBooks Payments")
// needs a payments processor integration this app doesn't have, so an
// invoice here only ever reaches OPEN/PAID as a status label, same as a
// Bill -- no money actually moves.
export function InvoiceFormDrawer({
  customers,
  productsServices,
  initialCustomerId,
  onAddCustomer,
  onSave,
  onClose
}: {
  customers: Customer[];
  productsServices: ProductOrService[];
  /** Pre-selects a customer -- e.g. opening this from that customer's own "Create invoice" row action. */
  initialCustomerId?: string;
  onAddCustomer: (name: string) => string;
  onSave: (input: Omit<Invoice, "id" | "createdAt" | "status">) => void;
  onClose: () => void;
}) {
  // Doubles as both a selected customer id and (while allowCustomValue is
  // typing a name that doesn't match any option) the raw typed text --
  // same pattern as the Vendor "From/To" field on Bank Transactions.
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [productServiceId, setProductServiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const customerOptions = customers.map((c) => ({ value: c.id, label: c.name }));
  const productOptions = productsServices.map((p) => ({ value: p.id, label: p.name, rightLabel: p.type === "SERVICE" ? "Service" : "Product" }));

  function resolveCustomerId(): string | null {
    if (customers.some((c) => c.id === customerId)) return customerId;
    const name = customerId.trim();
    if (!name) return null;
    const existing = customers.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return existing ? existing.id : onAddCustomer(name);
  }

  function handleSubmit() {
    const parsedAmount = Number(amount);
    const resolvedCustomerId = resolveCustomerId();
    if (!resolvedCustomerId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    onSave({
      customerId: resolvedCustomerId,
      invoiceNumber: invoiceNumber.trim() || undefined,
      invoiceDate,
      dueDate,
      amount: parsedAmount,
      productServiceId: productServiceId || undefined,
      memo: memo.trim() || undefined
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative flex h-full w-[420px] max-w-full flex-col bg-[var(--color-container-background-primary)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-global)]">Create invoice</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <Select
            label="Customer"
            value={customerId}
            onChange={setCustomerId}
            options={customerOptions}
            placeholder="Choose a customer"
            allowCustomValue
            onAddNew={() => {
              const resolved = resolveCustomerId();
              if (resolved) setCustomerId(resolved);
            }}
            addNewLabel="+ Add new customer"
          />

          <div className="flex gap-3">
            <div className="flex-1">
              <InputField label="Invoice date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <InputField label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <InputField label="Invoice # (optional)" placeholder="INV-1001" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          <Select label="Product/Service (optional)" value={productServiceId} onChange={setProductServiceId} options={productOptions} placeholder="None" allowCustomValue={false} />
          <NumberField label="Amount" currency placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Textarea label="Memo (optional)" value={memo} onChange={(e) => setMemo(e.target.value)} rows={3} />
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-divider-tertiary)] px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={customerId.trim() === "" || amount.trim() === ""}>
            Save invoice
          </Button>
        </div>
      </div>
    </div>
  );
}
