import { describe, expect, it } from 'vitest';
import {
  CERTIFICATION_EVENT_TYPE,
  RECORD_ORIGIN,
  RECORD_STATUS,
  isCarrierCertificationRecord,
  isInactiveReviewRecord,
  isReplacedDeviceRecord,
  withEffectiveRecordStatus,
  type LogEventView,
} from './hosLogs';

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

describe('isCarrierCertificationRecord (LIVE-031, certify option c)', () => {
  const cert = {
    ...base,
    eventType: CERTIFICATION_EVENT_TYPE,
    eventCode: 1,
    recordOrigin: RECORD_ORIGIN.carrier,
    recordStatus: RECORD_STATUS.active,
  } as LogEventView;

  it('matches a carrier-written certification, active or proposed', () => {
    expect(isCarrierCertificationRecord(cert)).toBe(true);
    expect(isCarrierCertificationRecord({ ...cert, recordStatus: RECORD_STATUS.proposed, eventCode: 9 })).toBe(true);
  });

  it("never hides the driver's own certification or any non-certification record", () => {
    expect(isCarrierCertificationRecord({ ...cert, recordOrigin: RECORD_ORIGIN.driver })).toBe(false);
    expect(isCarrierCertificationRecord({ ...cert, eventType: 1 })).toBe(false);
    expect(isCarrierCertificationRecord({ ...cert, eventType: 3 })).toBe(false);
    expect(isCarrierCertificationRecord({ ...cert, eventCode: 0 })).toBe(false);
    expect(isCarrierCertificationRecord({ ...cert, recordStatus: RECORD_STATUS.superseded })).toBe(false);
  });
});

describe('replaced device records (D-163)', () => {
  const flagged = { ...base, reviewReason: 'REPLACED_DEVICE', reviewDeviceLabel: 'Pixel 7' } as LogEventView;

  it('isReplacedDeviceRecord reads reviewReason, tolerating older servers without it', () => {
    expect(isReplacedDeviceRecord(flagged)).toBe(true);
    expect(isReplacedDeviceRecord({ ...base, reviewReason: null })).toBe(false);
    expect(isReplacedDeviceRecord(base)).toBe(false);
  });

  it('isInactiveReviewRecord: a flagged record stored inert, never an active flagged one or a plain proposal', () => {
    expect(isInactiveReviewRecord({ ...flagged, recordStatus: RECORD_STATUS.proposed })).toBe(true);
    expect(isInactiveReviewRecord(flagged)).toBe(false);
    expect(isInactiveReviewRecord({ ...base, recordStatus: RECORD_STATUS.proposed })).toBe(false);
  });
});
