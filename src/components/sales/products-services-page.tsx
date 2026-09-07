"use client";

import { useState, type FormEvent } from "react";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast/toast-context";
import { useCompany } from "@/lib/company/company-provider";
import type { ProductServiceType } from "@/lib/local-store/sales-types";
import { useSalesData } from "@/components/sales/use-sales-data";

function formatMoney(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Real local Products & Services list. "Import items" matches Vendors'
// import wizard in spirit but isn't built out yet -- honestly disabled.
export function ProductsServicesPage() {
  const { activeCompany } = useCompany();
  const { toast } = useToast();
  const { productsServices, addProductOrService, removeProduct } = useSalesData();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<ProductServiceType>("SERVICE");
  const [salesPrice, setSalesPrice] = useState("");
  const [description, setDescription] = useState("");

  function resetForm() {
    setName("");
    setType("SERVICE");
    setSalesPrice("");
    setDescription("");
    setShowForm(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const parsedPrice = Number(salesPrice);
    addProductOrService({
      name: name.trim(),
      type,
      salesPrice: salesPrice.trim() && Number.isFinite(parsedPrice) ? parsedPrice : undefined,
      description: description.trim() || undefined
    });
    toast({ variant: "success", title: "Item created" });
    resetForm();
  }

  if (!activeCompany) {
    return <p className="text-sm text-[var(--color-text-primary)]">Loading…</p>;
  }

  if (productsServices.length === 0 && !showForm) {
    return (
      <div className="flex flex-col gap-8 rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-accent)] p-10 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-xl">
          <h2 className="text-4xl font-semibold leading-tight text-[var(--color-text-global)]">Get started with products and services</h2>
          <p className="mt-3 text-sm text-[var(--color-text-primary)]">Save time creating your next invoice by adding items.</p>
          <ul className="mt-5 flex flex-col gap-2 text-sm text-[var(--color-text-primary)]">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
              Categorize products and services to manage items efficiently
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-positive)]" />
              Reuse saved item details on your next invoice
            </li>
          </ul>
          <div className="mt-6 flex gap-3">
            <Button onClick={() => setShowForm(true)}>Create items</Button>
            <button type="button" disabled title="Not available yet" className="cursor-not-allowed rounded-full border border-[var(--color-button-border)] px-5 py-2 text-sm font-medium text-[var(--color-text-disabled)]">
              Import items
            </button>
          </div>
        </div>
        <Package className="hidden h-28 w-28 shrink-0 text-[var(--color-positive)] lg:block" aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--color-text-global)]">Products &amp; Services</h1>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "Create items"}</Button>
          <button type="button" disabled title="Not available yet" className="cursor-not-allowed rounded-full border border-[var(--color-button-border)] px-4 py-1.5 text-sm font-medium text-[var(--color-text-disabled)]">
            Import items
          </button>
        </div>
      </div>

      {showForm ? (
        <Card title="Add a product or service" description="Not backed by a server yet -- saved to this browser only." className="mb-4">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <InputField label="Name" placeholder="e.g. Consulting hour" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="w-40">
              <Select
                label="Type"
                value={type}
                onChange={(v) => setType(v as ProductServiceType)}
                options={[
                  { value: "SERVICE", label: "Service" },
                  { value: "PRODUCT", label: "Product" }
                ]}
                placeholder="Type"
                allowCustomValue={false}
              />
            </div>
            <div className="w-36">
              <NumberField label="Sales price (optional)" currency placeholder="0.00" value={salesPrice} onChange={(e) => setSalesPrice(e.target.value)} />
            </div>
            <div className="min-w-[160px] flex-1">
              <InputField label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <Button type="submit" disabled={name.trim() === ""}>
              Add item
            </Button>
          </form>
        </Card>
      ) : null}

      <div className="tw-override overflow-auto rounded-lg border border-[var(--color-divider-tertiary)]">
        <table className="w-full min-w-[700px] border-collapse text-sm">
          <thead className="header-table text-left uppercase tracking-wide">
            <tr>
              <th className="px-2 pb-[5px] pt-2 text-left align-middle">Name</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Type</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">Description</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Sales price</th>
              <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">Action</th>
            </tr>
          </thead>
          <tbody className="content-table">
            {productsServices.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-sm text-[var(--color-text-disabled)]">
                  No items yet.
                </td>
              </tr>
            ) : (
              productsServices.map((item) => (
                <tr key={item.id} className="border-t border-[var(--color-divider-tertiary)] hover:bg-[var(--color-table-row-hover)]">
                  <td className="p-2 align-top text-[13px] font-medium text-[var(--color-text-global)]">{item.name}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{item.type === "SERVICE" ? "Service" : "Product"}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-[13px] text-[var(--color-text-primary)]">{item.description || "--"}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right text-[13px] text-[var(--color-text-global)]">{item.salesPrice != null ? formatMoney(item.salesPrice) : "--"}</td>
                  <td className="border-l border-l-dotted border-l-[var(--color-divider-tertiary)] p-2 align-top text-right">
                    <button type="button" onClick={() => removeProduct(item.id)} className="text-sm font-medium text-[var(--color-negative)] hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
