import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/errors';
import { importIssues, normalizeImportRow } from './importRows';
import { activityDetails, activityLabel, activitySource, fuelLabel } from './activity';

describe('normalizeImportRow — CSV strings to the `POST /vehicles/import` row shape', () => {
  it('turns numeric columns into numbers and drops blank cells', () => {
    expect(
      normalizeImportRow({
        unitNumber: '7320',
        vin: '1XPBD49X3PD732001',
        year: '2023',
        odometerMi: '154220',
        licensePlate: '',
        fuelType: 'diesel',
        notes: '  ',
      }),
    ).toEqual({ unitNumber: '7320', vin: '1XPBD49X3PD732001', year: 2023, odometerMi: 154220, fuelType: 'DIESEL' });
  });

  it('leaves a non-numeric value as typed so the server names it', () => {
    expect(normalizeImportRow({ year: 'twenty' })).toEqual({ year: 'twenty' });
  });

  it('maps 422 issue paths to row numbers', () => {
    const err = new ApiError(422, {
      code: 'VALIDATION_FAILED',
      details: { issues: [{ path: 'vehicles.0.odometerMi', message: 'Number must be greater than or equal to 0' }] },
    });
    expect(importIssues(err)).toEqual(['Row 1 · odometerMi: Number must be greater than or equal to 0']);
  });
});

describe('Unit activity display text', () => {
  it('never prints a bare audit enum, source or trace id', () => {
    expect(activityLabel('CALIBRATE_ODOMETER')).toBe('Odometer calibrated');
    expect(activityLabel('SOME_NEW_ACTION')).toBe('Some new action');
    expect(activityLabel('Duty status changed to Driving')).toBe('Duty status changed to Driving');
    expect(activitySource('AUDIT')).toBe('Web panel');
    expect(activityDetails('traceId=65756256-e76e-4681-ab28-37d083458f1c')).toBe('—');
    expect(activityDetails('SATISFACTORY')).toBe('SATISFACTORY');
    expect(fuelLabel('CNG')).toBe('CNG');
    expect(fuelLabel('DIESEL')).toBe('Diesel');
  });
});
