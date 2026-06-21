"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input-field";
import {
  PAYEE_MODAL_INITIAL_CUSTOMER_FORM,
  PAYEE_MODAL_INITIAL_EMPLOYEE_FORM,
  PAYEE_MODAL_INITIAL_VENDOR_FORM
} from "@/constants/ui";

export type PayeeKind = "CUSTOMER" | "VENDOR" | "EMPLOYEE";

export type PayeeOption = {
  id: string;
  name: string;
  kind: PayeeKind;
};

type PayeeSideModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (payee: PayeeOption) => void;
};

const PAYEE_MODAL_LABEL_CLASS = "flex flex-col gap-1 text-xs text-[var(--color-text-primary)]";
const PAYEE_MODAL_INPUT_CLASS = "input-field w-full";
const PAYEE_MODAL_SELECT_CLASS = "payee-modal-select w-full";
const PAYEE_MODAL_SECTION_CLASS = "rounded border border-[var(--color-divider-tertiary)] p-3";
const PAYEE_MODAL_SUBHEADING_CLASS = "mb-2 text-xs font-semibold text-[var(--color-text-primary)]";
const PAYEE_MODAL_GROUP_HEADING_CLASS = "mb-1 text-xs font-medium text-[var(--color-text-primary)]";
const PAYEE_MODAL_HELPER_TEXT_CLASS = "mt-1 text-[11px] text-[var(--color-icon-secondary)]";
const PAYEE_MODAL_CHECKBOX_LABEL_CLASS =
  "mt-2 flex items-center gap-2 text-xs text-[var(--color-text-primary)]";
const PAYEE_MODAL_INFO_BOX_CLASS =
  "rounded border border-dashed border-[var(--color-container-border-secondary)] bg-[var(--color-container-background-accent)] p-4 text-center text-xs text-[var(--color-icon-secondary)]";

type CollapsibleCardProps = {
  title: string;
  icon: string;
  children: ReactNode;
  initiallyOpen?: boolean;
};

function CollapsibleCard({ title, icon, children, initiallyOpen = true }: CollapsibleCardProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  return (
    <section className="rounded-lg border border-[var(--color-divider-tertiary)] bg-[var(--color-container-background-primary)] shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-[var(--color-icon-secondary)]">{icon}</span>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
        </div>
        <span className="text-[var(--color-icon-secondary)]">{isOpen ? "▾" : "▸"}</span>
      </button>
      {isOpen ? (
        <div className="space-y-3 border-t border-[var(--color-divider-tertiary)] px-4 py-4">{children}</div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className={PAYEE_MODAL_LABEL_CLASS}>
      <span>{label}</span>
      <InputField
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={PAYEE_MODAL_INPUT_CLASS}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className={PAYEE_MODAL_LABEL_CLASS}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={PAYEE_MODAL_SELECT_CLASS}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export function PayeeSideModal({ open, onClose, onSave }: PayeeSideModalProps) {
  const [kind, setKind] = useState<PayeeKind>("VENDOR");
  const [vendor, setVendor] = useState({ ...PAYEE_MODAL_INITIAL_VENDOR_FORM });
  const [customer, setCustomer] = useState({ ...PAYEE_MODAL_INITIAL_CUSTOMER_FORM });
  const [employeeName, setEmployeeName] = useState("");
  const [employee, setEmployee] = useState({ ...PAYEE_MODAL_INITIAL_EMPLOYEE_FORM });
  const [error, setError] = useState<string | null>(null);

  const resolvedName = useMemo(() => {
    if (kind === "VENDOR") {
      return vendor.vendorDisplayName.trim() || vendor.companyName.trim();
    }
    if (kind === "CUSTOMER") {
      return customer.displayName.trim() || customer.companyName.trim();
    }
    const displayName = `${employee.firstName} ${employee.lastName}`.trim();
    return displayName || employeeName.trim();
  }, [
    customer.companyName,
    customer.displayName,
    employee.firstName,
    employee.lastName,
    employeeName,
    kind,
    vendor.companyName,
    vendor.vendorDisplayName
  ]);

  function resetForms() {
    setKind("VENDOR");
    setVendor({ ...PAYEE_MODAL_INITIAL_VENDOR_FORM });
    setCustomer({ ...PAYEE_MODAL_INITIAL_CUSTOMER_FORM });
    setEmployeeName("");
    setEmployee({ ...PAYEE_MODAL_INITIAL_EMPLOYEE_FORM });
    setError(null);
  }

  function handleClose() {
    resetForms();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <button type="button" aria-label="Close payee modal" onClick={handleClose} className="h-full flex-1 bg-black/40" />
      <aside className="tw-override payee-side-modal h-screen w-[752px] overflow-y-auto bg-[var(--color-container-background-accent)] p-5 text-[var(--color-text-primary)] shadow-2xl">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Add new payee</h2>
          <button type="button" onClick={handleClose} className="button secondary !h-auto !min-w-0 px-2 py-1 text-xs">
            Close
          </button>
        </header>

        <div className="mb-4">
          <SelectField
            label="Profile type"
            value={kind}
            onChange={(value) => setKind(value as PayeeKind)}
            options={["CUSTOMER", "VENDOR", "EMPLOYEE"]}
          />
        </div>

        {kind === "VENDOR" ? (
          <div className="space-y-4">
            <CollapsibleCard title="Name and contact" icon="👤">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company name" value={vendor.companyName} onChange={(value) => setVendor((prev) => ({ ...prev, companyName: value }))} />
                <Field label="Vendor display name*" value={vendor.vendorDisplayName} onChange={(value) => setVendor((prev) => ({ ...prev, vendorDisplayName: value }))} />
                <Field label="Title" value={vendor.title} onChange={(value) => setVendor((prev) => ({ ...prev, title: value }))} />
                <Field label="First name" value={vendor.firstName} onChange={(value) => setVendor((prev) => ({ ...prev, firstName: value }))} />
                <Field label="Middle name" value={vendor.middleName} onChange={(value) => setVendor((prev) => ({ ...prev, middleName: value }))} />
                <Field label="Last name" value={vendor.lastName} onChange={(value) => setVendor((prev) => ({ ...prev, lastName: value }))} />
                <Field label="Suffix" value={vendor.suffix} onChange={(value) => setVendor((prev) => ({ ...prev, suffix: value }))} />
                <Field label="Email" value={vendor.email} onChange={(value) => setVendor((prev) => ({ ...prev, email: value }))} type="email" />
                <Field label="Phone number" value={vendor.phoneNumber} onChange={(value) => setVendor((prev) => ({ ...prev, phoneNumber: value }))} />
                <Field label="CC" value={vendor.cc} onChange={(value) => setVendor((prev) => ({ ...prev, cc: value }))} />
                <Field label="Bcc" value={vendor.bcc} onChange={(value) => setVendor((prev) => ({ ...prev, bcc: value }))} />
                <Field label="Mobile number" value={vendor.mobileNumber} onChange={(value) => setVendor((prev) => ({ ...prev, mobileNumber: value }))} />
                <Field label="Fax" value={vendor.fax} onChange={(value) => setVendor((prev) => ({ ...prev, fax: value }))} />
                <Field label="Other" value={vendor.other} onChange={(value) => setVendor((prev) => ({ ...prev, other: value }))} />
                <Field label="Website" value={vendor.website} onChange={(value) => setVendor((prev) => ({ ...prev, website: value }))} />
                <Field label="Name to print on checks" value={vendor.nameOnChecks} onChange={(value) => setVendor((prev) => ({ ...prev, nameOnChecks: value }))} />
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Address" icon="📍">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Street address 1" value={vendor.street1} onChange={(value) => setVendor((prev) => ({ ...prev, street1: value }))} />
                <Field label="Street address 2" value={vendor.street2} onChange={(value) => setVendor((prev) => ({ ...prev, street2: value }))} />
                <Field label="City" value={vendor.city} onChange={(value) => setVendor((prev) => ({ ...prev, city: value }))} />
                <Field label="State" value={vendor.state} onChange={(value) => setVendor((prev) => ({ ...prev, state: value }))} />
                <Field label="ZIP code" value={vendor.zip} onChange={(value) => setVendor((prev) => ({ ...prev, zip: value }))} />
                <Field label="Country" value={vendor.country} onChange={(value) => setVendor((prev) => ({ ...prev, country: value }))} />
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Notes and attachments" icon="📝">
              <Field label="Notes" value={vendor.notes} onChange={(value) => setVendor((prev) => ({ ...prev, notes: value }))} />
              <Field label="Attachments (max 20mb)" value={vendor.attachments} onChange={(value) => setVendor((prev) => ({ ...prev, attachments: value }))} />
            </CollapsibleCard>

            <CollapsibleCard title="Bill pay ACH info" icon="🏦">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Bank account number" value={vendor.achBankAccount} onChange={(value) => setVendor((prev) => ({ ...prev, achBankAccount: value }))} />
                <Field label="Routing number" value={vendor.achRouting} onChange={(value) => setVendor((prev) => ({ ...prev, achRouting: value }))} />
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Additional info" icon="⚙️">
              <div className={PAYEE_MODAL_SECTION_CLASS}>
                <h4 className={PAYEE_MODAL_SUBHEADING_CLASS}>Sales tax</h4>
                <Field label="Business ID No / Social Security No." value={vendor.salesTaxId} onChange={(value) => setVendor((prev) => ({ ...prev, salesTaxId: value }))} />
              </div>

              <div className={PAYEE_MODAL_SECTION_CLASS}>
                <h4 className={PAYEE_MODAL_SUBHEADING_CLASS}>Expense rates</h4>
                <div className="space-y-3">
                  <div>
                    <h5 className={PAYEE_MODAL_GROUP_HEADING_CLASS}>Payments</h5>
                    <div className="grid grid-cols-2 gap-3">
                      <SelectField
                        label="Terms"
                        value={vendor.terms}
                        onChange={(value) => setVendor((prev) => ({ ...prev, terms: value }))}
                        options={["Due on receipt", "Net 15", "Net 30", "Net 60"]}
                      />
                      <Field
                        label="Account no"
                        value={vendor.accountNo}
                        onChange={(value) => setVendor((prev) => ({ ...prev, accountNo: value }))}
                      />
                    </div>
                    <p className={PAYEE_MODAL_HELPER_TEXT_CLASS}>
                      Appears in the memo field on this vendor&apos;s bill payments
                    </p>
                  </div>

                  <div>
                    <h5 className={PAYEE_MODAL_GROUP_HEADING_CLASS}>Accounting</h5>
                    <SelectField
                      label="Default expense category"
                      value={vendor.defaultExpenseCategory}
                      onChange={(value) => setVendor((prev) => ({ ...prev, defaultExpenseCategory: value }))}
                      options={["Expense Option 1", "Expense Option 2", "Expense Option 3"]}
                    />
                  </div>

                  <div>
                    <h5 className={PAYEE_MODAL_GROUP_HEADING_CLASS}>Opening balance</h5>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Opening balance"
                        value={vendor.openingBalance}
                        onChange={(value) => setVendor((prev) => ({ ...prev, openingBalance: value }))}
                        type="number"
                      />
                      <Field
                        label="As of"
                        value={vendor.openingBalanceAsOf}
                        onChange={(value) => setVendor((prev) => ({ ...prev, openingBalanceAsOf: value }))}
                        type="date"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CollapsibleCard>
          </div>
        ) : kind === "CUSTOMER" ? (
          <div className="space-y-4">
            <CollapsibleCard title="Name and contact" icon="👤">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Title" value={customer.title} onChange={(value) => setCustomer((prev) => ({ ...prev, title: value }))} />
                <Field label="First name" value={customer.firstName} onChange={(value) => setCustomer((prev) => ({ ...prev, firstName: value }))} />
                <Field label="Middle name" value={customer.middleName} onChange={(value) => setCustomer((prev) => ({ ...prev, middleName: value }))} />
                <Field label="Last name" value={customer.lastName} onChange={(value) => setCustomer((prev) => ({ ...prev, lastName: value }))} />
                <Field label="Suffix" value={customer.suffix} onChange={(value) => setCustomer((prev) => ({ ...prev, suffix: value }))} />
                <Field label="Company name" value={customer.companyName} onChange={(value) => setCustomer((prev) => ({ ...prev, companyName: value }))} />
                <Field label="Customer display name*" value={customer.displayName} onChange={(value) => setCustomer((prev) => ({ ...prev, displayName: value }))} />
                <Field label="Email" value={customer.email} onChange={(value) => setCustomer((prev) => ({ ...prev, email: value }))} type="email" />
                <Field label="Phone number" value={customer.phoneNumber} onChange={(value) => setCustomer((prev) => ({ ...prev, phoneNumber: value }))} />
                <Field label="CC" value={customer.cc} onChange={(value) => setCustomer((prev) => ({ ...prev, cc: value }))} />
                <Field label="Bcc" value={customer.bcc} onChange={(value) => setCustomer((prev) => ({ ...prev, bcc: value }))} />
                <Field label="Mobile number" value={customer.mobileNumber} onChange={(value) => setCustomer((prev) => ({ ...prev, mobileNumber: value }))} />
                <Field label="Fax" value={customer.fax} onChange={(value) => setCustomer((prev) => ({ ...prev, fax: value }))} />
                <Field label="Other" value={customer.other} onChange={(value) => setCustomer((prev) => ({ ...prev, other: value }))} />
                <Field label="Website" value={customer.website} onChange={(value) => setCustomer((prev) => ({ ...prev, website: value }))} />
                <Field label="Name to print on checks" value={customer.nameOnChecks} onChange={(value) => setCustomer((prev) => ({ ...prev, nameOnChecks: value }))} />
              </div>
              <label className={PAYEE_MODAL_CHECKBOX_LABEL_CLASS}>
                <input
                  type="checkbox"
                  checked={customer.isSubCustomer}
                  onChange={(event) => setCustomer((prev) => ({ ...prev, isSubCustomer: event.target.checked }))}
                />
                Is a sub-customer
              </label>
            </CollapsibleCard>

            <CollapsibleCard title="Communication permissions" icon="✉️">
              <div className={PAYEE_MODAL_INFO_BOX_CLASS}>
                Enter an email to record customer consent - If the customer has opted in to receive
                email marketing communications, acknowledge it here once you&apos;ve added an email.
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Address" icon="📍">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Street address 1" value={customer.street1} onChange={(value) => setCustomer((prev) => ({ ...prev, street1: value }))} />
                <Field label="Street address 2" value={customer.street2} onChange={(value) => setCustomer((prev) => ({ ...prev, street2: value }))} />
                <Field label="City" value={customer.city} onChange={(value) => setCustomer((prev) => ({ ...prev, city: value }))} />
                <Field label="State" value={customer.state} onChange={(value) => setCustomer((prev) => ({ ...prev, state: value }))} />
                <Field label="ZIP code" value={customer.zip} onChange={(value) => setCustomer((prev) => ({ ...prev, zip: value }))} />
                <Field label="Country" value={customer.country} onChange={(value) => setCustomer((prev) => ({ ...prev, country: value }))} />
              </div>
              <label className={PAYEE_MODAL_CHECKBOX_LABEL_CLASS}>
                <input
                  type="checkbox"
                  checked={customer.shippingSameAsBilling}
                  onChange={(event) =>
                    setCustomer((prev) => ({ ...prev, shippingSameAsBilling: event.target.checked }))
                  }
                />
                Same as billing address
              </label>
            </CollapsibleCard>

            <CollapsibleCard title="Notes and attachments" icon="📝">
              <Field label="Notes" value={customer.notes} onChange={(value) => setCustomer((prev) => ({ ...prev, notes: value }))} />
              <Field label="Attachments (max 20mb)" value={customer.attachments} onChange={(value) => setCustomer((prev) => ({ ...prev, attachments: value }))} />
            </CollapsibleCard>

            <CollapsibleCard title="Payments" icon="💳">
              <div className="grid grid-cols-2 gap-3">
                <SelectField
                  label="Primary payment method"
                  value={customer.primaryPaymentMethod}
                  onChange={(value) => setCustomer((prev) => ({ ...prev, primaryPaymentMethod: value }))}
                  options={["ACH", "Cash", "Check", "Credit Card"]}
                />
                <SelectField
                  label="Terms"
                  value={customer.terms}
                  onChange={(value) => setCustomer((prev) => ({ ...prev, terms: value }))}
                  options={["Due on receipt", "Net 15", "Net 30", "Net 60"]}
                />
                <Field
                  label="Sales form delivery options"
                  value={customer.salesFormDeliveryOptions}
                  onChange={(value) =>
                    setCustomer((prev) => ({ ...prev, salesFormDeliveryOptions: value }))
                  }
                />
                <SelectField
                  label="Language to use when you send invoices"
                  value={customer.invoiceLanguage}
                  onChange={(value) => setCustomer((prev) => ({ ...prev, invoiceLanguage: value }))}
                  options={[
                    "English",
                    "French",
                    "Spanish",
                    "Italian",
                    "Chinese (traditional)",
                    "Portuguese (Brazil)"
                  ]}
                />
              </div>
            </CollapsibleCard>

            <CollapsibleCard title="Additional info" icon="⚙️">
              <div className={PAYEE_MODAL_SECTION_CLASS}>
                <h4 className={PAYEE_MODAL_SUBHEADING_CLASS}>Sales tax</h4>
                <Field
                  label="Exemption details"
                  value={customer.exemptionDetails}
                  onChange={(value) => setCustomer((prev) => ({ ...prev, exemptionDetails: value }))}
                />
              </div>
              <div className={PAYEE_MODAL_SECTION_CLASS}>
                <h4 className={PAYEE_MODAL_SUBHEADING_CLASS}>Opening balance</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Field
                    label="Opening balance"
                    value={customer.openingBalance}
                    onChange={(value) => setCustomer((prev) => ({ ...prev, openingBalance: value }))}
                    type="number"
                  />
                  <Field
                    label="As of"
                    value={customer.openingBalanceAsOf}
                    onChange={(value) =>
                      setCustomer((prev) => ({ ...prev, openingBalanceAsOf: value }))
                    }
                    type="date"
                  />
                </div>
              </div>
            </CollapsibleCard>
          </div>
        ) : (
          <div className="space-y-4">
            <CollapsibleCard title="Employee details" icon="👤">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="First name *"
                  value={employee.firstName}
                  onChange={(value) => {
                    setEmployee((prev) => ({ ...prev, firstName: value }));
                    setEmployeeName(`${value} ${employee.lastName}`.trim());
                  }}
                />
                <Field
                  label="M.I."
                  value={employee.middleInitial}
                  onChange={(value) => setEmployee((prev) => ({ ...prev, middleInitial: value }))}
                />
                <Field
                  label="Last name *"
                  value={employee.lastName}
                  onChange={(value) => {
                    setEmployee((prev) => ({ ...prev, lastName: value }));
                    setEmployeeName(`${employee.firstName} ${value}`.trim());
                  }}
                />
                <Field
                  label="Email"
                  value={employee.email}
                  onChange={(value) => setEmployee((prev) => ({ ...prev, email: value }))}
                  type="email"
                />
                <Field
                  label="Hire date"
                  value={employee.hireDate}
                  onChange={(value) => setEmployee((prev) => ({ ...prev, hireDate: value }))}
                  type="date"
                />
              </div>
            </CollapsibleCard>
          </div>
        )}

        {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

        <footer className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!resolvedName) {
                setError("Display name is required.");
                return;
              }
              onSave({
                id: crypto.randomUUID(),
                name: resolvedName,
                kind
              });
              resetForms();
              onClose();
            }}
          >
            Save payee
          </Button>
        </footer>
      </aside>
    </div>
  );
}
