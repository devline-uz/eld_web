// owner: web-vehicles-drivers — keeps soft-deleted units out of every `GET /vehicles` result.
//
// `DELETE /vehicles/:id` is a soft delete (tz.md §11.3, backend-gaps B-65): the backend flips the
// unit to `INACTIVE`. A unit that was only "Set inactive" (bulk bar, B-71) is also `INACTIVE` and
// must stay listed under the Inactive segment, so `status` cannot tell the two apart. Two markers
// are used instead:
//   1. whatever the API sends — `deletedAt` (non-null) or `isDeleted: true` (asked for in
//      backend_tasks.md B-101; the MSW mock already sends `deletedAt`);
//   2. a per-QueryClient set of ids this session deleted — until B-101 ships, the real list still
//      returns the row, and without this the post-delete refetch would put it straight back.
// Kept out of `vehicles.ts` so `vehicleCounts.ts` (sidebar, initial chunk — WB-249) can use it.
import type { QueryClient } from '@tanstack/react-query';
import type { OffsetPage } from './types';

interface DeletableRow {
  id: string;
  deletedAt?: string | null;
  isDeleted?: boolean;
}

const deletedInSession = new WeakMap<QueryClient, Set<string>>();

/** Remembers a unit the server just confirmed deleted, for this QueryClient's lifetime. */
export function markVehicleDeleted(queryClient: QueryClient, id: string): void {
  const ids = deletedInSession.get(queryClient) ?? new Set<string>();
  ids.add(id);
  deletedInSession.set(queryClient, ids);
}

export function isDeletedVehicle(row: DeletableRow, queryClient?: QueryClient): boolean {
  if (row.deletedAt != null || row.isDeleted === true) return true;
  return queryClient ? (deletedInSession.get(queryClient)?.has(row.id) ?? false) : false;
}

/** Drops soft-deleted rows from one list page; `total` shrinks by the rows dropped from it. */
export function withoutDeletedVehicles<T extends DeletableRow>(page: OffsetPage<T>, queryClient?: QueryClient): OffsetPage<T> {
  const items = page.items.filter((row) => !isDeletedVehicle(row, queryClient));
  const dropped = page.items.length - items.length;
  if (dropped === 0) return page;
  return { ...page, items, total: Math.max(0, page.total - dropped) };
}
