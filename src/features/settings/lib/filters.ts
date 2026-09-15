// owner: web-settings-admin — W-18 Settings · Users, 11.23 Filters pattern (web/tz.md §11.23),
// mirroring `features/vehicles/lib/filters.ts` (the W-03 reference implementation).
//
// `GET /users` (backend/src/modules/users/users.controller.ts `list()`) takes no query
// parameters at all — no role/status filter exists server-side. `UsersPage` already loads
// the full back-office user list once (`useUsersList()`, a bare array, no pagination), so every
// filter here runs against that same in-memory set — no extra request. Recorded as gap B-63.
import type { UserRow } from '@/shared/api/settingsAdmin';

export const USER_ROLE_OPTIONS = ['ADMIN', 'FLEET_MANAGER', 'DISPATCHER', 'VIEWER'] as const;
export type UserRoleFilter = (typeof USER_ROLE_OPTIONS)[number];

export const USER_STATUS_OPTIONS = ['ACTIVE', 'INVITED', 'DISABLED'] as const;
export type UserStatusFilter = (typeof USER_STATUS_OPTIONS)[number];

export interface UserFilters {
  role: UserRoleFilter[];
  status: UserStatusFilter[];
}

export const EMPTY_USER_FILTERS: UserFilters = {
  role: [],
  status: [],
};

const PARAM = {
  role: 'fRole',
  status: 'fStatus',
} as const;

export function parseUserFilters(params: URLSearchParams): UserFilters {
  return {
    role: (params.get(PARAM.role)?.split(',').filter(Boolean) ?? []) as UserRoleFilter[],
    status: (params.get(PARAM.status)?.split(',').filter(Boolean) ?? []) as UserStatusFilter[],
  };
}

/** Writes the filter set onto an existing `URLSearchParams`, removing keys that are unset. */
export function writeUserFilters(params: URLSearchParams, filters: UserFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const setOrDelete = (key: string, value: string | null) => {
    if (value) next.set(key, value);
    else next.delete(key);
  };
  setOrDelete(PARAM.role, filters.role.join(',') || null);
  setOrDelete(PARAM.status, filters.status.join(',') || null);
  return next;
}

export function countActiveUserFilters(filters: UserFilters): number {
  let n = 0;
  if (filters.role.length) n += 1;
  if (filters.status.length) n += 1;
  return n;
}

export function matchesUserFilters(row: UserRow, filters: UserFilters): boolean {
  if (filters.role.length && !filters.role.includes(row.role.key as UserRoleFilter)) return false;
  if (filters.status.length && !filters.status.includes(row.status)) return false;
  return true;
}
