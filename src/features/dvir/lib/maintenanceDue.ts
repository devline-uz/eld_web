// owner: web-dvir-safety — W-09 Schedules (WD-112). A line-for-line mirror of the backend's
// `eld_backend/src/modules/service/maintenance-due.ts` (`computeDue`), used only to *preview* in
// the New/Edit schedule form what the server will compute on save. The server stays the authority:
// the table always shows the `due` block the API returned. Keep the thresholds and the
// "whichever trips first" rule identical to the backend file when either side changes.

export interface DueCheckInput {
  intervalMi: number | null;
  intervalDays: number | null;
  lastServiceMi: number | null;
  lastServiceAt: Date | null;
  currentOdometerMi: number;
  now: Date;
}

export type DueState = 'OK' | 'DUE_SOON' | 'OVERDUE';

export interface DueResult {
  state: DueState;
  nextDueMi: number | null;
  nextDueAt: Date | null;
  milesRemaining: number | null;
  daysRemaining: number | null;
}

/** Same values as the backend `DUE_SOON_MILES` / `DUE_SOON_DAYS`. */
export const DUE_SOON_MILES = 500;
export const DUE_SOON_DAYS = 7;

export function computeDue(input: DueCheckInput): DueResult {
  const nextDueMi = input.intervalMi != null ? (input.lastServiceMi ?? 0) + input.intervalMi : null;
  const nextDueAt =
    input.intervalDays != null ? addDays(input.lastServiceAt ?? new Date(0), input.intervalDays) : null;

  const milesRemaining = nextDueMi != null ? nextDueMi - input.currentOdometerMi : null;
  const daysRemaining = nextDueAt != null ? diffDays(nextDueAt, input.now) : null;

  const overdue = (milesRemaining !== null && milesRemaining <= 0) || (daysRemaining !== null && daysRemaining <= 0);
  const dueSoon =
    !overdue &&
    ((milesRemaining !== null && milesRemaining <= DUE_SOON_MILES) ||
      (daysRemaining !== null && daysRemaining <= DUE_SOON_DAYS));

  return {
    state: overdue ? 'OVERDUE' : dueSoon ? 'DUE_SOON' : 'OK',
    nextDueMi,
    nextDueAt,
    milesRemaining,
    daysRemaining,
  };
}

/** Which interval(s) made a result OVERDUE — for the form's warning copy. */
export function overdueReasons(due: DueResult): { miles: boolean; days: boolean } {
  return {
    miles: due.milesRemaining !== null && due.milesRemaining <= 0,
    days: due.daysRemaining !== null && due.daysRemaining <= 0,
  };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function diffDays(future: Date, now: Date): number {
  return Math.ceil((future.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
