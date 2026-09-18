// owner: web-reports-transfer — labels, periods and the report selector shared by W-12…W-15.
//
// Timezones (§8.3): report RANGES are carrier-context, so "today" and "this quarter" are resolved
// in `carrier.timezone`. A range itself is a pair of calendar day keys (`YYYY-MM-DD`) and is
// formatted as such — it is never shifted through a zone. Anything inside a RODS document (the
// transfer range, the Appendix A file) is a driver home-terminal day and is handled by the backend.
import { format } from 'date-fns';
import { ApiError, ERROR_MESSAGES } from '@/shared/api/errors';
import { DVIR_REPORT_MAX_PAGES, type ReportRow, type ReportType, type TransferStatus } from '@/shared/api/reports';
import { formatNumber } from '@/shared/format/numbers';
import type { PermissionKey, Role } from '@/shared/auth/permissions';
import type { BadgeTone } from '@/shared/ui/Badge';
import { formatDateRange, formatInTz } from '@/shared/format/datetime';
import { daySpan } from '@/shared/forms/fields';

/**
 * ⛔ Gap B-45 — `GET /carrier` is `carrierSettings` READ, which FLEET_MANAGER lacks. Until the
 * carrier zone is readable with `reports`, the seeded carrier's zone is the fallback — the same
 * one W-01 uses (DashboardPage `carrierTz`).
 */
export const CARRIER_TZ_FALLBACK = 'America/New_York';

export const REPORT_LABEL: Record<ReportType, string> = {
  IFTA: 'IFTA mileage report',
  ACTIVITY: 'Activity report',
  DVIR: 'DVIR report',
  FMCSA_PACK: 'FMCSA audit pack',
  UNIDENTIFIED: 'Unidentified driving report',
  SAFETY: 'Safety report',
};

/**
 * ⛔ Gap B-14 — the backend can still store `RODS` / `IDLE_FUEL` rows although `ReportType` omits
 * them; they carry their W-12 library names. Any other unknown type shows its raw value, never
 * `undefined` (web/bugs.md WB-099).
 */
const STORED_ONLY_LABEL: Record<string, string> = {
  RODS: 'Driver logs (RODS)',
  IDLE_FUEL: 'Idle & fuel report',
};

export function reportLabel(type: string): string {
  return (REPORT_LABEL as Record<string, string | undefined>)[type] ?? STORED_ONLY_LABEL[type] ?? type;
}

/* ------------------------------------------------------------------ selector */

export interface ReportRoute {
  label: string;
  to: string;
  perm: PermissionKey;
  /**
   * Mirrors `blockedRoles` in app/router.tsx: the screenshots give DISPATCHER only the Activity
   * report (web/bugs.md WB-002), even though the backend grants `reports` READ.
   */
  blockedRoles?: Role[];
}

export const REPORT_ROUTES: ReportRoute[] = [
  { label: 'IFTA mileage report', to: '/reports/ifta', perm: 'reports', blockedRoles: ['DISPATCHER'] },
  { label: 'FMCSA / DOT audit pack', to: '/reports/fmcsa', perm: 'reportsTransfer' },
  { label: 'Activity report', to: '/reports/activity', perm: 'reports' },
  { label: 'DVIR report', to: '/reports/dvir', perm: 'reports', blockedRoles: ['DISPATCHER'] },
];

export function visibleReportRoutes(
  can: (key: PermissionKey) => boolean,
  role: Role | null | undefined,
): ReportRoute[] {
  return REPORT_ROUTES.filter(
    (r) => can(r.perm) && !(role && r.blockedRoles?.includes(role)),
  );
}

/* ------------------------------------------------------------------ days and quarters */

/** The calendar day a DateRangePicker cell stands for. */
export const dayKeyOf = (date: Date): string => format(date, 'yyyy-MM-dd');

/** `2026-09-01` → a local Date on that calendar day, for the picker. */
export function dateOfDayKey(key: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  // A malformed key must never reach date-fns `format` (it throws on an Invalid Date).
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export const todayKey = (timeZone: string, now: Date = new Date()): string =>
  formatInTz(now, timeZone, 'yyyy-MM-dd');

export function shiftDayKey(key: string, days: number): string {
  const base = Date.parse(`${key}T00:00:00Z`);
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

export const monthStartKey = (key: string): string => `${key.slice(0, 7)}-01`;

/** Inclusive day count of a key range; `NaN` when either key is not a day. */
export const daysInRange = (from: string, to: string): number => daySpan(from, to);

/** `Sep 01 – Sep 10, 2025` from two day keys — calendar days, no zone shift. */
export const rangeLabel = (from: string, to: string): string =>
  formatDateRange(`${from}T00:00:00Z`, `${to}T00:00:00Z`, 'UTC');

/** `2026-Q3` for the quarter "today" falls in, in the carrier zone. */
export function quarterOf(key: string): string {
  const month = Number(key.slice(5, 7));
  return `${key.slice(0, 4)}-Q${Math.floor((month - 1) / 3) + 1}`;
}

export function previousQuarters(quarter: string, count: number): string[] {
  let year = Number(quarter.slice(0, 4));
  let q = Number(quarter.slice(-1));
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push(`${year}-Q${q}`);
    q -= 1;
    if (q === 0) {
      q = 4;
      year -= 1;
    }
  }
  return out;
}

/** `2026-Q3` → `Q3 2026` */
export const quarterLabel = (quarter: string): string => `${quarter.slice(-2)} ${quarter.slice(0, 4)}`;

/** `2026-Q3` → `Jul 1 – Sep 30` */
export function quarterSpanLabel(quarter: string): string {
  const year = Number(quarter.slice(0, 4));
  const q = Number(quarter.slice(-1));
  const start = new Date(Date.UTC(year, (q - 1) * 3, 1));
  const end = new Date(Date.UTC(year, q * 3, 0));
  return `${formatInTz(start, 'UTC', 'MMM d')} – ${formatInTz(end, 'UTC', 'MMM d')}`;
}

/** `PERIOD` column: `Q2 2025` for IFTA, `Jun 01 – Jun 30, 2025` for ranged reports. */
export function periodOf(report: Pick<ReportRow, 'params'>): string {
  const { quarter, from, to } = report.params as { quarter?: unknown; from?: unknown; to?: unknown };
  if (typeof quarter === 'string') return quarterLabel(quarter);
  if (typeof from === 'string' && typeof to === 'string') return rangeLabel(from, to);
  return '—';
}

/* ------------------------------------------------------------------ status badges */

export const REPORT_STATUS_BADGE: Record<ReportRow['status'], { label: string; tone: BadgeTone }> = {
  READY: { label: 'Ready', tone: 'success' },
  QUEUED: { label: 'Queued', tone: 'neutral' },
  RUNNING: { label: 'Running', tone: 'info' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

/** `RESULT` column (W-15). `SENT` and `QUEUED` are not drawn; see web/decisions.md WD-040. */
export const TRANSFER_RESULT_BADGE: Record<TransferStatus, { label: string; tone: BadgeTone }> = {
  ACCEPTED: { label: 'Accepted', tone: 'success' },
  SENT: { label: 'Sent', tone: 'success' },
  TEST_ONLY: { label: 'Test only', tone: 'info' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  FAILED: { label: 'Failed', tone: 'danger' },
  QUEUED: { label: 'Queued', tone: 'neutral' },
};

export const TRANSFER_METHOD_LABEL = {
  WEB_SERVICES: 'Web services (eRODS)',
  EMAIL: 'Email to inspector',
} as const;

/* ------------------------------------------------------------------ export scope (WB-097) */

/**
 * The CSV/PDF shortcuts take only `from`/`to` plus `driverId` (Activity) or `vehicleId` (DVIR). A
 * filter they cannot carry is never dropped silently: the screen states what the file holds.
 */
export const ACTIVITY_EXPORT_SCOPE =
  'Export CSV covers every home terminal and driver status — the terminal filter applies to this screen only.';
export const DVIR_EXPORT_SCOPE =
  'Export CSV and Download PDF include every defect type — the defect filter applies to this screen only.';

/**
 * WB-096 · gap B-47 — `GET /dvir` has no date filter, so the list is walked back from the newest
 * inspection; when the walk is capped before the range start, the counts are a lower bound.
 */
export const DVIR_WINDOW_NOTE = `Only the newest ${formatNumber(DVIR_REPORT_MAX_PAGES * 200)} inspections could be read — earlier inspections in this range are not counted.`;

/* ------------------------------------------------------------------ misc */

/** `2.4 MB` — the size in the `Report ready` toast. */
export function fileSizeLabel(bytes: number | null | undefined): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A server refusal, shown verbatim (§14.3). Known codes carry their exact §14.3 sentence; a code
 * with only a generic mapping (e.g. VALIDATION_FAILED on an unsupported format) shows the server's
 * own message, because the generic "check the highlighted fields" would hide the real reason.
 */
const GENERIC_CODES = new Set(['VALIDATION_FAILED', 'INTERNAL_ERROR', 'NOT_FOUND', 'CONFLICT']);

export function refusalText(error: unknown): string {
  if (error instanceof ApiError) {
    if (ERROR_MESSAGES[error.code] && !GENERIC_CODES.has(error.code)) return error.userMessage;
    if (error.message && error.message !== 'Request failed') return error.message;
    return error.userMessage;
  }
  return error instanceof Error && error.message ? error.message : 'Something went wrong.';
}

/** Saves a Blob or opens a presigned URL without ever putting the URL in the DOM or a log. */
export function saveFile(source: Blob | string, fileName: string): void {
  const href = typeof source === 'string' ? source : URL.createObjectURL(source);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking on the click's own tick can abort the download in Firefox/Safari (WB-100).
  if (typeof source !== 'string') setTimeout(() => URL.revokeObjectURL(href), 0);
}
