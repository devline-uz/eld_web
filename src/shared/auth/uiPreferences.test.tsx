// useUiPreference — saved views / table columns via PUT /me/preferences, localStorage fallback.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fail, ok, url } from '@/mocks/envelope';
import { server } from '@/mocks/server';
import { resetAuthBridge, setAccessToken, setAuthBridge } from '@/shared/api/client';
import { endpoints } from '@/shared/api/endpoints';
import type * as AuthProviderModule from './AuthProvider';
import { buildMockAuthContext } from '../../../tests/fixtures/mockAuth';
import { mergePreference, preferenceStorageKey, useUiPreference } from './uiPreferences';

vi.mock('./AuthProvider', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthProviderModule>()),
  useAuth: () => buildMockAuthContext('ADMIN'),
}));

const USER = 'usr_admin';
type Col = { id: string; visible: boolean };
const COLS: Col[] = [{ id: 'name', visible: true }];

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function api(prefs: Record<string, unknown> | null) {
  const puts: Record<string, unknown>[] = [];
  server.use(
    http.get(url(endpoints.me.preferences), () => (prefs ? ok(prefs) : fail(503, 'UNAVAILABLE', 'down'))),
    http.put(url(endpoints.me.preferences), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      puts.push(body);
      return ok(body);
    }),
  );
  return puts;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
beforeEach(() => {
  localStorage.clear();
  setAuthBridge({ getAccessToken: () => 't' });
  setAccessToken('t');
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

describe('mergePreference', () => {
  it('sets and removes one screen without touching the rest of the row', () => {
    const row = { language: 'en', tableColumns: { drivers: [1] } };
    expect(mergePreference(row, 'tableColumns', 'vehicles', [2])).toEqual({
      language: 'en',
      tableColumns: { drivers: [1], vehicles: [2] },
    });
    expect(mergePreference(row, 'tableColumns', 'drivers', null)).toEqual({ language: 'en', tableColumns: {} });
    expect(mergePreference({}, 'savedViews', 'x', [1])).toEqual({ savedViews: { x: [1] } });
  });
});

describe('useUiPreference', () => {
  it('reads the server entry first', async () => {
    api({ tableColumns: { drivers: COLS } });
    const { result } = renderHook(() => useUiPreference<Col>('tableColumns', 'drivers', []), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.value).toEqual(COLS));
  });

  it('falls back to localStorage, then to the default', async () => {
    api({});
    localStorage.setItem(preferenceStorageKey(USER, 'savedViews', 'trips'), JSON.stringify(['v1']));
    const a = renderHook(() => useUiPreference('savedViews', 'trips', ['d']), { wrapper: wrapper() });
    expect(a.result.current.value).toEqual(['v1']);
    const b = renderHook(() => useUiPreference('savedViews', 'other', ['d']), { wrapper: wrapper() });
    expect(b.result.current.value).toEqual(['d']);
    localStorage.setItem(preferenceStorageKey(USER, 'savedViews', 'bad'), '{not json');
    const c = renderHook(() => useUiPreference('savedViews', 'bad', ['d']), { wrapper: wrapper() });
    expect(c.result.current.value).toEqual(['d']);
  });

  it('writes merged full rows with PUT and mirrors them locally; reset removes the entry', async () => {
    const puts = api({ language: 'en', tableColumns: { vehicles: [1] } });
    const { result } = renderHook(() => useUiPreference<Col>('tableColumns', 'drivers', []), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.value).toEqual([]));
    await waitFor(() => expect(puts).toHaveLength(0));
    // wait until the row is cached
    await new Promise((r) => setTimeout(r, 50));
    await act(() => result.current.setValue(COLS));
    expect(puts.at(-1)).toEqual({ language: 'en', tableColumns: { vehicles: [1], drivers: COLS } });
    expect(JSON.parse(localStorage.getItem(preferenceStorageKey(USER, 'tableColumns', 'drivers'))!)).toEqual(COLS);
    expect(result.current.value).toEqual(COLS);

    await act(() => result.current.reset());
    expect(puts.at(-1)).toEqual({ language: 'en', tableColumns: { vehicles: [1] } });
    expect(localStorage.getItem(preferenceStorageKey(USER, 'tableColumns', 'drivers'))).toBeNull();
    expect(result.current.value).toEqual([]);
  });

  it('never PUTs when the row failed to load; the choice stays local', async () => {
    const puts = api(null);
    const { result } = renderHook(() => useUiPreference<Col>('tableColumns', 'drivers', []), { wrapper: wrapper() });
    await act(() => result.current.setValue(COLS));
    expect(puts).toHaveLength(0);
    expect(result.current.value).toEqual(COLS);
  });

  it('flags a failed server write and keeps the local copy', async () => {
    api({});
    server.use(http.put(url(endpoints.me.preferences), () => fail(503, 'UNAVAILABLE', 'down')));
    const { result } = renderHook(() => useUiPreference<string>('savedViews', 'drivers', []), { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 50));
    await act(() => result.current.setValue(['v']));
    expect(result.current.syncFailed).toBe(true);
    expect(result.current.value).toEqual(['v']);
  });
});
