// owner: web-auth-rbac — §17: the access token never leaves memory, only `obk.rt` is persisted.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACCESS_TOKEN_TTL_MS,
  REFRESH_LEAD_MS,
  clearSessionSnapshot,
  clearTokens,
  getAccessToken,
  getAccessTokenExpiry,
  getRefreshToken,
  readSessionSnapshot,
  setAccessToken,
  setRefreshToken,
  storeTokenPair,
  writeSessionSnapshot,
} from './tokenStore';

const KEY = 'obk.rt';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
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

describe('the session snapshot (WD-072)', () => {
  const SNAP_KEY = 'obk.session';
  const ME = { id: 'usr_1', type: 'user', role: 'VIEWER', permissions: { dashboard: 'READ' } };

  it('round-trips the /auth/me payload and the expiry through sessionStorage only', () => {
    writeSessionSnapshot({ me: ME, accessTokenExpiresAt: 1_700_000_000_000 });
    expect(readSessionSnapshot()).toEqual({ me: ME, accessTokenExpiresAt: 1_700_000_000_000 });
    expect(window.sessionStorage.getItem(SNAP_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(SNAP_KEY)).toBeNull();
  });

  it('never stores a token, even if one is smuggled in on the payload', () => {
    writeSessionSnapshot({
      me: { ...ME, accessToken: 'a-secret', refreshToken: 'r-secret' } as never,
      accessTokenExpiresAt: 1,
    });
    const raw = window.sessionStorage.getItem(SNAP_KEY) ?? '';
    expect(raw).not.toContain('a-secret');
    expect(raw).not.toContain('r-secret');
    expect(readSessionSnapshot()?.me).toEqual(ME);
  });

  it('rejects a malformed or partial snapshot instead of trusting it', () => {
    expect(readSessionSnapshot()).toBeNull();
    window.sessionStorage.setItem(SNAP_KEY, 'not json');
    expect(readSessionSnapshot()).toBeNull();
    window.sessionStorage.setItem(SNAP_KEY, JSON.stringify({ me: { id: 'x' } }));
    expect(readSessionSnapshot()).toBeNull();
    window.sessionStorage.setItem(SNAP_KEY, JSON.stringify({ me: ME }));
    expect(readSessionSnapshot()).toEqual({ me: ME, accessTokenExpiresAt: 0 });
  });

  it('is cleared by clearSessionSnapshot() and by clearTokens()', () => {
    writeSessionSnapshot({ me: ME, accessTokenExpiresAt: 1 });
    clearSessionSnapshot();
    expect(readSessionSnapshot()).toBeNull();
    writeSessionSnapshot({ me: ME, accessTokenExpiresAt: 1 });
    clearTokens();
    expect(readSessionSnapshot()).toBeNull();
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => writeSessionSnapshot({ me: ME, accessTokenExpiresAt: 1 })).not.toThrow();
    expect(readSessionSnapshot()).toBeNull();
    expect(() => clearSessionSnapshot()).not.toThrow();
  });
});
