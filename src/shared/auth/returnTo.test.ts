// WB-081 — the post-sign-in destination is untrusted input: only same-origin in-app paths pass.
import { afterEach, describe, expect, it } from 'vitest';
import {
  forgetReturnPath,
  readRememberedReturnPath,
  rememberReturnPath,
  safeReturnPath,
} from './returnTo';
import { ttlFromExpiresIn } from './tokenStore';

afterEach(() => window.sessionStorage.clear());

describe('safeReturnPath', () => {
  it.each([
    '/hos-logs?driverId=d1&date=2026-09-01',
    '/vehicles/v_42',
    '/account#sessions',
    '/',
  ])('accepts the in-app path %s unchanged', (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    ['protocol-relative', '//evil.example/x'],
    ['backslash host', '/\\evil.example'],
    ['absolute URL', 'https://evil.example/'],
    ['javascript URL', 'javascript:alert(1)'],
    ['relative path', 'vehicles'],
    ['tab trick', '/\t/evil.example'],
    ['newline trick', '/\n/evil.example'],
    ['empty', ''],
    ['the sign-in page itself', '/sign-in?reason=expired'],
  ])('refuses a %s', (_label, path) => {
    expect(safeReturnPath(path)).toBeNull();
  });

  it('refuses anything that is not a string', () => {
    expect(safeReturnPath(undefined)).toBeNull();
    expect(safeReturnPath({ pathname: '/x' })).toBeNull();
  });
});

describe('remembered return path (signInWithRedirect round trip)', () => {
  it('stores only a safe path and reads it back', () => {
    rememberReturnPath('/drivers/d_1');
    expect(readRememberedReturnPath()).toBe('/drivers/d_1');
    forgetReturnPath();
    expect(readRememberedReturnPath()).toBeNull();
  });

  it('never stores an unsafe one, and re-validates what it reads', () => {
    rememberReturnPath('//evil.example');
    expect(window.sessionStorage.length).toBe(0);
    window.sessionStorage.setItem('obk.returnTo', 'https://evil.example');
    expect(readRememberedReturnPath()).toBeNull();
  });
});

describe('ttlFromExpiresIn (WB-083)', () => {
  it('turns the server seconds into ms and refuses unusable values', () => {
    expect(ttlFromExpiresIn(300)).toBe(300_000);
    expect(ttlFromExpiresIn(0)).toBeUndefined();
    expect(ttlFromExpiresIn(-5)).toBeUndefined();
    expect(ttlFromExpiresIn('900')).toBeUndefined();
    expect(ttlFromExpiresIn(Number.NaN)).toBeUndefined();
  });
});
