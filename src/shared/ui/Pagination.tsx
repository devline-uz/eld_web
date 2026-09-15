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
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="flex h-14 items-center justify-between border-t border-border px-card">
      <div className="flex items-center gap-2 text-body text-text-secondary">
        <label htmlFor="rows-per-page">Rows per page:</label>
        <select
          id="rows-per-page"
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
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex size-8 items-center justify-center rounded-md hover:bg-bg-subtle disabled:opacity-40"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        {pageList(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-text-muted">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={cn(
                'tabular flex size-8 items-center justify-center rounded-md',
                p === page ? 'bg-primary text-text-inverse' : 'text-text-secondary hover:bg-bg-subtle',
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex size-8 items-center justify-center rounded-md hover:bg-bg-subtle disabled:opacity-40"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
