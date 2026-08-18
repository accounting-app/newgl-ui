"use client";

import { useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { InputField } from "@/components/ui/input-field";
import { NumberField } from "@/components/ui/number-field";
import { Select } from "@/components/ui/select";
import type { SelectOption } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Table } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ToastProvider } from "@/components/ui/toast/toast-provider";
import { useToast } from "@/components/ui/toast/toast-context";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";
import type { BadgeSize, BadgeVariant } from "@/components/ui/badge";

const BUTTON_VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "destructive"];
const BUTTON_SIZES: ButtonSize[] = ["sm", "md", "lg"];
const BADGE_VARIANTS: BadgeVariant[] = ["neutral", "success", "warning", "danger", "info"];
const BADGE_SIZES: BadgeSize[] = ["sm", "md"];

const SELECT_OPTIONS: SelectOption[] = [
  { value: "checking", label: "Checking", rightLabel: "Bank" },
  { value: "savings", label: "Savings", rightLabel: "Bank" },
  { value: "office-supplies", label: "Office Supplies", rightLabel: "Expense" },
  { value: "consulting-income", label: "Consulting Income", rightLabel: "Income" }
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-text-global)]">{title}</h2>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-icon-secondary)]">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <Row label="Trigger">
      <Button variant="primary" onClick={() => toast({ variant: "success", title: "Account created", description: "Checking account added to your chart of accounts." })}>
        Success toast
      </Button>
      <Button variant="secondary" onClick={() => toast({ variant: "error", title: "Could not save", description: "An account with that name already exists." })}>
        Error toast
      </Button>
      <Button variant="ghost" onClick={() => toast({ variant: "info", title: "Import started", description: "12 transactions queued." })}>
        Info toast
      </Button>
    </Row>
  );
}

export function UiKitShowcase() {
  const [textValue, setTextValue] = useState("");
  const [numberValue, setNumberValue] = useState("");
  const [selectValue, setSelectValue] = useState("");
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState("original");
  const [textareaValue, setTextareaValue] = useState("");
  const [selectAllState, setSelectAllState] = useState<"none" | "some" | "all">("some");

  return (
    <main className="min-h-screen bg-[var(--color-container-background-accent)] px-6 py-10 md:px-12">
      <div className="mx-auto w-full max-w-4xl">
        <h1 className="mb-1 text-2xl font-semibold text-[var(--color-text-global)]">Design system</h1>
        <p className="mb-10 text-sm text-[var(--color-text-primary)]">
          Every <code>ui/</code> component, in every variant, for visual QA. Dev-only -- 404s outside{" "}
          <code>NODE_ENV=development</code>. See <code>newgl-specs/UI_DESIGN_SYSTEM_PLAN.md</code>.
        </p>

        <Section title="Button">
          {BUTTON_VARIANTS.map((variant) => (
            <Row key={variant} label={variant}>
              {BUTTON_SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {size}
                </Button>
              ))}
              <Button variant={variant} iconLeft={Plus}>
                With icon
              </Button>
              <Button variant={variant} loading>
                Loading
              </Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
            </Row>
          ))}
        </Section>

        <Section title="IconButton">
          <Row label="ghost">
            <IconButton icon={Download} label="Export" variant="ghost" size="sm" />
            <IconButton icon={Download} label="Export" variant="ghost" size="md" />
          </Row>
          <Row label="outline">
            <IconButton icon={Trash2} label="Delete" variant="outline" size="sm" />
            <IconButton icon={Trash2} label="Delete" variant="outline" size="md" />
            <IconButton icon={Trash2} label="Delete (disabled)" variant="outline" disabled />
          </Row>
        </Section>

        <Section title="InputField">
          <Row label="default (md)">
            <InputField placeholder="e.g. Chase Checking" value={textValue} onChange={(e) => setTextValue(e.target.value)} />
          </Row>
          <Row label="sm (compact)">
            <InputField size="sm" placeholder="Compact" />
          </Row>
          <Row label="with label + hint">
            <InputField label="Account name" hint="Shown on the register and reports." placeholder="e.g. Chase Checking" />
          </Row>
          <Row label="with error">
            <InputField label="Account name" error="An account with that name already exists." defaultValue="Chase Checking" />
          </Row>
          <Row label="disabled">
            <InputField disabled placeholder="Disabled" />
          </Row>
        </Section>

        <Section title="NumberField">
          <Row label="right-aligned (default)">
            <NumberField placeholder="0.00" value={numberValue} onChange={(e) => setNumberValue(e.target.value)} />
          </Row>
          <Row label="currency prefix">
            <NumberField currency placeholder="0.00" />
          </Row>
          <Row label="left-aligned">
            <NumberField align="left" placeholder="0.00" />
          </Row>
          <Row label="with label + error">
            <NumberField label="Opening balance" currency error="Must be zero or greater." defaultValue="-50" />
          </Row>
        </Section>

        <Section title="Select">
          <Row label="default">
            <Select
              value={selectValue}
              onChange={setSelectValue}
              options={SELECT_OPTIONS}
              placeholder="Select an account"
              allowCustomValue={false}
            />
          </Row>
          <Row label="with label + error">
            <Select
              label="Target account"
              error="Select a target account."
              value=""
              onChange={() => {}}
              options={SELECT_OPTIONS}
              placeholder="Select an account"
              allowCustomValue={false}
            />
          </Row>
          <Row label="sm (compact options)">
            <Select
              value={selectValue}
              onChange={setSelectValue}
              options={SELECT_OPTIONS}
              placeholder="Select an account"
              allowCustomValue={false}
              optionSize="sm"
            />
          </Row>
        </Section>

        <Section title="Checkbox">
          <Row label="default">
            <Checkbox checked={checkboxChecked} onChange={(e) => setCheckboxChecked(e.target.checked)} label="Select row" />
          </Row>
          <Row label="indeterminate (select-all header)">
            <Checkbox
              checked={selectAllState === "all"}
              indeterminate={selectAllState === "some"}
              onChange={() => setSelectAllState((s) => (s === "all" ? "none" : "all"))}
              label={`state: ${selectAllState}`}
            />
          </Row>
          <Row label="disabled">
            <Checkbox disabled label="Disabled" />
            <Checkbox disabled checked label="Disabled + checked" />
          </Row>
        </Section>

        <Section title="RadioGroup">
          <Row label="default">
            <RadioGroup
              value={radioValue}
              onChange={setRadioValue}
              options={[
                { value: "original", label: "Keep original values" },
                { value: "reversed", label: "Reverse all values", description: "Flip income/expense sign for every row." }
              ]}
            />
          </Row>
        </Section>

        <Section title="Textarea">
          <Row label="default">
            <Textarea
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              placeholder="Memo"
              rows={3}
              className="w-80"
            />
          </Row>
          <Row label="with label + hint">
            <Textarea label="Description" hint="Shown on the account detail view." rows={3} className="w-80" />
          </Row>
        </Section>

        <Section title="Card">
          <Card title="Account settings" description="Basic info shown across reports.">
            <p className="text-sm text-[var(--color-text-primary)]">Card body content goes here.</p>
          </Card>
          <Card padding="sm">
            <Card.Body>
              <p className="text-sm text-[var(--color-text-primary)]">No title -- just body content, padding=&quot;sm&quot;.</p>
            </Card.Body>
            <Card.Footer>
              <Button variant="secondary">Cancel</Button>
              <Button variant="primary">Save</Button>
            </Card.Footer>
          </Card>
        </Section>

        <Section title="Table">
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Account</Table.HeaderCell>
                <Table.HeaderCell>Category</Table.HeaderCell>
                <Table.HeaderCell align="right">Balance</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              <Table.Row>
                <Table.Cell>Cash</Table.Cell>
                <Table.Cell>Bank</Table.Cell>
                <Table.Cell align="right">$26,957.50</Table.Cell>
              </Table.Row>
              <Table.Row selected>
                <Table.Cell>Chase Checking</Table.Cell>
                <Table.Cell>Bank</Table.Cell>
                <Table.Cell align="right">$0.00</Table.Cell>
              </Table.Row>
            </Table.Body>
          </Table.Root>
        </Section>

        <Section title="Badge">
          {BADGE_VARIANTS.map((variant) => (
            <Row key={variant} label={variant}>
              {BADGE_SIZES.map((size) => (
                <Badge key={size} variant={variant} size={size}>
                  {variant}
                </Badge>
              ))}
            </Row>
          ))}
        </Section>

        <Section title="Toast">
          <ToastProvider>
            <ToastDemo />
          </ToastProvider>
        </Section>
      </div>
    </main>
  );
}
