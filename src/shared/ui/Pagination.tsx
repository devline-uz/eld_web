import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './cn';

// owner: web-design-system — §5.6. Works against the server `OffsetPage<T>` shape
// (`items, page, limit, total, totalPages`).

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;

export interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

function pageList(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('…');
    result.push(p);
    prev = p;
  }
  return result;
}

export function Pagination({ page, limit, total, totalPages, itemLabel, onPageChange, onLimitChange }: PaginationProps) {
  // A page beyond the last one is not a rendering state of its own: the caller's `page` can lag one
  // render behind a list that just shrank (a filter, a resolve, a refetch), and `(page - 1) * limit`
  // would then read `41–3 of 3` with no page button marked current. Clamp for display only — the
  // caller still owns `page` and is told through `onPageChange` where it landed.
  const lastPage = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), lastPage);
  const from = total === 0 ? 0 : Math.min((safePage - 1) * limit + 1, total);
  const to = Math.min(total, safePage * limit);
  // Two tables on one screen must not share `id="rows-per-page"`: a duplicate id points both
  // labels at the first select.
  const selectId = useId();

  return (
    <div className="flex h-14 items-center justify-between border-t border-border px-card">
      <div className="flex items-center gap-2 text-body text-text-secondary">
        <label htmlFor={selectId}>Rows per page:</label>
        <select
          id={selectId}
          value={limit}
          onChange={(e) => onLimitChange(Number(e.target.value))}
          className="h-8 rounded-md border border-border bg-bg-surface px-2 text-body"
        >
          {ROWS_PER_PAGE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1 text-body text-text-secondary">
        <span className="tabular mr-2">
          {from}–{to} of {total} {itemLabel}
        </span>
        <button
          type="button"
          aria-label="Previous page"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          className="flex size-8 items-center justify-center rounded-md hover:bg-bg-subtle disabled:opacity-40"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        {pageList(safePage, lastPage).map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === safePage ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={cn(
                'tabular flex size-8 items-center justify-center rounded-md',
                p === safePage ? 'bg-primary text-text-inverse' : 'text-text-secondary hover:bg-bg-subtle',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={safePage >= lastPage}
          onClick={() => onPageChange(safePage + 1)}
          className="flex size-8 items-center justify-center rounded-md hover:bg-bg-subtle disabled:opacity-40"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
