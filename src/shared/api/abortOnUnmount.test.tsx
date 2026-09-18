// client.ts rule 9 guard (web/bugs.md WB-089) — every shared/api query hook forwards TanStack's
// `signal`, so unmounting the last observer aborts the in-flight request instead of letting it run
// to completion for a screen that no longer exists. A representative hook from each domain module;
// a hook that drops `signal` again leaves its request un-aborted and fails here.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { resetAuthBridge, setAccessToken, setAuthBridge } from './client';
import { useDashboardSummary } from './dashboardSummary';
import { useDriver, useDriverHos, useDriversList } from './drivers';
import { useDefectsList } from './dvir';
import { useLogDay, useLogEvents } from './hosLogs';
import { useLiveFleet } from './liveFleet';
import { useDriversLookup } from './lookups';
import { useConversationsList, useMessages } from './messaging';
import { useNotifications } from './notifications';
import { useScorecard } from './safety';
import { useGlobalSearch } from './search';
import { useAuditLog, useCarrier, useUsersList } from './settingsAdmin';
import { useTrip } from './trips';
import { useVehicle } from './vehicles';

const started = new Set<string>();
const aborted = new Set<string>();

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterAll(() => server.close());
beforeEach(() => {
  started.clear();
  aborted.clear();
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  // Every GET hangs until its signal aborts (or 5 s pass) and records both ends by pathname.
  server.use(
    http.get('*', async ({ request }) => {
      const path = new URL(request.url).pathname.replace(/^\/api/, '');
      started.add(path);
      await new Promise<void>((resolve) => {
        request.signal.addEventListener('abort', () => {
          aborted.add(path);
          resolve();
        });
        setTimeout(resolve, 5_000);
      });
      return HttpResponse.json({ statusCode: 503, code: 'UNAVAILABLE', message: 'late' }, { status: 503 });
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});

const CASES: Array<[string, string, () => unknown]> = [
  ['drivers · useDriversList', '/drivers', () => useDriversList({ page: 1, limit: 25 })],
  ['drivers · useDriver', '/drivers/drv_1', () => useDriver('drv_1')],
  ['drivers · useDriverHos', '/drivers/drv_1/hos', () => useDriverHos('drv_1')],
  ['lookups · useDriversLookup', '/drivers', () => useDriversLookup()],
  ['vehicles · useVehicle', '/vehicles/veh_1', () => useVehicle('veh_1')],
  ['trips · useTrip', '/trips/trp_1', () => useTrip('trp_1')],
  ['dvir · useDefectsList', '/defects', () => useDefectsList({ page: 1, limit: 10 })],
  ['hosLogs · useLogDay', '/logs/drv_1', () => useLogDay('drv_1', '2026-09-10')],
  ['hosLogs · useLogEvents', '/logs/drv_1/events', () => useLogEvents('drv_1', '2026-09-10')],
  ['safety · useScorecard', '/safety/scorecard', () => useScorecard()],
  ['messaging · useConversationsList', '/conversations', () => useConversationsList('usr_1')],
  ['messaging · useMessages', '/conversations/cnv_1/messages', () => useMessages('cnv_1')],
  ['notifications · useNotifications', '/notifications', () => useNotifications({ page: 1, limit: 10 })],
  ['liveFleet · useLiveFleet', '/live/fleet', () => useLiveFleet()],
  ['dashboard · useDashboardSummary', '/dashboard/summary', () => useDashboardSummary()],
  ['settings · useCarrier', '/carrier', () => useCarrier()],
  ['settings · useUsersList', '/users', () => useUsersList()],
  ['settings · useAuditLog', '/audit-log', () => useAuditLog()],
  ['search · useGlobalSearch', '/search', () => useGlobalSearch('101', { drivers: true, vehicles: true })],
];

describe('shared/api query hooks abort on unmount (client.ts rule 9, WB-089)', () => {
  it.each(CASES)('%s', async (_name, path, hook) => {
    const { unmount } = renderHook(hook, { wrapper: wrapper() });
    await waitFor(() => expect([...started]).toContain(path));
    expect(aborted.has(path)).toBe(false);
    unmount();
    await waitFor(() => expect([...aborted]).toContain(path));
  });
});
