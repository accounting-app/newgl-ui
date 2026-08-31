type TablePaginationProps = {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  start: number;
  end: number;
  onPageChange: (page: number) => void;
};

export function TablePagination({ totalItems, currentPage, totalPages, start, end, onPageChange }: TablePaginationProps) {
  const hasPages = totalItems > 0 && totalPages > 0;

  const buttonBaseClass = "text-sm transition-colors disabled:cursor-not-allowed disabled:text-[var(--color-text-disabled)]";
  const buttonClass = `${buttonBaseClass} text-[var(--color-text-primary)] hover:enabled:text-[var(--color-text-highlight)]`;

  function goTo(page: number) {
    if (!hasPages || page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  }

  const atFirstPage = !hasPages || currentPage <= 1;
  const atLastPage = !hasPages || currentPage >= totalPages;

  return (
    <div className="m-0 mb-5 flex justify-end px-[5px] py-0">
      <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-primary)]">
        <span>Go to:</span>
        {/* Not a control -- clicking the current page number is a no-op by
            definition, so this is display text, not a link pretending to
            be interactive. */}
        <span aria-current="page">{currentPage}</span>
        <span>of {totalPages}</span>
        <button type="button" disabled={atFirstPage} className={buttonClass} onClick={() => goTo(currentPage - 1)} aria-label="Previous page">
          {"<"}
        </button>
        <button type="button" disabled={atFirstPage} className={buttonClass} onClick={() => goTo(1)}>
          First
        </button>
        <button type="button" disabled={atFirstPage} className={buttonClass} onClick={() => goTo(currentPage - 1)}>
          Previous
        </button>
        <span>
          {start}-{end} of {totalItems}
        </span>
        <button type="button" disabled={atLastPage} className={buttonClass} onClick={() => goTo(currentPage + 1)}>
          Next
        </button>
        <button type="button" disabled={atLastPage} className={buttonClass} onClick={() => goTo(totalPages)}>
          Last
        </button>
        <button type="button" disabled={atLastPage} className={buttonClass} onClick={() => goTo(currentPage + 1)} aria-label="Next page">
          {">"}
        </button>
      </div>
    </div>
  );
}
