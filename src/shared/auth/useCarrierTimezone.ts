import { useOptionalAuth } from './AuthProvider';

/** Same fallback the dashboard and reports use when the carrier zone is unknown. */
export const DEFAULT_CARRIER_TIMEZONE = 'America/New_York';

/**
 * LIVE-007 — the company-context zone (`carrier.timezone`, web/tz.md §8.3) for DVIR, unit, live
 * fleet, audit and report timestamps, so a record shows the same date and time on every page
 * whatever zone the browser is in. `/auth/me` carries it for every web user (`homeTerminalTimezone`
 * of a `user` subject is the carrier's zone), so no extra request and no `carrierSettings`
 * permission is needed — `GET /carrier` is behind that permission.
 */
export function useCarrierTimezone(): string {
  return useOptionalAuth()?.user?.homeTerminalTimezone || DEFAULT_CARRIER_TIMEZONE;
}
