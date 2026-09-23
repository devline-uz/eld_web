// owner: web-auth-rbac — W-00 Sign in (web/tz.md §10 W-00, §6.5–§6.7, customer decision Q-1).
//
// Production has exactly one way in: Continue with Google. `Forgot password?`,
// `Keep me signed in` and `Continue with SAML single sign-on` from the design are removed —
// W-00c is not built at all. The email + password form exists only in a dev build.
//
// 📐 The §10 entry points at `.tmp_docimg/shared-login.png`, which is not in the repo, and the
// file called `Sign in — split brand panel with SSO.jpg` actually draws 11.1 Create a geofence
// (§11 warns the names are scrambled). Every string below therefore comes from §10 W-00 prose.
import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { errorMessage } from '@/shared/api/errors';
import { useAuth } from '@/shared/auth/AuthProvider';
import {
  GoogleSignInError,
  consumeGoogleRedirectResult,
  signInWithGoogle,
} from '@/shared/auth/firebase';
import {
  forgetReturnPath,
  readRememberedReturnPath,
  rememberReturnPath,
  safeReturnPath,
} from '@/shared/auth/returnTo';
import { Button } from '@/shared/ui/Button';
import { DeveloperSignIn } from './DeveloperSignIn';
import { GoogleLogo } from './GoogleLogo';

/** Vite inlines this literal, so the dev branch below disappears from a production build. */
const IS_DEV_AUTH = import.meta.env.VITE_AUTH_MODE === 'dev';

/**
 * The shape every rejected auth call has, whether it came from `authApi` or from the shared
 * client. Matching on `status`/`code` rather than on `instanceof` keeps the banner correct even
 * when the error crossed a module boundary (two bundles, a lazy chunk, a test registry).
 */
function asApiFailure(
  error: unknown,
): { status: number; code: string; userMessage?: string } | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { status?: unknown; code?: unknown; userMessage?: unknown };
  if (typeof candidate.status !== 'number' || typeof candidate.code !== 'string') return null;
  return {
    status: candidate.status,
    code: candidate.code,
    userMessage: typeof candidate.userMessage === 'string' ? candidate.userMessage : undefined,
  };
}

/** W-00 error table — a 403 gets its own sentence, never the generic one. */
function signInErrorMessage(cause: unknown): string | null {
  if (cause instanceof GoogleSignInError) return cause.message;
  const error = asApiFailure(cause);
  if (error) {
    if (error.status === 403 && error.code === 'USER_NOT_INVITED') {
      return 'This Google account is not invited to the panel. Ask an administrator for an invitation.';
    }
    if (error.status === 403 && error.code === 'EMAIL_NOT_VERIFIED') {
      return 'Verify your Google email address first.';
    }
    if (error.status === 403 && error.code === 'USER_DISABLED') {
      return 'This account has been disabled. Contact your administrator.';
    }
    if (error.status === 403 && error.code === 'PASSWORD_LOGIN_DISABLED') {
      return 'Password sign-in is disabled. Use Continue with Google.';
    }
    if (error.status === 429) return 'Too many attempts. Try again in a minute.';
    if (error.status === 401 && error.code === 'INVALID_CREDENTIALS') {
      return 'Incorrect email or password.';
    }
    if (error.status === 401) return 'Google sign-in failed. Try again.';
    return error.userMessage ?? errorMessage(error.code);
  }
  return 'Could not reach Google. Check your connection.';
}

const REASON_BANNER: Record<string, string> = {
  expired: 'Your session has expired. Sign in again.',
  idle: 'You were signed out after 30 minutes of inactivity.',
};

export default function SignInPage() {
  const { isAuthenticated, signInWithGoogleToken, sessionEndedReason } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  // WB-081 — where RequireAuth was sending the user; validated, never an off-origin URL. A
  // Google redirect round trip loses history state, so the stored copy is the fallback.
  const [returnTo] = useState(
    () =>
      safeReturnPath((location.state as { from?: unknown } | null)?.from) ??
      readRememberedReturnPath(),
  );
  // Consumed: the stored copy has done its job once it is in state (an effect, not the
  // initializer, so StrictMode's double initializer call cannot lose it).
  useEffect(() => forgetReturnPath(), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'google' | 'password' | null>(null);

  // The guard redirects to a bare `/sign-in`, so the reason the session ended arrives through
  // the auth context; an explicit `?reason=` (a hard redirect from client.ts) still wins.
  const reason = params.get('reason') ?? sessionEndedReason ?? null;
  const reasonBanner = reason ? (REASON_BANNER[reason] ?? null) : null;

  const exchange = useCallback(
    async (idToken: string) => {
      await signInWithGoogleToken(idToken);
    },
    [signInWithGoogleToken],
  );

  // A `signInWithRedirect` round trip comes back here with a pending Google credential.
  useEffect(() => {
    let cancelled = false;
    void consumeGoogleRedirectResult()
      .then((idToken) => {
        if (!idToken || cancelled) return;
        setBusy('google');
        return exchange(idToken);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(signInErrorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setBusy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [exchange]);

  if (isAuthenticated) return <Navigate to={returnTo ?? '/'} replace />;

  async function onGoogle() {
    setError(null);
    setBusy('google');
    // Stored before the call: a `signInWithRedirect` fallback navigates away and never returns
    // control here, so this is the only moment to keep the destination (WB-081).
    rememberReturnPath(returnTo);
    let redirecting = false;
    try {
      const outcome = await signInWithGoogle();
      // The popup was closed by the user: W-00 says show no banner at all.
      if (outcome.kind === 'cancelled') return;
      // signInWithRedirect took over — the page is navigating away.
      if (outcome.kind === 'redirecting') {
        redirecting = true;
        return;
      }
      await exchange(outcome.idToken);
    } catch (cause) {
      setError(signInErrorMessage(cause));
    } finally {
      // The popup path never left the page: drop the stored copy so it cannot resurface later.
      if (!redirecting) forgetReturnPath();
      setBusy(null);
    }
  }

  return (
    <div className="w-sign-in-card">
      <div className="rounded-xl bg-bg-surface p-8 shadow-card">
        <h1 className="text-page-title text-text">Sign in to your account</h1>
        <p className="mt-1 text-page-sub text-text-muted">
          Back-office access for fleet managers and administrators.
        </p>

        {reasonBanner ? (
          <p className="mt-4 rounded-md bg-warning-soft px-3 py-2 text-caption text-text-secondary">
            {reasonBanner}
          </p>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-caption text-danger"
          >
            {error}
          </p>
        ) : null}

        <Button
          variant="secondary"
          size="lg"
          className="mt-5 w-full"
          loading={busy === 'google'}
          iconLeft={<GoogleLogo />}
          onClick={() => void onGoogle()}
        >
          {busy === 'google' ? 'Signing in…' : 'Continue with Google'}
        </Button>

        <p className="mt-3 text-center text-caption text-text-muted">
          Access is granted by invitation. Ask your administrator to invite your work Google
          account.
        </p>

        {IS_DEV_AUTH ? (
          <DevBlock busy={busy === 'password'} setBusy={setBusy} setError={setError} />
        ) : null}

        <hr className="mt-6 border-border" />
        <p className="mt-3 text-center text-caption text-text-muted">
          Drivers should use the OneBook ELD mobile app, not this portal.
        </p>
      </div>

      <p className="mt-4 text-center text-caption text-text-muted">
        © 2025 OneBook ELD · Privacy Policy · Terms of Use · FMCSA registration #ONEB01
      </p>
    </div>
  );
}

/** Dev-only wrapper: keeps every password concern inside the tree-shaken branch. */
function DevBlock({
  busy,
  setBusy,
  setError,
}: {
  busy: boolean;
  setBusy: (value: 'google' | 'password' | null) => void;
  setError: (value: string | null) => void;
}) {
  const { signInWithPassword } = useAuth();

  return (
    <DeveloperSignIn
      busy={busy}
      onSubmit={(email, password) => {
        setError(null);
        setBusy('password');
        void signInWithPassword(email, password)
          .catch((cause: unknown) => setError(signInErrorMessage(cause)))
          .finally(() => setBusy(null));
      }}
    />
  );
}
