import type { ReconcileStatus } from "@/modules/accounting/domain/models";

export function reconcileStatusClassName(status: ReconcileStatus): string {
  if (status === "C") {
    return "text-[var(--color-icon-secondary)] font-medium text-sm";
  }
  if (status === "R") {
    return "text-[var(--color-positive)] font-medium text-sm";
  }
  return "";
}

const STATUS_LABEL: Record<ReconcileStatus, string> = {
  "": "Uncleared",
  C: "Cleared",
  R: "Reconciled"
};

type ReconcileStatusCellProps = {
  status: ReconcileStatus;
  className?: string;
  onCycle: () => void;
};

export function ReconcileStatusCell({ status, className = "", onCycle }: ReconcileStatusCellProps) {
  return (
    <td className="form-control">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onCycle();
        }}
        aria-label={`Reconcile status: ${STATUS_LABEL[status]}. Click to change.`}
        className={`flex h-[32px] w-full rounded-full cursor-pointer items-center justify-center bg-[var(--color-input-background)] text-[13px] ${className}`.trim()}
      >
        <span className={reconcileStatusClassName(status)}>{status}</span>
      </button>
    </td>
  );
}
