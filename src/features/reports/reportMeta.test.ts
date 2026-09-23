// web/tz.md W-12…W-15 — labels, periods, the report selector by role, refusal text.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/errors';
import { ROLE_PERMISSIONS } from '../../../tests/fixtures/rolePermissions';
import { hasPermission, type Role } from '@/shared/auth/permissions';
import {
  REPORT_STATUS_BADGE,
  TRANSFER_RESULT_BADGE,
  dateOfDayKey,
  dayKeyOf,
  daysInRange,
  fileSizeLabel,
  monthStartKey,
  periodOf,
  previousQuarters,
  quarterLabel,
  quarterOf,
  quarterSpanLabel,
  rangeLabel,
  refusalText,
  reportLabel,
  saveFile,
  shiftDayKey,
  todayKey,
  visibleReportRoutes,
} from './reportMeta';

const labelsFor = (role: Role) =>
  visibleReportRoutes((key) => hasPermission(ROLE_PERMISSIONS[role], key), role).map((r) => r.label);

describe('report selector by role (§12.1, WB-002)', () => {
  it('ADMIN and FLEET_MANAGER see all four reports', () => {
    const all = ['IFTA mileage report', 'FMCSA / DOT audit pack', 'Activity report', 'DVIR report'];
    expect(labelsFor('ADMIN')).toEqual(all);
    expect(labelsFor('FLEET_MANAGER')).toEqual(all);
  });

  it('DISPATCHER sees the Activity report only', () => {
    expect(labelsFor('DISPATCHER')).toEqual(['Activity report']);
  });

  it('VIEWER never sees the FMCSA pack (reportsTransfer NONE)', () => {
    expect(labelsFor('VIEWER')).toEqual(['IFTA mileage report', 'Activity report', 'DVIR report']);
  });

  it('works without a role', () => {
    expect(visibleReportRoutes(() => true, null)).toHaveLength(4);
  });
});

describe('days and quarters', () => {
  it('formats and shifts calendar day keys without a zone shift', () => {
    expect(rangeLabel('2025-09-01', '2025-09-10')).toBe('Sep 01 – Sep 10, 2025');
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(monthStartKey('2026-09-12')).toBe('2026-09-01');
    expect(daysInRange('2026-09-03', '2026-09-10')).toBe(8);
    expect(dayKeyOf(dateOfDayKey('2026-09-03'))).toBe('2026-09-03');
    expect(dayKeyOf(dateOfDayKey('garbage'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolves "today" in the carrier zone, not the browser zone', () => {
    const lateEvening = new Date('2026-09-13T02:30:00.000Z'); // 22:30 in New York on Sep 12
    expect(todayKey('America/New_York', lateEvening)).toBe('2026-09-12');
    expect(todayKey('Asia/Tashkent', lateEvening)).toBe('2026-09-13');
  });

  it('builds quarter labels and walks back across a year', () => {
    expect(quarterOf('2026-09-12')).toBe('2026-Q3');
    expect(quarterOf('2026-01-01')).toBe('2026-Q1');
    expect(quarterLabel('2025-Q3')).toBe('Q3 2025');
    expect(quarterSpanLabel('2025-Q3')).toBe('Jul 1 – Sep 30');
    expect(previousQuarters('2026-Q2', 3)).toEqual(['2026-Q2', '2026-Q1', '2025-Q4']);
  });

  it('prints the PERIOD column for quarter, ranged and unknown params', () => {
    expect(periodOf({ params: { quarter: '2025-Q2' } })).toBe('Q2 2025');
    expect(periodOf({ params: { from: '2025-06-01', to: '2025-06-30' } })).toBe('Jun 01 – Jun 30, 2025');
    expect(periodOf({ params: {} })).toBe('—');
  });
});

describe('badges and sizes', () => {
  it('maps every report and transfer status to the drawn label', () => {
    expect(REPORT_STATUS_BADGE.READY).toEqual({ label: 'Ready', tone: 'success' });
    expect(REPORT_STATUS_BADGE.FAILED.tone).toBe('danger');
    expect(TRANSFER_RESULT_BADGE.TEST_ONLY).toEqual({ label: 'Test only', tone: 'info' });
    expect(TRANSFER_RESULT_BADGE.ACCEPTED.label).toBe('Accepted');
    expect(TRANSFER_RESULT_BADGE.REJECTED.tone).toBe('danger');
  });

  it('formats file sizes', () => {
    expect(fileSizeLabel(512)).toBe('512 B');
    expect(fileSizeLabel(20_480)).toBe('20 KB');
    expect(fileSizeLabel(2_516_582)).toBe('2.4 MB');
    expect(fileSizeLabel(null)).toBe('—');
    expect(fileSizeLabel(-1)).toBe('—');
  });
});

describe('refusalText — server refusals verbatim', () => {
  it('uses the §14.3 sentence for compliance codes', () => {
    const err = new ApiError(422, { code: 'UNCERTIFIED_LOGS', message: 'x' });
    expect(refusalText(err)).toBe('Some logs in this range are not certified.');
  });

  it("shows the server's own message when the code only has a generic mapping", () => {
    const err = new ApiError(422, {
      code: 'VALIDATION_FAILED',
      message: 'IFTA reports are generated as CSV in this version (streaming export, TZ §15).',
    });
    expect(refusalText(err)).toBe('IFTA reports are generated as CSV in this version (streaming export, TZ §15).');
  });

  it('falls back to the mapped text or a plain error message', () => {
    expect(refusalText(new ApiError(404, { code: 'NOT_FOUND' }))).toBe('Not found.');
    expect(refusalText(new Error('offline'))).toBe('offline');
    expect(refusalText('?')).toBe('Something went wrong.');
  });
});

describe('reportLabel (WB-099 · B-14)', () => {
  it('names stored-only RODS / IDLE_FUEL rows and never returns undefined', () => {
    expect(reportLabel('IFTA')).toBe('IFTA mileage report');
    expect(reportLabel('RODS')).toBe('Driver logs (RODS)');
    expect(reportLabel('IDLE_FUEL')).toBe('Idle & fuel report');
    expect(reportLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW');
  });
});

describe('saveFile', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clicks a temporary link for a presigned URL and for a Blob', () => {
    vi.useFakeTimers();
    const links: HTMLAnchorElement[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      links.push(this);
    });
    const create = vi.fn(() => 'blob:local');
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });

    saveFile('http://127.0.0.1:19000/reports/a.csv', 'a.csv');
    saveFile(new Blob(['x']), 'SMITH38018.csv');

    const [presigned, blobLink] = links as [HTMLAnchorElement, HTMLAnchorElement];
    // WB-140 — a cross-origin presigned URL opens in a new context; `download` is ignored there
    // and would navigate the SPA away, destroying the session.
    expect(presigned.target).toBe('_blank');
    expect(presigned.rel).toBe('noopener noreferrer');
    expect(presigned.hasAttribute('download')).toBe(false);
    // A blob URL is same-origin, so it still downloads in place.
    expect(blobLink.target).toBe('');
    expect(blobLink.getAttribute('download')).toBe('SMITH38018.csv');

    expect(click).toHaveBeenCalledTimes(2);
    expect(create).toHaveBeenCalledTimes(1);
    // WB-100 — never revoked on the click's own tick.
    expect(revoke).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith('blob:local');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
