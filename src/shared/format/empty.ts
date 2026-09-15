// web/tz.md §8.4 — the exact placeholder strings. Muted styling is the caller's job; the text is
// never invented at the call site.
export const EMPTY = {
  /** No value in a table — em dash, muted. */
  dash: '—',
  /** No driver / no unit — muted, never italic. */
  unassigned: 'Unassigned',
  /** No ELD device. */
  notAssigned: 'Not assigned',
  /** No defects on a DVIR. */
  none: 'None',
  /** DVIR not submitted — warning colour. */
  notSubmitted: 'Not submitted',
} as const;

export const isBlank = (value: unknown): boolean =>
  value === null || value === undefined || value === '';

/** `—` for a missing table value, otherwise the formatted value. */
export function orDash<T>(value: T | null | undefined, format: (value: T) => string): string {
  return isBlank(value) ? EMPTY.dash : format(value as T);
}

/** `Unassigned` for a missing driver or unit. */
export function orUnassigned(value: string | null | undefined): string {
  return isBlank(value) ? EMPTY.unassigned : (value as string);
}

/** `Not assigned` for a missing device. */
export function orNotAssigned(value: string | null | undefined): string {
  return isBlank(value) ? EMPTY.notAssigned : (value as string);
}

/** `None` for an empty defect list. */
export function orNone(value: string | null | undefined): string {
  return isBlank(value) ? EMPTY.none : (value as string);
}
