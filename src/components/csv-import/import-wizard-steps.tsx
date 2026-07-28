import { Check } from "lucide-react";
import type { WizardStep } from "@/modules/accounting/domain/csv-import";

export type WizardStepInfo = {
  key: WizardStep;
};

type ImportWizardStepsProps = {
  steps: WizardStepInfo[];
  currentStep: WizardStep;
};

export function ImportWizardSteps({ steps, currentStep }: ImportWizardStepsProps) {
  const currentIndex = steps.findIndex((step) => step.key === currentStep);

  return (
    <ol className="flex shrink-0 flex-col items-center py-2">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <li key={step.key} className="flex flex-col items-center">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium ${
                isComplete
                  ? "border-[var(--color-ui-primary)] bg-[var(--color-ui-primary)] text-white"
                  : isCurrent
                    ? "border-[var(--color-ui-primary)] text-[var(--color-ui-primary)]"
                    : "border-[var(--color-divider-tertiary)] text-[var(--color-icon-secondary)]"
              }`}
            >
              {isComplete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
            </div>
            {index < steps.length - 1 ? (
              <div className="my-1 h-10 w-px bg-[var(--color-divider-tertiary)]" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
