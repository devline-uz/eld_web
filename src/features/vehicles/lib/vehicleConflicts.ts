// owner: web-vehicles-drivers — unit number / VIN uniqueness for 11.2 Add vehicle and Edit unit.
import type { QueryClient } from '@tanstack/react-query';
import type { ConflictRule } from '@/shared/api/conflicts';
import { qkRoot } from '@/shared/api/queryKeys';
import type { VehicleRow } from '@/shared/api/vehicles';

export type VehicleConflictField = 'vin' | 'unitNumber';

/**
 * Which unique field a `POST /vehicles` or `PATCH /vehicles/:id` 409 collided on. Every 409 used to
 * be pinned on `unitNumber`, so a duplicate VIN told the user the *unit number* was taken. The
 * backend still sends a generic `CONFLICT` for both (backend_tasks.md B-97); `conflictField` reads
 * every hint it may carry. `null`: the conflict can't be attributed, so the caller shows a toast.
 */
export const VEHICLE_CONFLICT_RULES: readonly ConflictRule<VehicleConflictField>[] = [
  { field: 'vin', code: /VIN/, hint: /vin/, message: /\bvin\b/i },
  { field: 'unitNumber', code: /UNIT/, hint: /unit/, message: /unit.{0,20}number/i },
];

/** Unit numbers compare without the display `#` and case-insensitively; VINs case-insensitively. */
export const unitNumberKey = (value: string | null | undefined): string =>
  String(value ?? '').trim().replace(/^#/, '').toUpperCase();
export const vinKey = (value: string | null | undefined): string => String(value ?? '').trim().toUpperCase();

/**
 * Client-side pre-check against every `GET /vehicles` page already in the cache. This is a cheap
 * early warning only. The server stays the authority, and a miss here still ends in its 409.
 * `current` is the unit being edited: it is excluded, and a value it already holds is not
 * re-checked. That way a unit that shares a number with legacy data can still be saved unchanged.
 */
export function findCachedVehicleConflicts(
  queryClient: QueryClient,
  values: { unitNumber: string; vin: string },
  current?: Pick<VehicleRow, 'id' | 'unitNumber' | 'vin'>,
): VehicleConflictField[] {
  const others = new Map<string, VehicleRow>();
  for (const [, data] of queryClient.getQueriesData<{ items?: unknown }>({ queryKey: qkRoot.vehicles })) {
    if (!data || !Array.isArray(data.items)) continue; // skips the `qk.vehicle(id)` detail entries
    for (const row of data.items as VehicleRow[]) {
      if (row?.id && row.id !== current?.id) others.set(row.id, row);
    }
  }

  const found: VehicleConflictField[] = [];
  const unit = unitNumberKey(values.unitNumber);
  if (unit && unit !== unitNumberKey(current?.unitNumber)) {
    if ([...others.values()].some((v) => unitNumberKey(v.unitNumber) === unit)) found.push('unitNumber');
  }
  const vin = vinKey(values.vin);
  if (vin && vin !== vinKey(current?.vin)) {
    if ([...others.values()].some((v) => vinKey(v.vin) === vin)) found.push('vin');
  }
  return found;
}
