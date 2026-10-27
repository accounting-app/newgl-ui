import { RegisterTableColumnGroup } from "@/components/bank-register/register-table-column-group";

export type RegisterBatchControls = {
  active: boolean;
  selectedCount: number;
  selectableCount: number;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleSelectAll: () => void;
};

const BATCH_LINK =
  "text-[11px] font-semibold uppercase text-[var(--color-link-text)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)] disabled:no-underline";

export function RegisterTableHeader({ batch }: { batch?: RegisterBatchControls }) {
  return (
    <div className="header-table">
      <table className="w-full min-w-[1025px] table-fixed border-collapse text-sm">
        <RegisterTableColumnGroup />
        <thead className="text-left uppercase tracking-wide">
          <tr>
            <th className="px-2 pb-[5px] pt-2 text-left align-middle">
              Date
            </th>
            <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">
              Ref No.
            </th>
            <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">
              Payee
            </th>
            <th className="border-l-custom px-2 pb-[5px] pt-2 text-left align-middle">
              Memo
            </th>
            <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">
              Payment
            </th>
            <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">
              Deposit
            </th>
            <th className="border-l-custom px-2 pb-[5px] pt-2 text-center align-middle">
              ✓
            </th>
            <th className="border-l-custom px-2 pb-[5px] pt-2 text-right align-middle">
              Balance
            </th>
          </tr>
          <tr>
            <th className=" px-2 pb-[6px] pt-0 text-left tracking-normal">
              {batch && !batch.active ? (
                <button
                  type="button"
                  onClick={batch.onStart}
                  className="rounded border border-[var(--color-button-border)] px-2 text-[11px] font-semibold uppercase text-[var(--color-text-primary)] hover:bg-[var(--color-action-standard-subtle-hover)]"
                >
                  Batch
                </button>
              ) : batch ? (
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <button type="button" className={BATCH_LINK} disabled={batch.selectedCount === 0} onClick={batch.onEdit}>
                    Edit
                  </button>
                  <button type="button" className={BATCH_LINK} disabled={batch.selectedCount === 0} onClick={batch.onDelete}>
                    Delete
                  </button>
                  <button type="button" className={BATCH_LINK} disabled={batch.selectableCount === 0} onClick={batch.onToggleSelectAll}>
                    {batch.selectedCount > 0 && batch.selectedCount === batch.selectableCount ? "Select none" : "Select all"}
                  </button>
                </span>
              ) : (
                <>&nbsp;</>
              )}
            </th>
            <th className="border-l-custom px-2 pb-[6px] pt-0 text-left tracking-normal">
              Type
            </th>
            <th className="border-l-custom px-2 pb-[6px] pt-0 text-left tracking-normal">
              Account
            </th>
            <th className="border-l-custom px-2 pb-[6px] pt-0 text-left tracking-normal">
              &nbsp;
            </th>
            <th className="border-l-custom px-2 pb-[6px] pt-0 text-right tracking-normal">
              &nbsp;
            </th>
            <th className="border-l-custom px-2 pb-[6px] pt-0 text-right tracking-normal">
              &nbsp;
            </th>
            <th className="border-l-custom px-2 pb-[6px] pt-0 text-center tracking-normal">
              &nbsp;
            </th>
            <th className="border-l-custom px-2 pb-[6px] pt-0 text-right tracking-normal">
              &nbsp;
            </th>
          </tr>
        </thead>
      </table>
    </div>
  );
}
