"use client";

import { useEffect, useState } from "react";
import { Box, Brush, Shirt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import { INPUT_BASE_CLASSES } from "@/components/ui/input-field";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import type { CreateProductInput, ProductServiceType } from "@/lib/services/products-services-service";

type ProductServicePanelProps = {
  open: boolean;
  incomeAccountOptions: SelectOption[];
  onClose: () => void;
  /** Creates the item; the panel closes once it resolves. */
  onSave: (input: CreateProductInput) => Promise<void>;
};

type Kind = "NON_INVENTORY" | "SERVICE";

const KINDS: { id: Kind; label: string; description: string; icon: typeof Box; type: ProductServiceType }[] = [
  { id: "NON_INVENTORY", label: "Non-inventory", description: "Products you buy and/or sell but don't need to (or can't) track quantities of, for example, nuts and bolts used in an installation.", icon: Box, type: "PRODUCT" },
  { id: "SERVICE", label: "Service", description: "Services that you provide to customers, for example, landscaping or tax preparation services.", icon: Brush, type: "SERVICE" }
];

const LABEL = "mb-1 block text-sm font-semibold text-[var(--color-text-global)]";

// QBO's "Product/Service information" side panel: pick a type first, then
// fill the form. Only the fields the catalog actually stores are offered
// (name, description, sales price, income account); Inventory needs a plan
// upgrade in QBO and isn't supported here, so it's listed but disabled.
export function ProductServicePanel({ open, incomeAccountOptions, onClose, onSave }: ProductServicePanelProps) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [incomeAccountId, setIncomeAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(null);
    setName("");
    setDescription("");
    setPrice("");
    setIncomeAccountId("");
    setError(null);
  }, [open]);

  if (!open) return null;
  const chosen = KINDS.find((k) => k.id === kind) ?? null;

  async function save() {
    if (!chosen) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const parsedPrice = price.trim() === "" ? undefined : Number(price);
    if (parsedPrice !== undefined && (!Number.isFinite(parsedPrice) || parsedPrice < 0)) {
      setError("Enter a valid sales price.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        type: chosen.type,
        description: description.trim() || undefined,
        salesPrice: parsedPrice,
        incomeAccountId: incomeAccountId || undefined
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" aria-label="Close product/service panel" onClick={onClose} className="h-full flex-1 bg-black/40" />
      <aside className="flex h-screen w-[640px] max-w-full flex-col bg-[var(--color-container-background-primary)] text-[var(--color-text-primary)] shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--color-divider-tertiary)] px-6 py-4">
          <h2 className="text-lg text-[var(--color-text-global)]">Product/Service information</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-[var(--color-icon-secondary)] hover:text-[var(--color-text-global)]">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {!chosen ? (
          <div className="flex-1 overflow-y-auto">
            {KINDS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setKind(option.id)}
                className="flex w-full items-start gap-5 border-b border-[var(--color-divider-tertiary)] px-6 py-5 text-left hover:bg-[var(--color-action-passive-subtle-hover)]"
              >
                <span className="flex h-20 w-20 shrink-0 items-center justify-center bg-[var(--color-link-action)] text-white">
                  <option.icon className="h-9 w-9" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-lg font-semibold text-[var(--color-text-global)]">{option.label}</span>
                  <span className="mt-1 block text-base">{option.description}</span>
                </span>
              </button>
            ))}
            <div className="flex w-full cursor-not-allowed items-start gap-5 px-6 py-5 opacity-60" aria-disabled="true">
              <span className="flex h-20 w-20 shrink-0 items-center justify-center bg-[var(--color-link-action)] text-white">
                <Shirt className="h-9 w-9" aria-hidden="true" />
              </span>
              <span>
                <span className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-global)]">
                  Inventory
                  <span className="rounded bg-[var(--color-icon-secondary)] px-2 py-0.5 text-xs font-medium uppercase text-white">Upgrade</span>
                </span>
                <span className="mt-1 block text-base">Products you buy and/or sell and that you track quantities of.</span>
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 border-b border-[var(--color-divider-tertiary)] px-6 py-4">
              <span className="flex h-12 w-12 items-center justify-center bg-[var(--color-link-action)] text-white">
                <chosen.icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-2xl text-[var(--color-text-global)]">{chosen.label}</span>
              <button type="button" onClick={() => setKind(null)} className="text-sm text-[var(--color-link-action)] hover:underline">
                Change type
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div>
                <label className={LABEL} htmlFor="ps-name">Name*</label>
                <InputField id="ps-name" value={name} onChange={(event) => setName(event.target.value)} className="max-w-[360px]" autoFocus />
              </div>
              <div>
                <label className={LABEL} htmlFor="ps-description">Description</label>
                <textarea
                  id="ps-description"
                  rows={3}
                  value={description}
                  placeholder="Description on sales forms"
                  onChange={(event) => setDescription(event.target.value)}
                  className={`${INPUT_BASE_CLASSES} resize-y rounded px-3 py-2 text-sm`}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL} htmlFor="ps-price">Sales price/rate</label>
                  <InputField id="ps-price" type="number" min="0" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} />
                </div>
                <div>
                  <span className={LABEL}>Income account</span>
                  <Select value={incomeAccountId} onChange={setIncomeAccountId} options={incomeAccountOptions} placeholder="Select income account" allowCustomValue={false} />
                </div>
              </div>
              {error ? <p className="text-sm text-[var(--color-negative)]" role="alert">{error}</p> : null}
            </div>
            <footer className="flex justify-end border-t border-[var(--color-divider-tertiary)] px-6 py-4">
              <Button onClick={() => void save()} disabled={saving} className="!rounded-md">
                {saving ? "Saving..." : "Save and close"}
              </Button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
