// D-163 (backend, 2026-10-15) — records a replaced device delivered late. Every event view carries
// `reviewReason` / `reviewDeviceLabel`, and `GET /logs/:driverId/events?review=REPLACED_DEVICE`
// narrows the list to them. The MSW handler is held to the documented `LogEventView` schema and
// query parameter, so a renamed field or enum value fails here.
import { describe, expect, it } from 'vitest';
import { client } from '../../src/shared/api/client';
import { endpoints } from '../../src/shared/api/endpoints';
import { REVIEW_REASON, type LogEventsResponse } from '../../src/shared/api/hosLogs';
import { openapi, operation } from './openapi';

interface Prop {
  enum?: unknown[];
  nullable?: boolean;
  type?: string;
}
const schemas = (openapi as unknown as { components: { schemas: Record<string, { properties: Record<string, Prop>; required: string[] }> } })
  .components.schemas;
const eventView = schemas.LogEventView!;

describe('LogEventView — D-163 review fields', () => {
  it('documents reviewReason (nullable, REPLACED_DEVICE) and reviewDeviceLabel (nullable string) as required', () => {
    expect(eventView.required).toEqual(expect.arrayContaining(['reviewReason', 'reviewDeviceLabel']));
    expect(eventView.properties.reviewReason).toMatchObject({ nullable: true, enum: [REVIEW_REASON.replacedDevice] });
    expect(eventView.properties.reviewDeviceLabel).toMatchObject({ type: 'string', nullable: true });
  });

  it('documents the `review` query parameter on GET /logs/{driverId}/events', () => {
    const op = operation('GET', '/api/logs/{driverId}/events') as unknown as {
      parameters: { name: string; in: string; required?: boolean; schema: { enum?: string[] } }[];
    };
    const review = op.parameters.find((param) => param.name === 'review');
    expect(review).toMatchObject({ in: 'query', required: false });
    expect(review!.schema.enum).toEqual([REVIEW_REASON.replacedDevice]);
  });
});

describe('GET /logs/:driverId/events — MSW handler vs the schema', () => {
  it('every row carries every required LogEventView key, review pair included', async () => {
    const day = await client.get<LogEventsResponse>(endpoints.logs.events('drv_1'), { params: { date: '2026-09-10' } });
    expect(day.events.length).toBeGreaterThan(0);
    for (const row of day.events) {
      const missing = eventView.required.filter((key) => !(key in row));
      expect(missing, `row ${row.id}`).toEqual([]);
    }
    expect(day.events.some((row) => row.reviewReason === REVIEW_REASON.replacedDevice)).toBe(true);
  });

  it('?review=REPLACED_DEVICE with date returns only that day\'s flagged records', async () => {
    const flagged = await client.get<LogEventsResponse>(endpoints.logs.events('drv_1'), {
      params: { date: '2026-09-10', review: REVIEW_REASON.replacedDevice },
    });
    expect(flagged.date).toBe('2026-09-10');
    expect(flagged.events.length).toBeGreaterThan(0);
    for (const row of flagged.events) {
      expect(row.reviewReason).toBe(REVIEW_REASON.replacedDevice);
      expect(typeof row.reviewDeviceLabel).toBe('string');
    }
  });

  it('?review=REPLACED_DEVICE without date answers date: null (every flagged record of the driver)', async () => {
    const all = await client.get<LogEventsResponse>(endpoints.logs.events('drv_1'), {
      params: { review: REVIEW_REASON.replacedDevice },
    });
    expect(all.date).toBeNull();
    expect(all.carriedIn).toBeNull();
    expect(all.events.every((row) => row.reviewReason === REVIEW_REASON.replacedDevice)).toBe(true);
  });
});
