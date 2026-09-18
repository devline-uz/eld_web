// owner: web-auth-rbac — W-00 Sign in (web/tz.md §10 W-00, §6.6, Q-1).
// The Firebase module is mocked: these tests are about what the card does with each outcome.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/api/errors';
import { GoogleSignInError } from '@/shared/auth/firebase';
import type * as FirebaseModuleNamespace from '@/shared/auth/firebase';
import { RequireAuth } from '@/app/guards';
import SignInPage from './SignInPage';

// The dev block is decided when the module is evaluated — that is what makes it tree-shakeable
// (§6.6). `vi.hoisted` runs before the imports above, so the screen below is the dev build.
// The production build of the same screen is covered by SignInPage.production.test.tsx.
vi.hoisted(() => {
  vi.stubEnv('VITE_AUTH_MODE', 'dev');
});

type FirebaseModule = typeof FirebaseModuleNamespace;

const signInWithGoogle = vi.fn();
const consumeGoogleRedirectResult = vi.fn<() => Promise<string | null>>(async () => null);

vi.mock('@/shared/auth/firebase', async (importOriginal) => {
  const actual = await importOriginal<FirebaseModule>();
  return {
    ...actual,
    signInWithGoogle: (...args: unknown[]) => signInWithGoogle(...args),
    consumeGoogleRedirectResult: () => consumeGoogleRedirectResult(),
  };
});

const auth = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock('@/shared/auth/AuthProvider', () => ({
  useAuth: () => auth.current,
}));

function mockAuth(overrides: Record<string, unknown> = {}) {
  auth.current = {
    isAuthenticated: false,
    signInWithPassword: vi.fn(async () => ({ status: 'authenticated' })),
    signInWithGoogleToken: vi.fn(async () => ({ status: 'authenticated' })),
    ...overrides,
  };
  return auth.current;
}

function renderSignIn(initialEntry = '/sign-in') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/" element={<p>Dashboard</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  signInWithGoogle.mockReset();
  consumeGoogleRedirectResult.mockReset().mockResolvedValue(null);
  mockAuth();
});

describe('W-00 · the card', () => {
  it('leads with Continue with Google and the invitation note', async () => {
    renderSignIn();
    expect(screen.getByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument();
    expect(
      screen.getByText('Back-office access for fleet managers and administrators.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Access is granted by invitation. Ask your administrator to invite your work Google account.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Drivers should use the OneBook ELD mobile app, not this portal.'),
    ).toBeInTheDocument();
  });

  it('has no password recovery, no SAML and no "keep me signed in" (Q-1)', () => {
    renderSignIn();
    expect(screen.queryByText(/Forgot password/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SAML/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Keep me signed in/i)).not.toBeInTheDocument();
  });

  it('sends an already-signed-in visitor to the dashboard', () => {
    mockAuth({ isAuthenticated: true });
    renderSignIn();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('explains an expired session when it arrives with ?reason=expired', () => {
    renderSignIn('/sign-in?reason=expired');
    expect(screen.getByText('Your session has expired. Sign in again.')).toBeInTheDocument();
  });

  it('explains an expired session reported through the auth context (no ?reason in the URL)', () => {
    mockAuth({ sessionEndedReason: 'expired' });
    renderSignIn();
    expect(screen.getByText('Your session has expired. Sign in again.')).toBeInTheDocument();
  });

  it('explains the 30-minute idle sign-out', () => {
    mockAuth({ sessionEndedReason: 'idle' });
    renderSignIn();
    expect(
      screen.getByText('You were signed out after 30 minutes of inactivity.'),
    ).toBeInTheDocument();
  });

  it('ignores an unknown ?reason instead of rendering an empty banner', () => {
    renderSignIn('/sign-in?reason=banana');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('W-00 · the dev block (VITE_AUTH_MODE=dev)', () => {
  it('is collapsed, warns that it is dev-only, and opens on click', async () => {
    const user = userEvent.setup();
    renderSignIn();
    expect(
      screen.getByText('Development mode — password sign-in is disabled in production.'),
    ).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Developer sign-in' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('fills both fields from a demo account link without submitting (§6.7)', async () => {
    const user = userEvent.setup();
    const ctx = mockAuth();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: 'Developer sign-in' }));
    await user.click(screen.getByRole('button', { name: 'dispatcher' }));

    expect(screen.getByLabelText('Email')).toHaveValue(
      'carlos.ramirez@universal-logistics.example',
    );
    expect(screen.getByLabelText('Password')).toHaveValue('Onebook2026');
    expect(ctx.signInWithPassword).not.toHaveBeenCalled();
  });

  it('reveals and hides the password', async () => {
    const user = userEvent.setup();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: 'Developer sign-in' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });

  it('signs in with the typed credentials', async () => {
    const user = userEvent.setup();
    const ctx = mockAuth();
    renderSignIn();
    await user.click(screen.getByRole('button', { name: 'Developer sign-in' }));
    await user.click(screen.getByRole('button', { name: 'admin' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() =>
      expect(ctx.signInWithPassword).toHaveBeenCalledWith(
        'sarah.chen@universal-logistics.example',
        'Onebook2026',
      ),
    );
  });

  it('shows `Incorrect email or password.` for a 401', async () => {
    const user = userEvent.setup();
    mockAuth({
      signInWithPassword: vi.fn(async () => {
        throw new ApiError(401, { code: 'INVALID_CREDENTIALS', message: 'no' });
      }),
    });
    renderSignIn();
    await user.click(screen.getByRole('button', { name: 'Developer sign-in' }));
    await user.click(screen.getByRole('button', { name: 'admin' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  });

  it('shows the Q-1 sentence when the backend has closed password login (B-25)', async () => {
    const user = userEvent.setup();
    mockAuth({
      signInWithPassword: vi.fn(async () => {
        throw new ApiError(403, { code: 'PASSWORD_LOGIN_DISABLED', message: 'no' });
      }),
    });
    renderSignIn();
    await user.click(screen.getByRole('button', { name: 'Developer sign-in' }));
    await user.click(screen.getByRole('button', { name: 'admin' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password sign-in is disabled. Use Continue with Google.',
    );
  });
});

describe('W-00 · the Google path', () => {
  it('exchanges the ID token for a session', async () => {
    const user = userEvent.setup();
    const ctx = mockAuth();
    signInWithGoogle.mockResolvedValue({ kind: 'idToken', idToken: 'id-1' });
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(ctx.signInWithGoogleToken).toHaveBeenCalledWith('id-1'));
  });

  it('shows the USER_NOT_INVITED banner, with no hint of self-registration', async () => {
    const user = userEvent.setup();
    mockAuth({
      signInWithGoogleToken: vi.fn(async () => {
        throw new ApiError(403, { code: 'USER_NOT_INVITED', message: 'no' });
      }),
    });
    signInWithGoogle.mockResolvedValue({ kind: 'idToken', idToken: 'id-1' });
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This Google account is not invited to the panel. Ask an administrator for an invitation.',
    );
    expect(screen.queryByText(/create an account/i)).not.toBeInTheDocument();
  });

  it('shows the EMAIL_NOT_VERIFIED banner', async () => {
    const user = userEvent.setup();
    mockAuth({
      signInWithGoogleToken: vi.fn(async () => {
        throw new ApiError(403, { code: 'EMAIL_NOT_VERIFIED', message: 'no' });
      }),
    });
    signInWithGoogle.mockResolvedValue({ kind: 'idToken', idToken: 'id-1' });
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Verify your Google email address first.',
    );
  });

  it('shows the disabled-account banner for USER_DISABLED', async () => {
    const user = userEvent.setup();
    mockAuth({
      signInWithGoogleToken: vi.fn(async () => {
        throw new ApiError(403, { code: 'USER_DISABLED', message: 'no' });
      }),
    });
    signInWithGoogle.mockResolvedValue({ kind: 'idToken', idToken: 'id-1' });
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account has been disabled. Contact your administrator.',
    );
  });

  it('throttling says to wait a minute', async () => {
    const user = userEvent.setup();
    mockAuth({
      signInWithGoogleToken: vi.fn(async () => {
        throw new ApiError(429, { code: 'RATE_LIMITED', message: 'no' });
      }),
    });
    signInWithGoogle.mockResolvedValue({ kind: 'idToken', idToken: 'id-1' });
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts. Try again in a minute.',
    );
  });

  it('a closed popup shows no banner at all', async () => {
    const user = userEvent.setup();
    signInWithGoogle.mockResolvedValue({ kind: 'cancelled' });
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeEnabled(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a blocked popup that fell back to redirect shows no banner either', async () => {
    const user = userEvent.setup();
    const ctx = mockAuth();
    signInWithGoogle.mockResolvedValue({ kind: 'redirecting' });
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(ctx.signInWithGoogleToken).not.toHaveBeenCalled();
  });

  it('surfaces a Firebase failure verbatim', async () => {
    const user = userEvent.setup();
    signInWithGoogle.mockRejectedValue(
      new GoogleSignInError(
        'auth/popup-blocked',
        'Allow pop-ups for this site to sign in with Google.',
      ),
    );
    renderSignIn();
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Allow pop-ups for this site to sign in with Google.',
    );
  });

  it('completes a signInWithRedirect round trip on load', async () => {
    const ctx = mockAuth();
    consumeGoogleRedirectResult.mockResolvedValue('id-after-redirect');
    renderSignIn();
    await waitFor(() =>
      expect(ctx.signInWithGoogleToken).toHaveBeenCalledWith('id-after-redirect'),
    );
  });
});

describe('W-00 · back to the deep link after sign-in (WB-081)', () => {
  beforeEach(() => window.sessionStorage.clear());

  function Where() {
    const location = useLocation();
    return <p data-testid="where">{location.pathname + location.search + location.hash}</p>;
  }
  function tree(entry: string | { pathname: string; state?: unknown }) {
    return (
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/sign-in" element={<SignInPage />} />
          <Route element={<RequireAuth />}>
            <Route path="*" element={<Where />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  }
  const renderGuarded = (entry: string | { pathname: string; state?: unknown }) =>
    render(tree(entry));

  it('an emailed link opened while signed out lands there after sign-in', async () => {
    const entry = '/hos-logs?driverId=d_1&date=2026-09-01#violations';
    mockAuth({ status: 'unauthenticated' });
    const view = renderGuarded(entry);
    expect(screen.getByRole('heading', { name: 'Sign in to your account' })).toBeInTheDocument();

    // Same element tree: the MemoryRouter keeps its history, only the session changes.
    mockAuth({ status: 'authenticated', isAuthenticated: true });
    view.rerender(tree(entry));
    expect(await screen.findByTestId('where')).toHaveTextContent(entry);
  });

  it('follows the `from` the guard stored, including the hash', async () => {
    mockAuth({ status: 'authenticated', isAuthenticated: true });
    renderGuarded({ pathname: '/sign-in', state: { from: '/account#sessions' } });
    expect(await screen.findByTestId('where')).toHaveTextContent('/account#sessions');
  });

  it.each(['//evil.example/phish', 'https://evil.example/', '/\\evil.example'])(
    'refuses the off-origin `from` %s and goes to the dashboard',
    async (from) => {
      mockAuth({ status: 'authenticated', isAuthenticated: true });
      renderGuarded({ pathname: '/sign-in', state: { from } });
      expect(await screen.findByTestId('where')).toHaveTextContent(/^\/$/);
    },
  );

  it('keeps the destination across the signInWithRedirect fallback', async () => {
    signInWithGoogle.mockResolvedValue({ kind: 'redirecting' });
    const user = userEvent.setup();
    renderGuarded({ pathname: '/sign-in', state: { from: '/vehicles/v_9' } });
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    expect(window.sessionStorage.getItem('obk.returnTo')).toBe('/vehicles/v_9');
  });

  it('a popup sign-in leaves nothing behind in sessionStorage', async () => {
    signInWithGoogle.mockResolvedValue({ kind: 'idToken', idToken: 'google-id-token' });
    const user = userEvent.setup();
    renderGuarded({ pathname: '/sign-in', state: { from: '/vehicles/v_9' } });
    await user.click(screen.getByRole('button', { name: /Continue with Google/ }));
    await waitFor(() => expect(window.sessionStorage.getItem('obk.returnTo')).toBeNull());
  });
});
