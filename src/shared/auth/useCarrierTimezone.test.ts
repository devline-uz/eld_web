import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CARRIER_TIMEZONE, useCarrierTimezone } from './useCarrierTimezone';

describe('useCarrierTimezone (LIVE-007)', () => {
  it('falls back to the default carrier zone outside <AuthProvider>', () => {
    const { result } = renderHook(() => useCarrierTimezone());
    expect(result.current).toBe(DEFAULT_CARRIER_TIMEZONE);
  });
});
