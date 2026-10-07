// owner: web-vehicles-drivers — unit number / VIN / ELD serial / plate+state uniqueness for 11.2 Add vehicle and Edit unit.
import type { QueryClient } from '@tanstack/react-query';
import type { ConflictRule } from '@/shared/api/conflicts';
import { qkRoot } from '@/shared/api/queryKeys';
import type { DeviceRow, VehicleRow } from '@/shared/api/vehicles';

export type VehicleConflictField = 'vin' | 'unitNumber' | 'eldSerial' | 'licensePlate';

/**
 * Which unique field a `POST /vehicles` or `PATCH /vehicles/:id` 409 collided on. Every 409 used to
 * be pinned on `unitNumber`, so a duplicate VIN told the user the *unit number* was taken. The
 * backend still sends a generic `CONFLICT` for both (backend_tasks.md B-97); `conflictField` reads
 * every hint it may carry. `null`: the conflict can't be attributed, so the caller shows a toast.
 * `licensePlate` covers the plate + issuing-state pair (`plateState` / `issuingState` hints too).
 */
export const VEHICLE_CONFLICT_RULES: readonly ConflictRule<VehicleConflictField>[] = [
  { field: 'eldSerial', code: /SERIAL|DEVICE/, hint: /serial|device/, message: /serial/i },
  { field: 'licensePlate', code: /PLATE/, hint: /plate|issuingstate/, message: /plate/i },
  { field: 'vin', code: /VIN/, hint: /vin/, message: /\bvin\b/i },
  { field: 'unitNumber', code: /UNIT/, hint: /unit/, message: /unit.{0,20}number/i },
];

/** Unit numbers compare without the display `#` and case-insensitively; VINs case-insensitively. */
export const unitNumberKey = (value: string | null | undefined): string =>
  String(value ?? '').trim().replace(/^#/, '').toUpperCase();
export const vinKey = (value: string | null | undefined): string => String(value ?? '').trim().toUpperCase();
/** ELD serial / plate / state: trimmed + upper-cased; empty -> '' (an empty value never conflicts). */
export const serialKey = (value: string | null | undefined): string => String(value ?? '').trim().toUpperCase();
export const plateKey = (value: string | null | undefined): string => String(value ?? '').trim().toUpperCase();
export const stateKey = (value: string | null | undefined): string => String(value ?? '').trim().toUpperCase();
/** `PLATE|STATE` — `''` when there is no plate, so an unplated unit never conflicts. ABC123|OH and
 * ABC123|TX are different keys; the same plate with no state only equals itself. */
export const plateStateKey = (plate: string | null | undefined, state: string | null | undefined): string => {
  const p = plateKey(plate);
  return p ? `${p}|${stateKey(state)}` : '';
};

/** The one normalisation create and edit share before submit: trim + upper-case, empty -> undefined. */
export function normalizeVehicleUniques(values: {
  licensePlate?: string | null;
  licenseState?: string | null;
  deviceId?: string | null;
}): { licensePlate?: string; plateState?: string; deviceId?: string } {
  const plate = plateKey(values.licensePlate);
  const state = stateKey(values.licenseState);
  const serial = serialKey(values.deviceId);
  return {
    licensePlate: plate || undefined,
    plateState: plate && state ? state : undefined,
    deviceId: serial || undefined,
  };
}

/** Pure rule check against already-known rows — shared by the modal pre-check and the tests.
 * `current` (the unit being edited) is excluded, and a value it already holds is not re-checked,
 * so a unit sharing a value with legacy data can still be saved unchanged. A device only blocks
 * the serial when it is paired to a *different* unit (an unpaired device is simply paired). */
export function findVehicleConflicts(
  rows: { vehicles: readonly VehicleRow[]; devices?: readonly Pick<DeviceRow, 'serial' | 'vehicleId'>[] },
  values: { unitNumber: string; vin: string; licensePlate?: string | null; licenseState?: string | null; deviceId?: string | null },
  current?: Pick<VehicleRow, 'id' | 'unitNumber' | 'vin' | 'licensePlate' | 'plateState'>,
): VehicleConflictField[] {
  const others = rows.vehicles.filter((v) => v?.id && v.id !== current?.id && v.deletedAt == null);
  const found: VehicleConflictField[] = [];
  const unit = unitNumberKey(values.unitNumber);
  if (unit && unit !== unitNumberKey(current?.unitNumber) && others.some((v) => unitNumberKey(v.unitNumber) === unit)) {
    found.push('unitNumber');
  }
  const vin = vinKey(values.vin);
  if (vin && vin !== vinKey(current?.vin) && others.some((v) => vinKey(v.vin) === vin)) found.push('vin');
  const serial = serialKey(values.deviceId);
  if (
    serial &&
    (rows.devices ?? []).some((d) => serialKey(d.serial) === serial && d.vehicleId != null && d.vehicleId !== current?.id)
  ) {
    found.push('eldSerial');
  }
  const plate = plateStateKey(values.licensePlate, values.licenseState);
  if (
    plate &&
    plate !== plateStateKey(current?.licensePlate, current?.plateState) &&
    others.some((v) => plateStateKey(v.licensePlate, v.plateState) === plate)
  ) {
    found.push('licensePlate');
  }
  return found;
}

/** Client-side pre-check against every `GET /vehicles` / `GET /devices` page already in the cache.
 * A cheap early warning only: the server stays the authority, and a miss here still ends in its 409. */
export function findCachedVehicleConflicts(
  queryClient: QueryClient,
  values: Parameters<typeof findVehicleConflicts>[1],
  current?: Parameters<typeof findVehicleConflicts>[2],
): VehicleConflictField[] {
  const vehicles = new Map<string, VehicleRow>();
  for (const [, data] of queryClient.getQueriesData<{ items?: unknown }>({ queryKey: qkRoot.vehicles })) {
    if (!data || !Array.isArray(data.items)) continue; // skips the `qk.vehicle(id)` detail entries
    for (const row of data.items as VehicleRow[]) if (row?.id) vehicles.set(row.id, row);
  }
  const devices: DeviceRow[] = [];
  for (const [, data] of queryClient.getQueriesData<{ items?: unknown }>({ queryKey: qkRoot.devices })) {
    if (data && Array.isArray(data.items)) devices.push(...(data.items as DeviceRow[]));
  }
  return findVehicleConflicts({ vehicles: [...vehicles.values()], devices }, values, current);
}
