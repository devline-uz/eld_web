// owner: web-auth-rbac — §17: the access token never leaves memory, only `obk.rt` is persisted.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_LEAD_MS,
  clearTokens,
  getAccessToken,
  getAccessTokenExpiry,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  storeTokenPair,
} from './tokenStore';

const KEY = 'obk.rt';

beforeEach(() => {
  window.localStorage.clear();
  clearTokens();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the access token', () => {
  it('lives in memory and is never written to localStorage', () => {
    setAccessToken('access-abc');
    expect(getAccessToken()).toBe('access-abc');
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(JSON.stringify(window.localStorage)).not.toContain('access-abc');
  });

  it('expires 15 minutes out by default, and the refresh lead is 60 s', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T10:00:00Z'));
    setAccessToken('access-abc');
    expect(getAccessTokenExpiry()).toBe(Date.now() + ACCESS_TOKEN_TTL_MS);
    expect(ACCESS_TOKEN_TTL_MS).toBe(15 * 60_000);
    expect(REFRESH_LEAD_MS).toBe(60_000);
  });

  it('accepts an explicit ttl', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T10:00:00Z'));
    setAccessToken('access-abc', 5_000);
    expect(getAccessTokenExpiry()).toBe(Date.now() + 5_000);
  });

  it('clearing the token zeroes the expiry', () => {
    setAccessToken('access-abc');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
    expect(getAccessTokenExpiry()).toBe(0);
  });
});

describe('the refresh token', () => {
  it('round-trips through localStorage under obk.rt', () => {
    setRefreshToken('refresh-xyz');
    expect(window.localStorage.getItem(KEY)).toBe('refresh-xyz');
    expect(getRefreshToken()).toBe('refresh-xyz');
  });

  it('is removed, not blanked, when set to null', () => {
    setRefreshToken('refresh-xyz');
    setRefreshToken(null);
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('survives a localStorage that throws on write (private mode)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => setRefreshToken('refresh-xyz')).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });

  it('survives a localStorage that throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(getRefreshToken()).toBeNull();
  });

  it('survives a localStorage that throws on remove', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });
    expect(() => setRefreshToken(null)).not.toThrow();
  });
});

describe('storeTokenPair / clearTokens', () => {
  it('stores a pair in its two different places', () => {
    storeTokenPair({ accessToken: 'a1', refreshToken: 'r1', tokenType: 'Bearer' });
    expect(getAccessToken()).toBe('a1');
    expect(window.localStorage.getItem(KEY)).toBe('r1');
  });

  it('clearTokens wipes both', () => {
    storeTokenPair({ accessToken: 'a1', refreshToken: 'r1' });
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getAccessTokenExpiry()).toBe(0);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });
});
