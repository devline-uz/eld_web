import { describe, expect, it } from 'vitest';
import { humanizeTimestamps } from './bodyText';

describe('humanizeTimestamps (LIVE-027)', () => {
  const now = new Date('2026-10-14T12:00:00Z');

  it('rewrites an ISO instant into the carrier zone', () => {
    expect(humanizeTimestamps('ELD connection lost: Jo has been DRIVING since 2026-10-08T09:13:00.000Z with no status change.', 'America/Denver', now)).toBe(
      'ELD connection lost: Jo has been DRIVING since Oct 08, 03:13 with no status change.',
    );
  });

  it('leaves plain text and bare dates alone', () => {
    expect(humanizeTimestamps('Maintenance due on 2026-10-20.', 'America/Denver', now)).toBe('Maintenance due on 2026-10-20.');
  });
});
