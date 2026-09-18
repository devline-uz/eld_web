// owner: web-auth-rbac — the behaviour of the layer that decides who gets in (web/tz.md
// §6.5–§6.9, §17). MSW only: the live API throttles POST /auth/login to 5 requests per 60 s.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { client, resetAuthBridge } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import { ApiError } from '@/shared/api/errors';
import {
  AuthProvider,
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  REFRESH_RETRY_DELAYS_MS,
  samePermissions,
  useAuth,
} from './AuthProvider';
import {
  disconnectSockets,
  notifySessionExpired,
  refreshAccessToken,
  registerSocketDisconnect,
} from './authEvents';
import type * as FirebaseModule from './firebase';
import { clearTokens, getAccessToken, getRefreshToken } from './tokenStore';

const signOutOfGoogle = vi.fn(() => Promise.resolve());
vi.mock('./firebase', async (importOriginal) => ({
  ...(await importOriginal<typeof FirebaseModule>()),
  signOutOfGoogle: () => signOutOfGoogle(),
}));

const RT_KEY = 'obk.rt';
const PAIR = { accessToken: 'access-1', refreshToken: 'refresh-1', tokenType: 'Bearer' };
const ROTATED = { accessToken: 'access-2', refreshToken: 'refresh-2', tokenType: 'Bearer' };
const ME_DISPATCHER = {
  id: 'usr_disp',
  type: 'user',
  role: 'DISPATCHER',
  permissions: { dashboard: 'FULL', trips: 'FULL', vehicles: 'READ', hosEdit: 'NONE' },
};

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  // The token store is module state: without this a later test would inherit the previous
  // test's in-memory access token.
  clearTokens();
});

/** Renders the provider with a probe that exposes the context and drives its actions. */
function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const clearSpy = vi.spyOn(queryClient, 'clear');
  const actions: Record<string, (...args: never[]) => unknown> = {};
  let snapshot: ReturnType<typeof useAuth> | null = null;

  function Probe() {
    const auth = useAuth();
    snapshot = auth;
    actions.signInWithPassword = auth.signInWithPassword as never;
    actions.signInWithGoogleToken = auth.signInWithGoogleToken as never;
    actions.signOut = auth.signOut as never;
    return (
      <div>
        <span data-testid="status">{auth.status}</span>
        <span data-testid="role">{auth.user?.role ?? '—'}</span>
        <span data-testid="trips">{auth.permissions.trips}</span>
        <span data-testid="hosEdit">{auth.permissions.hosEdit}</span>
      </div>
    );
  }

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );

  return {
    ...utils,
    clearSpy,
    queryClient,
    get auth() {
      return snapshot!;
    },
    signInWithPassword: (email: string, password: string) =>
      (actions.signInWithPassword as unknown as (e: string, p: string) => Promise<unknown>)(
        email,
        password,
      ),
    signInWithGoogleToken: (token: string) =>
      (actions.signInWithGoogleToken as unknown as (t: string) => Promise<unknown>)(token),
    signOut: () => (actions.signOut as unknown as () => void)(),
  };
}

const status = () => screen.getByTestId('status').textContent;

/* --------------------------------------------------------------- boot: refresh → /auth/me */

describe('cold boot', () => {
  it('with no refresh token it never calls the API and reports unauthenticated', async () => {
    let calls = 0;
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        calls += 1;
        return ok(PAIR);
      }),
    );
    setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(calls).toBe(0);
  });

  it('shows a full-page skeleton, not a spinner, while refresh → me runs', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    server.use(
      http.post(url(endpoints.auth.refresh), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    setup();
    expect(screen.getByText('Signing you in')).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    await waitFor(() => expect(status()).toBe('authenticated'));
  });

  it('refresh → GET /auth/me hydrates role and permissions from /auth/me alone', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    const seen: string[] = [];
    server.use(
      http.post(url(endpoints.auth.refresh), () => ok(ROTATED)),
      http.get(url(endpoints.auth.me), ({ request }) => {
        seen.push(request.headers.get('authorization') ?? '');
        return ok(ME_DISPATCHER);
      }),
    );
    setup();

    await waitFor(() => expect(status()).toBe('authenticated'));
    expect(screen.getByTestId('role').textContent).toBe('DISPATCHER');
    expect(screen.getByTestId('trips').textContent).toBe('FULL');
    expect(screen.getByTestId('hosEdit').textContent).toBe('NONE');
    // The rotated pair replaced the stored one, and /auth/me used the fresh access token.
    expect(seen[0]).toBe('Bearer access-2');
    expect(getRefreshToken()).toBe('refresh-2');
  });

  it('a key /auth/me did not send stays NONE — a permission is never assumed', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    server.use(
      http.post(url(endpoints.auth.refresh), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () =>
        ok({ ...ME_DISPATCHER, permissions: { dashboard: 'FULL' } }),
      ),
    );
    setup();
    await waitFor(() => expect(status()).toBe('authenticated'));
    expect(screen.getByTestId('trips').textContent).toBe('NONE');
  });

  it('a failed refresh clears obk.rt and reports the session as expired (§6.2 rule 3)', async () => {
    window.localStorage.setItem(RT_KEY, 'stale');
    server.use(
      http.post(url(endpoints.auth.refresh), () =>
        fail(401, 'REFRESH_TOKEN_REUSED', 'This refresh token was already rotated.'),
      ),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
    // W-00 renders `Your session has expired. Sign in again.` off this (WD-015).
    expect(view.auth.sessionEndedReason).toBe('expired');
  });

  it('a failed /auth/me after a good refresh also ends the session', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    server.use(
      http.post(url(endpoints.auth.refresh), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => fail(401, 'TOKEN_INVALID', 'No.')),
    );
    setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(window.localStorage.getItem(RT_KEY)).toBeNull();
  });

  it('a 403 on /auth/me ends the session — there is no lock state to fall into', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    server.use(
      http.post(url(endpoints.auth.refresh), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => fail(403, 'FORBIDDEN', 'Insufficient permissions.')),
    );
    setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(window.localStorage.getItem(RT_KEY)).toBeNull();
  });
});

/* ------------------------------------------ boot from the session snapshot (WD-072) */

describe('boot from the session snapshot (WD-072)', () => {
  const SNAP_KEY = 'obk.session';
  const snapshotOf = (me: unknown) =>
    JSON.stringify({ me, accessTokenExpiresAt: Date.now() + 10 * 60_000 });

  it('renders children at once from the snapshot, then reconciles with /auth/me', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    window.sessionStorage.setItem(SNAP_KEY, snapshotOf(ME_DISPATCHER));
    let refreshResolve: (() => void) | null = null;
    server.use(
      http.post(url(endpoints.auth.refresh), async () => {
        await new Promise<void>((resolve) => {
          refreshResolve = resolve;
        });
        return ok(ROTATED);
      }),
      // The server has since downgraded `trips` — the snapshot must not win.
      http.get(url(endpoints.auth.me), () =>
        ok({ ...ME_DISPATCHER, permissions: { ...ME_DISPATCHER.permissions, trips: 'READ' } }),
      ),
    );
    setup();

    // No skeleton, no waiting: the very first render is the app with the snapshot's session.
    expect(status()).toBe('authenticated');
    expect(screen.queryByText('Signing you in')).not.toBeInTheDocument();
    expect(screen.getByTestId('role').textContent).toBe('DISPATCHER');
    expect(screen.getByTestId('trips').textContent).toBe('FULL');
    expect(getAccessToken()).toBeNull(); // the access token is never in the snapshot

    await waitFor(() => expect(refreshResolve).not.toBeNull());
    await act(async () => {
      refreshResolve!();
    });
    await waitFor(() => expect(screen.getByTestId('trips').textContent).toBe('READ'));
    expect(status()).toBe('authenticated');
    expect(getAccessToken()).toBe('access-2');
    expect(getRefreshToken()).toBe('refresh-2');
    // The reconciled payload replaced the snapshot.
    const stored = JSON.parse(window.sessionStorage.getItem(SNAP_KEY) ?? '{}');
    expect(stored.me.permissions.trips).toBe('READ');
    expect(JSON.stringify(stored)).not.toMatch(/access-2|refresh-2/);
  });

  it('a data request issued during boot waits for the one in-flight refresh', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    window.sessionStorage.setItem(SNAP_KEY, snapshotOf(ME_DISPATCHER));
    let refreshes = 0;
    const authHeaders: Array<string | null> = [];
    server.use(
      http.post(url(endpoints.auth.refresh), async () => {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return ok(ROTATED);
      }),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.get(url(endpoints.vehicles.list), ({ request }) => {
        authHeaders.push(request.headers.get('authorization'));
        return ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 0 });
      }),
    );
    setup();
    expect(status()).toBe('authenticated');

    // Fired the way a screen's useQuery would — before the boot refresh has resolved.
    const results = await act(async () =>
      Promise.all([client.get(endpoints.vehicles.list), client.get(endpoints.vehicles.list)]),
    );
    expect(results).toHaveLength(2);
    expect(authHeaders).toEqual(['Bearer access-2', 'Bearer access-2']);
    await waitFor(() => expect(getRefreshToken()).toBe('refresh-2'));
    // Boot + two parked requests = exactly one POST /auth/refresh (REFRESH_TOKEN_REUSED otherwise).
    expect(refreshes).toBe(1);
  });

  it('a failed background refresh signs the user out and drops the snapshot', async () => {
    window.localStorage.setItem(RT_KEY, 'stale');
    window.sessionStorage.setItem(SNAP_KEY, snapshotOf(ME_DISPATCHER));
    server.use(
      http.post(url(endpoints.auth.refresh), () =>
        fail(401, 'REFRESH_TOKEN_REUSED', 'This refresh token was already rotated.'),
      ),
    );
    const view = setup();
    expect(status()).toBe('authenticated');
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(view.auth.sessionEndedReason).toBe('expired');
    expect(getRefreshToken()).toBeNull();
    expect(window.sessionStorage.getItem(SNAP_KEY)).toBeNull();
    expect(screen.getByTestId('trips').textContent).toBe('NONE');
    expect(view.clearSpy).toHaveBeenCalled();
  });

  it('a snapshot without a refresh token is ignored — no API call, unauthenticated', async () => {
    window.sessionStorage.setItem(SNAP_KEY, snapshotOf(ME_DISPATCHER));
    let calls = 0;
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        calls += 1;
        return ok(PAIR);
      }),
    );
    setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(calls).toBe(0);
  });

  it('sign-in writes the snapshot and sign-out clears it', async () => {
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.post(url(endpoints.auth.signOut), () => ok({ success: true })),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });
    const raw = window.sessionStorage.getItem(SNAP_KEY) ?? '';
    expect(JSON.parse(raw).me.id).toBe('usr_disp');
    expect(raw).not.toMatch(/access-1|refresh-1/);

    await act(async () => {
      view.signOut();
    });
    expect(window.sessionStorage.getItem(SNAP_KEY)).toBeNull();
  });
});

/* ------------------------------------------------------------------------- sign-in flows */

describe('password sign-in (dev mode only, Q-1)', () => {
  it('stores the pair, hydrates from /auth/me and reports authenticated', async () => {
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));

    await act(async () => {
      await view.signInWithPassword('carlos.ramirez@universal-logistics.example', 'Onebook2026');
    });

    expect(status()).toBe('authenticated');
    expect(getAccessToken()).toBe('access-1');
    expect(window.localStorage.getItem(RT_KEY)).toBe('refresh-1');
    expect(screen.getByTestId('role').textContent).toBe('DISPATCHER');
  });

  it('rejects with the ApiError so W-00 can render its own banner', async () => {
    server.use(
      http.post(url(endpoints.auth.signIn), () =>
        fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.'),
      ),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));

    const error = await view.signInWithPassword('a@b.example', 'wrong').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('INVALID_CREDENTIALS');
    expect(status()).toBe('unauthenticated');
    expect(window.localStorage.getItem(RT_KEY)).toBeNull();
  });
});

describe('Google sign-in', () => {
  it('exchanges the ID token and signs in', async () => {
    server.use(
      http.post(url(endpoints.auth.google), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithGoogleToken('google-id-token');
    });
    expect(status()).toBe('authenticated');
  });

  it('USER_NOT_INVITED does not create a user and leaves the app signed out', async () => {
    server.use(
      http.post(url(endpoints.auth.google), () =>
        fail(403, 'USER_NOT_INVITED', 'Google Sign-In never auto-registers.'),
      ),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    const error = (await view.signInWithGoogleToken('t').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('USER_NOT_INVITED');
    expect(status()).toBe('unauthenticated');
    expect(getAccessToken()).toBeNull();
  });

  it('EMAIL_NOT_VERIFIED reaches the screen with its own code', async () => {
    server.use(
      http.post(url(endpoints.auth.google), () =>
        fail(403, 'EMAIL_NOT_VERIFIED', 'Verify your Google email address first.'),
      ),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    const error = (await view.signInWithGoogleToken('t').catch((e: unknown) => e)) as ApiError;
    expect(error.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

/* ------------------------------------------------------------------- refresh and sign-out */

describe('refresh', () => {
  it('refreshes proactively 60 s before the access token expires', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return ok({ accessToken: `access-${refreshes}`, refreshToken: `refresh-${refreshes}` });
      }),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await waitFor(() => expect(status()).toBe('authenticated'));
    expect(refreshes).toBe(1); // the boot refresh

    // Nothing happens until the 15 min token is 60 s from expiry.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13 * 60_000);
    });
    expect(refreshes).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000);
    });
    expect(refreshes).toBeGreaterThanOrEqual(2);
    expect(getRefreshToken()).not.toBe('refresh-0');
  });

  it('schedules the proactive refresh from the server expiresIn, not a 15-minute guess (WB-083)', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return ok({
          accessToken: `access-${refreshes}`,
          refreshToken: `refresh-${refreshes}`,
          expiresIn: 300,
        });
      }),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await waitFor(() => expect(status()).toBe('authenticated'));
    expect(refreshes).toBe(1);

    // A 5-minute token renews 60 s early: at ~4 min, not at ~14.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 60_000 + 50_000);
    });
    expect(refreshes).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refreshes).toBe(2);
    expect(JSON.parse(window.sessionStorage.getItem('obk.session') ?? '{}').accessTokenExpiresAt)
      .toBeLessThanOrEqual(Date.now() + 5 * 60_000 + 1_000);
  });

  it('sign-in honours the expiresIn of the issued pair too (WB-083)', async () => {
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok({ ...PAIR, expiresIn: 180 })),
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return ok({ ...ROTATED, expiresIn: 180 });
      }),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000 + 10_000);
    });
    expect(refreshes).toBe(1);
  });

  it('is single-flight: parallel callers share one POST /auth/refresh', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.refresh), async () => {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return ok(ROTATED);
      }),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    setup();
    await waitFor(() => expect(status()).toBe('authenticated'));
    const afterBoot = refreshes;

    // Four 401s at once (§6.2 rule 2) must produce exactly one network refresh.
    const tokens = await act(async () =>
      Promise.all([
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
        refreshAccessToken(),
      ]),
    );
    expect(refreshes).toBe(afterBoot + 1);
    expect(new Set(tokens)).toEqual(new Set(['access-2']));
  });

  it('a refresh that fails mid-session signs the user out', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    let first = true;
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        if (first) {
          first = false;
          return ok(PAIR);
        }
        return fail(401, 'REFRESH_TOKEN_REUSED', 'Already rotated.');
      }),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await waitFor(() => expect(status()).toBe('authenticated'));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60_000);
    });
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(getRefreshToken()).toBeNull();
  });
});

describe('sign-out (§17)', () => {
  it('clears both tokens, clears the query cache and disconnects the socket', async () => {
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.post(url(endpoints.auth.signOut), () => ok({ success: true })),
    );
    const socket = vi.fn();
    const unregister = registerSocketDisconnect(socket);
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });
    expect(status()).toBe('authenticated');

    await act(async () => {
      view.signOut();
    });

    expect(status()).toBe('unauthenticated');
    // A deliberate sign-out is not an expiry — W-00 shows no banner for it.
    expect(view.auth.sessionEndedReason).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(RT_KEY)).toBeNull();
    expect(view.clearSpy).toHaveBeenCalled();
    expect(socket).toHaveBeenCalled();
    expect(screen.getByTestId('trips').textContent).toBe('NONE');
    unregister();
    disconnectSockets();
    expect(socket).toHaveBeenCalledTimes(1);
  });

  it('ends the Firebase Google session with the panel session (WB-085)', async () => {
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.post(url(endpoints.auth.signOut), () => ok({ success: true })),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });
    signOutOfGoogle.mockClear();
    act(() => view.signOut());
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(signOutOfGoogle).toHaveBeenCalledTimes(1);
  });

  it('tells the backend to revoke the session', async () => {
    const revoked: unknown[] = [];
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.post(url(endpoints.auth.signOut), async ({ request }) => {
        revoked.push(await request.json());
        return ok({ success: true });
      }),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });
    await act(async () => {
      view.signOut();
    });
    await waitFor(() => expect(revoked).toEqual([{ refreshToken: 'refresh-1' }]));
  });

  it('a sign-out whose logout call fails still ends the local session', async () => {
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.post(url(endpoints.auth.signOut), () => fail(500, 'INTERNAL_ERROR', 'boom')),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });
    await act(async () => {
      view.signOut();
    });
    expect(status()).toBe('unauthenticated');
    expect(window.localStorage.getItem(RT_KEY)).toBeNull();
  });
});

/* -------------------------------------------------------------------- the client.ts seam */

describe('sign-out racing an in-flight refresh (WB-079)', () => {
  /** Signs in (refresh-1), then holds the next POST /auth/refresh until the test releases it. */
  async function signedInWithHeldRefresh() {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    let refreshes = 0;
    const revoked: unknown[] = [];
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.post(url(endpoints.auth.refresh), async () => {
        refreshes += 1;
        await gate;
        return ok(ROTATED);
      }),
      http.post(url(endpoints.auth.signOut), async ({ request }) => {
        revoked.push(await request.json());
        return ok({ success: true });
      }),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });
    expect(status()).toBe('authenticated');
    return { view, release, revoked, refreshes: () => refreshes };
  }

  it('a refresh that resolves after sign-out leaves no token behind and revokes the rotated one', async () => {
    const { view, release, revoked, refreshes } = await signedInWithHeldRefresh();

    const inFlight = refreshAccessToken();
    await waitFor(() => expect(refreshes()).toBe(1));
    await act(async () => {
      view.signOut();
    });
    await act(async () => {
      release();
      await inFlight;
    });

    expect(status()).toBe('unauthenticated');
    expect(window.localStorage.getItem(RT_KEY)).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getAccessToken()).toBeNull();
    // A deliberate sign-out stays deliberate: the late response does not relabel it `expired`.
    expect(view.auth.sessionEndedReason).toBeNull();
    // Both the token signed out with and the one the in-flight refresh minted are revoked.
    await waitFor(() =>
      expect(revoked).toEqual(
        expect.arrayContaining([{ refreshToken: 'refresh-1' }, { refreshToken: 'refresh-2' }]),
      ),
    );
  });

  it('a request replaying a 401 through the refresh cannot resurrect the session', async () => {
    const { view, release, refreshes } = await signedInWithHeldRefresh();
    server.use(
      http.get(url(endpoints.vehicles.list), () => fail(401, 'TOKEN_EXPIRED', 'Token expired.')),
    );

    const request = client.get(endpoints.vehicles.list).catch((e: unknown) => e);
    await waitFor(() => expect(refreshes()).toBe(1));
    await act(async () => {
      view.signOut();
    });
    await act(async () => {
      release();
      await request;
    });

    expect(window.localStorage.getItem(RT_KEY)).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(status()).toBe('unauthenticated');
  });
});

describe('a refresh that fails in transit keeps the session (WB-080)', () => {
  const SNAP_KEY = 'obk.session';

  it('a network blip on the proactive refresh retries and never touches obk.rt', async () => {
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return refreshes <= 2 ? HttpResponse.error() : ok(ROTATED);
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });

    // The proactive timer fires at minute 14 into a dead network.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(14 * 60_000 + 1_000);
    });
    expect(refreshes).toBe(1);
    expect(status()).toBe('authenticated');
    expect(getRefreshToken()).toBe('refresh-1');
    expect(view.clearSpy).not.toHaveBeenCalled();

    // Backoff: a second failed attempt, then the network is back.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_RETRY_DELAYS_MS[0] + REFRESH_RETRY_DELAYS_MS[1]);
    });
    await waitFor(() => expect(getRefreshToken()).toBe('refresh-2'));
    expect(refreshes).toBe(3);
    expect(status()).toBe('authenticated');
    expect(getAccessToken()).toBe('access-2');
    expect(view.auth.sessionEndedReason).toBeNull();
  });

  it('a 5xx on the boot refresh keeps the snapshot session and recovers', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    window.sessionStorage.setItem(
      SNAP_KEY,
      JSON.stringify({ me: ME_DISPATCHER, accessTokenExpiresAt: Date.now() + 10 * 60_000 }),
    );
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return refreshes === 1 ? fail(503, 'SERVICE_UNAVAILABLE', 'Down.') : ok(ROTATED);
      }),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = setup();
    await waitFor(() => expect(refreshes).toBe(1));
    expect(status()).toBe('authenticated');
    expect(getRefreshToken()).toBe('refresh-0');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_RETRY_DELAYS_MS[0]);
    });
    await waitFor(() => expect(getRefreshToken()).toBe('refresh-2'));
    expect(status()).toBe('authenticated');
    expect(view.clearSpy).not.toHaveBeenCalled();
  });

  it('a cold boot into a dead network waits behind the skeleton instead of signing out', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return refreshes === 1 ? HttpResponse.error() : ok(ROTATED);
      }),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await waitFor(() => expect(refreshes).toBe(1));
    expect(screen.getByText('Signing you in')).toBeInTheDocument();
    expect(getRefreshToken()).toBe('refresh-0');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_RETRY_DELAYS_MS[0]);
    });
    await waitFor(() => expect(status()).toBe('authenticated'));
    expect(getRefreshToken()).toBe('refresh-2');
  });

  it('a transient failure followed by a 401 still ends the session as expired', async () => {
    let refreshes = 0;
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.post(url(endpoints.auth.refresh), () => {
        refreshes += 1;
        return refreshes === 1
          ? HttpResponse.error()
          : fail(401, 'REFRESH_TOKEN_REUSED', 'Already rotated.');
      }),
    );
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(14 * 60_000 + 1_000 + REFRESH_RETRY_DELAYS_MS[0]);
    });
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(refreshes).toBe(2);
    expect(getRefreshToken()).toBeNull();
    expect(view.auth.sessionEndedReason).toBe('expired');
  });
});

describe('the seam other modules plug into', () => {
  it('notifySessionExpired() from client.ts ends the session', async () => {
    window.localStorage.setItem(RT_KEY, 'refresh-0');
    server.use(
      http.post(url(endpoints.auth.refresh), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
    );
    setup();
    await waitFor(() => expect(status()).toBe('authenticated'));
    await act(async () => {
      notifySessionExpired();
    });
    expect(status()).toBe('unauthenticated');
  });

  it('useAuth() outside the provider is a developer error, not a silent null', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Orphan() {
      useAuth();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/useAuth must be used inside/);
    spy.mockRestore();
  });
});

/* ------------------------------------------------------------------------ idle timeout */

describe('30-minute idle timeout (§17)', () => {
  async function signedIn() {
    server.use(
      http.post(url(endpoints.auth.signIn), () => ok(PAIR)),
      http.get(url(endpoints.auth.me), () => ok(ME_DISPATCHER)),
      http.post(url(endpoints.auth.signOut), () => ok({ success: true })),
    );
    const view = setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await view.signInWithPassword('a@b.example', 'pw');
    });
    return view;
  }

  it('warns after 30 minutes and signs out 60 seconds later', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const view = await signedIn();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 1_000);
    });
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(screen.getByText('Still there?')).toBeInTheDocument();
    expect(screen.getByText(/signed out in/)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_WARNING_MS + 1_000);
    });
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(window.localStorage.getItem(RT_KEY)).toBeNull();
    expect(view.auth.sessionEndedReason).toBe('idle');
  });

  it('activity before the 30 minutes are up rearms the clock', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signedIn();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 60_000);
    });
    await act(async () => {
      window.dispatchEvent(new Event('keydown'));
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 60_000);
    });
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();
    expect(status()).toBe('authenticated');
  });

  it('`Stay signed in` dismisses the modal and keeps the session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await signedIn();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS + 1_000);
    });
    expect(screen.getByText('Still there?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();
    expect(status()).toBe('authenticated');
  });

  it('Escape on the warning is not "I am here" — it ends the session (WB-084)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const view = await signedIn();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS + 1_000);
    });
    expect(screen.getByText('Still there?')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();
    expect(view.auth.sessionEndedReason).toBe('idle');
    expect(window.localStorage.getItem(RT_KEY)).toBeNull();
  });

  it('`Stay signed in` arms a fresh 30 minutes (WB-036)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await signedIn();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS + 1_000);
    });
    await user.click(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS - 5_000);
    });
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText('Still there?')).toBeInTheDocument();
  });

  it('activity behind the open warning does not dismiss or reset it', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signedIn();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS + 1_000);
    });
    await act(async () => {
      window.dispatchEvent(new Event('keydown'));
      await vi.advanceTimersByTimeAsync(IDLE_WARNING_MS + 1_000);
    });
    await waitFor(() => expect(status()).toBe('unauthenticated'));
  });

  it('`Sign out` in the modal ends the session immediately', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await signedIn();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS + 1_000);
    });
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(status()).toBe('unauthenticated'));
  });

  it('no idle timer runs while signed out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setup();
    await waitFor(() => expect(status()).toBe('unauthenticated'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS + IDLE_WARNING_MS + 5_000);
    });
    expect(screen.queryByText('Still there?')).not.toBeInTheDocument();
  });
});

describe('samePermissions', () => {
  it('compares every key in both directions', () => {
    const a = { dashboard: 'FULL', trips: 'READ' } as never;
    expect(samePermissions(a, { dashboard: 'FULL', trips: 'READ' } as never)).toBe(true);
    expect(samePermissions(a, { dashboard: 'FULL', trips: 'FULL' } as never)).toBe(false);
    expect(samePermissions(a, { dashboard: 'FULL' } as never)).toBe(false);
    expect(samePermissions({ dashboard: 'FULL' } as never, a)).toBe(false);
  });
});
