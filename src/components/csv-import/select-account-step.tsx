"use client";

import { SelectField } from "@/components/bank-register/select-field";
import type { SelectFieldOption } from "@/components/bank-register/select-field";
import { Button } from "@/components/ui/button";

type SelectAccountStepProps = {
  fileName: string;
  accountOptions: SelectFieldOption[];
  mainAccountId: string;
  onMainAccountChange: (accountId: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

export function SelectAccountStep({
  fileName,
  accountOptions,
  mainAccountId,
  onMainAccountChange,
  onBack,
  onContinue
}: SelectAccountStepProps) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
      <h2 className="text-xl font-medium text-[var(--color-text-primary)]">
        Which account are these transactions from?
      </h2>

      <p className="text-sm text-[var(--color-icon-secondary)]">
        Selected File: <span className="text-[var(--color-link-text)]">{fileName}</span>
      </p>

      <div>
        <p className="mb-1 text-sm text-[var(--color-text-primary)]">
          Select an account for the file you want to upload
        </p>
        <SelectField
          value={mainAccountId}
          onChange={onMainAccountChange}
          options={accountOptions}
          placeholder="Select account"
          allowCustomValue={false}
        />
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onContinue} disabled={!mainAccountId}>
          Continue
        </Button>
      </div>
    </div>
  );
}
