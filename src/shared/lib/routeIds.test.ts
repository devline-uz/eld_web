import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/api/errors';
import { isNotFoundError, isUuid, validRouteId } from './routeIds';

describe('routeIds (LIVE-019)', () => {
  it('accepts a UUID and refuses anything else', () => {
    expect(isUuid('849110e4-b315-4631-9736-11c4160b9223')).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(validRouteId('abc')).toBeUndefined();
    expect(validRouteId('00000000-0000-0000-0000-000000000000')).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('recognises a 404 ApiError only', () => {
    expect(isNotFoundError(new ApiError(404, { code: 'VEHICLE_NOT_FOUND', message: 'x' }))).toBe(true);
    expect(isNotFoundError(new ApiError(500, { message: 'x' }))).toBe(false);
    expect(isNotFoundError(new Error('x'))).toBe(false);
  });
});
