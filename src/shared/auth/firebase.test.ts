// owner: web-auth-rbac — the Google path (web/tz.md §6.5, W-00 error table).
// The Firebase SDK is dynamically imported inside the click handler, so the modules are mocked
// here rather than loaded: no network, no real Firebase project.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithPopup = vi.fn();
const signInWithRedirect = vi.fn();
const getRedirectResult = vi.fn();
const firebaseSignOut = vi.fn();
const initializeApp = vi.fn(() => ({ name: 'test-app' }));
const getApps = vi.fn(() => [] as unknown[]);

vi.mock('firebase/app', () => ({
  initializeApp,
  getApps,
  getApp: () => ({ name: 'test-app' }),
}));

vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  GoogleAuthProvider: class {
    setCustomParameters = vi.fn();
  },
  signInWithPopup: (...args: unknown[]) => signInWithPopup(...args),
  signInWithRedirect: (...args: unknown[]) => signInWithRedirect(...args),
  getRedirectResult: (...args: unknown[]) => getRedirectResult(...args),
  signOut: (...args: unknown[]) => firebaseSignOut(...args),
}));

/** Re-imports firebase.ts with the given env so `isGoogleSignInConfigured()` is re-evaluated. */
async function loadModule(configured: boolean) {
  vi.resetModules();
  vi.stubEnv('VITE_FIREBASE_API_KEY', configured ? 'key' : '');
  vi.stubEnv('VITE_FIREBASE_AUTH_DOMAIN', configured ? 'onebook.firebaseapp.com' : '');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', configured ? 'onebook' : '');
  return import('./firebase');
}

beforeEach(() => {
  signInWithPopup.mockReset();
  signInWithRedirect.mockReset();
  getRedirectResult.mockReset();
  firebaseSignOut.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('configuration', () => {
  it('reports itself unconfigured when the env vars are empty (dev today)', async () => {
    const mod = await loadModule(false);
    expect(mod.isGoogleSignInConfigured()).toBe(false);
  });

  it('degrades gracefully instead of crashing when unconfigured', async () => {
    const mod = await loadModule(false);
    const error = await mod.signInWithGoogle().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(mod.GoogleSignInError);
    expect((error as Error).message).toBe('Google sign-in is not configured in this environment.');
    expect(signInWithPopup).not.toHaveBeenCalled();
  });

  it('returns no redirect result when unconfigured', async () => {
    const mod = await loadModule(false);
    await expect(mod.consumeGoogleRedirectResult()).resolves.toBeNull();
  });

  it('is configured once all three env vars are present', async () => {
    const mod = await loadModule(true);
    expect(mod.isGoogleSignInConfigured()).toBe(true);
  });
});

describe('signInWithGoogle', () => {
  it('returns the Google ID token from the popup', async () => {
    const mod = await loadModule(true);
    signInWithPopup.mockResolvedValue({ user: { getIdToken: async () => 'id-token-1' } });
    await expect(mod.signInWithGoogle()).resolves.toEqual({
      kind: 'idToken',
      idToken: 'id-token-1',
    });
  });

  it('falls back to signInWithRedirect when the popup is blocked', async () => {
    const mod = await loadModule(true);
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    signInWithRedirect.mockResolvedValue(undefined);
    await expect(mod.signInWithGoogle()).resolves.toEqual({ kind: 'redirecting' });
    expect(signInWithRedirect).toHaveBeenCalledTimes(1);
  });

  it('explains how to unblock pop-ups when the redirect also fails', async () => {
    const mod = await loadModule(true);
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-blocked' });
    signInWithRedirect.mockRejectedValue(new Error('nope'));
    const error = (await mod.signInWithGoogle().catch((e: unknown) => e)) as Error;
    expect(error.message).toBe('Allow pop-ups for this site to sign in with Google.');
  });

  it('a popup the user closed is not an error — W-00 shows no banner', async () => {
    const mod = await loadModule(true);
    signInWithPopup.mockRejectedValue({ code: 'auth/popup-closed-by-user' });
    await expect(mod.signInWithGoogle()).resolves.toEqual({ kind: 'cancelled' });
  });

  it('a superseded popup request is also just cancelled', async () => {
    const mod = await loadModule(true);
    signInWithPopup.mockRejectedValue({ code: 'auth/cancelled-popup-request' });
    await expect(mod.signInWithGoogle()).resolves.toEqual({ kind: 'cancelled' });
  });

  it('maps a network failure to its own sentence', async () => {
    const mod = await loadModule(true);
    signInWithPopup.mockRejectedValue({ code: 'auth/network-request-failed' });
    const error = (await mod.signInWithGoogle().catch((e: unknown) => e)) as Error;
    expect(error.message).toBe('Could not reach Google. Check your connection.');
  });

  it('an unknown Firebase code falls back to the generic W-00 sentence', async () => {
    const mod = await loadModule(true);
    signInWithPopup.mockRejectedValue({ code: 'auth/internal-error' });
    const error = (await mod.signInWithGoogle().catch((e: unknown) => e)) as Error;
    expect(error.message).toBe('Google sign-in failed. Try again.');
  });

  it('maps an unauthorised Firebase domain', async () => {
    const mod = await loadModule(true);
    expect((await loadModule(true)).googleErrorMessage('auth/unauthorized-domain')).toBe(
      'Google sign-in is not authorised for this domain.',
    );
    expect(mod.googleErrorMessage('auth/popup-blocked')).toBe(
      'Allow pop-ups for this site to sign in with Google.',
    );
  });

  it('initialises the Firebase app exactly once across calls', async () => {
    const mod = await loadModule(true);
    initializeApp.mockClear();
    getApps.mockReturnValueOnce([]).mockReturnValue([{ name: 'test-app' }]);
    signInWithPopup.mockResolvedValue({ user: { getIdToken: async () => 't' } });
    await mod.signInWithGoogle();
    await mod.signInWithGoogle();
    expect(initializeApp).toHaveBeenCalledTimes(1);
  });
});

describe('consumeGoogleRedirectResult', () => {
  it('returns the ID token after a redirect round trip', async () => {
    const mod = await loadModule(true);
    getRedirectResult.mockResolvedValue({ user: { getIdToken: async () => 'id-token-2' } });
    await expect(mod.consumeGoogleRedirectResult()).resolves.toBe('id-token-2');
  });

  it('returns null on a normal page load', async () => {
    const mod = await loadModule(true);
    getRedirectResult.mockResolvedValue(null);
    await expect(mod.consumeGoogleRedirectResult()).resolves.toBeNull();
  });
});

describe('signOutOfGoogle (WB-085)', () => {
  it('ends the Firebase session so the Google user does not outlive the panel session', async () => {
    const mod = await loadModule(true);
    firebaseSignOut.mockResolvedValue(undefined);
    await mod.signOutOfGoogle();
    expect(firebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('never throws, even when Firebase fails', async () => {
    const mod = await loadModule(true);
    firebaseSignOut.mockRejectedValue(new Error('indexeddb gone'));
    await expect(mod.signOutOfGoogle()).resolves.toBeUndefined();
  });

  it('loads nothing when Google sign-in is not configured', async () => {
    const mod = await loadModule(false);
    await mod.signOutOfGoogle();
    expect(firebaseSignOut).not.toHaveBeenCalled();
  });
});
