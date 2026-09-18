// owner: web-auth-rbac — Firebase Google Sign-In (web/tz.md §6.5, Q-1).
//
// The SDK is loaded with a dynamic import inside the click handler, so `firebase/auth` lands in
// its own chunk and never enters the entry bundle (§16.1). Firebase is only ever used to obtain
// a Google ID token; the session itself is the backend's `POST /auth/google` response.
//
// In dev the VITE_FIREBASE_* values are empty: `isGoogleSignInConfigured()` is false and the
// button explains itself instead of throwing.

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
};

export function isGoogleSignInConfigured(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.authDomain && FIREBASE_CONFIG.projectId);
}

/** A Firebase failure the sign-in card must show as its own sentence (W-00 error table). */
export class GoogleSignInError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'GoogleSignInError';
    this.code = code;
  }
}

/** The user closed the popup — W-00 says show no banner at all. */
export const GOOGLE_SIGN_IN_CANCELLED = 'auth/popup-closed-by-user';
/** The flow left the page: `signInWithRedirect` is in progress, there is nothing to render. */
export const GOOGLE_SIGN_IN_REDIRECTING = 'redirecting';

export const GOOGLE_ERROR_COPY: Record<string, string> = {
  'auth/popup-blocked': 'Allow pop-ups for this site to sign in with Google.',
  'auth/network-request-failed': 'Could not reach Google. Check your connection.',
  'auth/unauthorized-domain': 'Google sign-in is not authorised for this domain.',
  'auth/not-configured': 'Google sign-in is not configured in this environment.',
};

export function googleErrorMessage(code: string): string {
  return GOOGLE_ERROR_COPY[code] ?? 'Google sign-in failed. Try again.';
}

async function getFirebaseAuth() {
  const [{ initializeApp, getApps, getApp }, authModule] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
  ]);
  const app = getApps().length ? getApp() : initializeApp(FIREBASE_CONFIG);
  return { auth: authModule.getAuth(app), authModule };
}

export type GoogleSignInOutcome =
  { kind: 'idToken'; idToken: string } | { kind: 'redirecting' } | { kind: 'cancelled' };

/**
 * `signInWithPopup`, falling back to `signInWithRedirect` when the browser blocks the popup.
 * Returns the Google ID token for `POST /auth/google`.
 */
export async function signInWithGoogle(): Promise<GoogleSignInOutcome> {
  if (!isGoogleSignInConfigured()) {
    throw new GoogleSignInError('auth/not-configured', googleErrorMessage('auth/not-configured'));
  }
  const { auth, authModule } = await getFirebaseAuth();
  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const credential = await authModule.signInWithPopup(auth, provider);
    return { kind: 'idToken', idToken: await credential.user.getIdToken() };
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (code === 'auth/popup-blocked') {
      try {
        await authModule.signInWithRedirect(auth, provider);
        return { kind: 'redirecting' };
      } catch {
        throw new GoogleSignInError('auth/popup-blocked', googleErrorMessage('auth/popup-blocked'));
      }
    }
    if (code === GOOGLE_SIGN_IN_CANCELLED || code === 'auth/cancelled-popup-request') {
      return { kind: 'cancelled' };
    }
    throw new GoogleSignInError(code, googleErrorMessage(code));
  }
}

/** After a `signInWithRedirect` round trip: the ID token, or null if this was a normal load. */
export async function consumeGoogleRedirectResult(): Promise<string | null> {
  if (!isGoogleSignInConfigured()) return null;
  const { auth, authModule } = await getFirebaseAuth();
  const result = await authModule.getRedirectResult(auth);
  return result ? await result.user.getIdToken() : null;
}

/**
 * WB-085 — end the Firebase (Google) session with the panel's. Firebase persists its user in
 * IndexedDB, so it would otherwise outlive a sign-out on a shared machine. Best effort: a
 * failure here never blocks the panel sign-out, and nothing is loaded when Google is off.
 */
export async function signOutOfGoogle(): Promise<void> {
  if (!isGoogleSignInConfigured()) return;
  try {
    const { auth, authModule } = await getFirebaseAuth();
    await authModule.signOut(auth);
  } catch {
    /* the panel session is already over; a stale Firebase user is not worth an error */
  }
}
