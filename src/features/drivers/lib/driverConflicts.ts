// owner: web-vehicles-drivers — which unique driver value a 409 collided on (B-100), shared by
// 11.8 Add driver and Edit driver. Codes: USERNAME_TAKEN / EMAIL_TAKEN / PHONE_TAKEN /
// CDL_NUMBER_TAKEN / VEHICLE_ALREADY_ASSIGNED (+ the old DUPLICATE_* and generic CONFLICT forms).
import type { QueryClient } from '@tanstack/react-query';
import { qkRoot } from '@/shared/api/queryKeys';
import type { ConflictRule } from '@/shared/api/conflicts';
import { VALIDATION_MESSAGES } from '@/shared/forms/messages';

export type DriverConflictField = 'username' | 'email' | 'phone' | 'cdlNumber' | 'assignedVehicleId';

/**
 * Which unique value a `POST /drivers` 409 collided on. Every 409 used to be pinned on `username`,
 * so a duplicate email told the user the *username* was taken, and phone / licence / unit
 * conflicts had no field at all. The backend sends a generic `CONFLICT` (backend_tasks.md B-100),
 * so `conflictField` reads every hint it may carry; `null` → a generic "already in use" banner.
 */
export const DRIVER_CONFLICT_RULES: readonly ConflictRule<DriverConflictField>[] = [
  { field: 'username', code: /USERNAME/, hint: /username/, message: /\busername\b/i },
  { field: 'email', code: /EMAIL/, hint: /email/, message: /\be-?mail\b/i },
  { field: 'phone', code: /PHONE/, hint: /phone/, message: /\bphone\b/i },
  {
    field: 'cdlNumber',
    code: /CDL|LICEN[CS]E/,
    hint: /cdl|licen[cs]e/,
    message: /\b(cdl|licen[cs]e)\b/i,
  },
  {
    field: 'assignedVehicleId',
    code: /VEHICLE|UNIT|ASSIGN/,
    hint: /vehicle|unit/,
    message: /\b(unit|vehicle)\b/i,
  },
];

export const CONFLICT_MESSAGES: Record<Exclude<DriverConflictField, 'assignedVehicleId'>, string> = {
  username: VALIDATION_MESSAGES.usernameTaken,
  email: VALIDATION_MESSAGES.driverEmailTaken,
  phone: VALIDATION_MESSAGES.driverPhoneTaken,
  cdlNumber: VALIDATION_MESSAGES.cdlNumberTaken,
};


/* ------------------------------------------------------------------ client-side pre-check */
// Same keys as the backend (`eld_backend/src/modules/drivers/lib/driver-uniques.ts`) and the MSW
// mock. Empty -> '' and never conflicts. Username is trimmed and case-sensitive on the server.
export const usernameKey = (value: string | null | undefined): string => String(value ?? '').trim();
export const emailKey = (value: string | null | undefined): string => String(value ?? '').trim().toLowerCase();
export const phoneKey = (value: string | null | undefined): string => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};
export const cdlKey = (value: string | null | undefined): string =>
  String(value ?? '').toUpperCase().replace(/[\s-]/g, '');

type UniqueField = 'username' | 'email' | 'phone' | 'cdlNumber';
const KEYS: Record<UniqueField, (v: string | null | undefined) => string> = {
  username: usernameKey,
  email: emailKey,
  phone: phoneKey,
  cdlNumber: cdlKey,
};
const UNIQUE_FIELDS = Object.keys(KEYS) as UniqueField[];

export type DriverUniques = Partial<Record<UniqueField, string | null | undefined>>;
type DriverLike = DriverUniques & { id: string; status?: string; deletedAt?: string | null };

/**
 * Which unique values `candidate` already shares with another live driver. A terminated / deleted
 * driver holds nothing. `excludeId` is the driver being edited; a value the driver already holds
 * (`current`) is not re-checked, so legacy data never blocks an unrelated edit. Fields absent
 * from `candidate` are skipped (Edit has no username).
 */
export function findDriverConflicts(
  candidate: DriverUniques,
  drivers: readonly DriverLike[],
  opts: { excludeId?: string; current?: DriverUniques } = {},
): UniqueField[] {
  const others = drivers.filter((d) => d.id !== opts.excludeId && d.status !== 'TERMINATED' && d.deletedAt == null);
  return UNIQUE_FIELDS.filter((field) => {
    if (!(field in candidate)) return false;
    const key = KEYS[field](candidate[field]);
    if (!key || (opts.current && key === KEYS[field](opts.current[field]))) return false;
    return others.some((d) => KEYS[field](d[field]) === key);
  });
}

/** Reads every `GET /drivers` page already in the cache; no list cached -> no pre-check (the
 * server 409 stays the authority). */
export function findCachedDriverConflicts(
  queryClient: QueryClient,
  candidate: DriverUniques,
  opts: { excludeId?: string; current?: DriverUniques } = {},
): UniqueField[] {
  const rows = new Map<string, DriverLike>();
  for (const [, data] of queryClient.getQueriesData<{ items?: unknown }>({ queryKey: qkRoot.drivers })) {
    if (!data || !Array.isArray(data.items)) continue; // skips detail entries
    for (const row of data.items as DriverLike[]) if (row?.id) rows.set(row.id, row);
  }
  return findDriverConflicts(candidate, [...rows.values()], opts);
}
