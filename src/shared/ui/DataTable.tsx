import {
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from './cn';
import { LoadingState } from './states';

// owner: web-design-system — §5.5. Every table in the app is this component.
// Read-only rule (§12.2): the checkbox column and the row `…` column are *not rendered*
// unless `selectable`/`rowActions` are supplied — callers gate those props on FULL permission.

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  getRowId?: (row: T) => string;
  /** Only pass true when the caller has FULL permission and the screen has a bulk action. */
  selectable?: boolean;
  selection?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Only pass when the caller has FULL permission — renders the row `…` column. */
  rowActions?: (row: T) => ReactNode;
  caption: string;
  isLoading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  /**
   * Extra classes per row. Added for W-08's `Log events`, where §395 requires the audit trail to
   * stay visible: superseded records render struck through and muted, proposed ones on
   * `--info-soft`. Every `<tr>` also carries `data-row-id` so a screen can scroll a row into view.
   */
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  selectable = false,
  selection,
  onSelectionChange,
  rowActions,
  caption,
  isLoading = false,
  emptyState,
  onRowClick,
  rowClassName,
  className,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});

  const rowSelection =
    selection !== undefined
      ? Object.fromEntries(selection.map((id) => [id, true]))
      : internalSelection;

  function setRowSelection(next: RowSelectionState) {
    if (onSelectionChange) {
      onSelectionChange(Object.keys(next).filter((id) => next[id]));
    } else {
      setInternalSelection(next);
    }
  }

  // Rebuilt only when the inputs that actually change the column set change — an `allColumns`
  // literal rebuilt on every render (e.g. from `sorting`/`internalSelection` state churn or a
  // parent re-render from polling/a live update) gives TanStack Table a new `columns` reference
  // each time, which regenerates every row/cell model and can close an open row-actions dropdown
  // mid-interaction (NEW, found alongside WB-121).
  const allColumns: ColumnDef<T, unknown>[] = useMemo(() => [
    ...(selectable
      ? [
          {
            id: '__select',
            header: ({ table }) => (
              <input
                type="checkbox"
                aria-label="Select all rows"
                checked={table.getIsAllRowsSelected()}
                ref={(el) => {
                  if (el) el.indeterminate = table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected();
                }}
                onChange={table.getToggleAllRowsSelectedHandler()}
              />
            ),
            cell: ({ row }) => (
              <input
                type="checkbox"
                aria-label="Select row"
                checked={row.getIsSelected()}
                onChange={row.getToggleSelectedHandler()}
                onClick={(e) => e.stopPropagation()}
              />
            ),
            enableSorting: false,
            size: 36,
          } satisfies ColumnDef<T, unknown>,
        ]
      : []),
    ...columns,
    ...(rowActions
      ? [
          {
            id: '__actions',
            header: '',
            cell: ({ row }) => (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    aria-label="Row actions"
                    onClick={(e) => e.stopPropagation()}
                    className="flex size-8 items-center justify-center rounded-md hover:bg-bg-subtle"
                  >
                    <MoreHorizontal size={16} strokeWidth={1.75} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  {/* Radix portals `Content` to `document.body`, but React re-parents synthetic
                      events onto the *component* tree, not the DOM tree — without this, picking
                      any item here still bubbles a click up to the row's own `onClick` and fires
                      `onRowClick` (WB-039: "Edit unit" opened its modal and simultaneously
                      navigated to the unit detail page, unmounting the modal mid-edit). */}
                  <DropdownMenu.Content
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                    className="z-50 min-w-40 rounded-md border border-border bg-bg-surface p-1 shadow-pop"
                  >
                    {rowActions(row.original)}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ),
            enableSorting: false,
            size: 40,
          } satisfies ColumnDef<T, unknown>,
        ]
      : []),
  ], [selectable, columns, rowActions]);

  // TanStack Table's returned functions are stable by its own contract; the React Compiler
  // check is a false positive here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      setRowSelection(next);
    },
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: selectable,
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (data.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <table className={cn('w-full border-collapse text-body', className)}>
      <caption className="sr-only">{caption}</caption>
      <thead className="h-table-head">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="border-b border-border">
            {headerGroup.headers.map((header) => {
              const sortDirection = header.column.getIsSorted();
              const ariaSort = sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : 'none';
              const numeric = (header.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
              return (
                <th
                  key={header.id}
                  scope="col"
                  aria-sort={header.column.getCanSort() ? ariaSort : undefined}
                  className={cn(
                    'px-3 text-table-head font-semibold uppercase tracking-wide text-text-muted',
                    numeric && 'text-right',
                  )}
                >
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sortDirection === 'asc' && <ChevronUp size={14} strokeWidth={1.75} />}
                      {sortDirection === 'desc' && <ChevronDown size={14} strokeWidth={1.75} />}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            data-row-id={row.id}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={() => onRowClick?.(row.original)}
            onKeyDown={(e) => {
              if (onRowClick && e.key === 'Enter') onRowClick(row.original);
            }}
            className={cn(
              'h-row border-b border-border last:border-b-0',
              onRowClick && 'cursor-pointer hover:bg-bg-subtle',
              row.getIsSelected() && 'bg-primary-soft',
              rowClassName?.(row.original),
            )}
          >
            {row.getVisibleCells().map((cell) => {
              const numeric = (cell.column.columnDef.meta as { numeric?: boolean } | undefined)?.numeric;
              return (
                <td key={cell.id} className={cn('px-3 text-text', numeric && 'tabular text-right')}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
