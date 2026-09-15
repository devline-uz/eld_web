// 11.14 — FMCSA constraints are enforced exactly and never widened.
import { describe, expect, it } from 'vitest';
import { VALIDATION_MESSAGES as M } from '@/shared/forms/messages';
import { sendLogsSchema, transferRangeFor } from './sendLogs';

const base = {
  driverId: 'drv_1',
  method: 'WEB_SERVICES' as const,
  outputFileComment: 'ROADSIDE INSPECTION 2026-09-10',
  from: '2026-09-03',
  to: '2026-09-10',
};

const messages = (value: unknown) => {
  const result = sendLogsSchema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('sendLogsSchema', () => {
  it('accepts an 8-day eRODS transfer without a recipient (WB-029)', () => {
    expect(messages(base)).toEqual([]);
  });

  it('uses the backend enum spelling WEB_SERVICES, never WEB_SERVICE', () => {
    expect(messages({ ...base, method: 'WEB_SERVICE' })).not.toEqual([]);
  });

  it('rejects a 9-day range and an inverted range with the §14.2 sentence', () => {
    expect(messages({ ...base, from: '2026-09-02' })).toEqual([`to: ${M.transferRange}`]);
    expect(messages({ ...base, from: '2026-09-11' })).toEqual([`to: ${M.transferRange}`]);
  });

  it('requires an fmcsa.dot.gov address for an email transfer', () => {
    expect(messages({ ...base, method: 'EMAIL', recipient: 'officer@gmail.com' })).toEqual([
      `recipient: ${M.inspectorEmail}`,
    ]);
    expect(messages({ ...base, method: 'EMAIL' })).toHaveLength(1);
    expect(messages({ ...base, method: 'EMAIL', recipient: 'j.doe@fmcsa.dot.gov' })).toEqual([]);
  });

  it('caps the output file comment at 60 characters and requires one', () => {
    expect(messages({ ...base, outputFileComment: 'X'.repeat(60) })).toEqual([]);
    expect(messages({ ...base, outputFileComment: 'X'.repeat(61) })).toEqual([`outputFileComment: ${M.outputFileComment}`]);
    expect(messages({ ...base, outputFileComment: '' })).toEqual([`outputFileComment: ${M.outputFileComment}`]);
  });

  it('requires a driver', () => {
    expect(messages({ ...base, driverId: '' })).toHaveLength(1);
  });
});

describe('transferRangeFor — narrowed, never widened (WD-045)', () => {
  it('keeps a range of 8 days or fewer', () => {
    expect(transferRangeFor('2026-09-03', '2026-09-10')).toEqual({ from: '2026-09-03', to: '2026-09-10' });
  });

  it('narrows a longer page range to the 8 days ending on its last day', () => {
    expect(transferRangeFor('2026-09-01', '2026-09-12')).toEqual({ from: '2026-09-05', to: '2026-09-12' });
  });
});
