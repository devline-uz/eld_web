import { describe, expect, it } from 'vitest';
import { RECORD_STATUS, withEffectiveRecordStatus, type LogEventView } from './hosLogs';

const base = { id: '1', recordStatus: RECORD_STATUS.active } as LogEventView;

describe('withEffectiveRecordStatus (QA CODE-027)', () => {
  it('reads the server-computed effective status and keeps the stored one', () => {
    expect(withEffectiveRecordStatus({ ...base, effectiveRecordStatus: RECORD_STATUS.superseded })).toMatchObject({
      recordStatus: RECORD_STATUS.superseded,
      storedRecordStatus: RECORD_STATUS.active,
    });
  });

  it('leaves a row untouched when the server sends no effective status or the same one', () => {
    expect(withEffectiveRecordStatus(base)).toBe(base);
    const same = { ...base, effectiveRecordStatus: RECORD_STATUS.active };
    expect(withEffectiveRecordStatus(same)).toBe(same);
  });
});
