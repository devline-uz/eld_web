// QA fix — `Keep the unit out of service`: every work-order write can flip `Vehicle.status` on the
// server, so each mutation must refetch vehicles, the dashboard summary and Live Fleet.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from './endpoints';
import { qk, qkRoot } from './queryKeys';
import { resetAuthBridge, setAccessToken, setAuthBridge } from './client';
import { useCancelWorkOrder, useCloseWorkOrder, useCreateWorkOrder, useUpdateWorkOrder } from './dvir';

const WO = { id: 'wo_1', number: 'WO-0001', vehicleId: 'veh_1', status: 'OPEN', keepOutOfService: true };

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const spy = vi.spyOn(queryClient, 'invalidateQueries');
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const invalidated = () => spy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
  return { Wrapper, invalidated };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(
    http.post(url(endpoints.workOrders.create), () => ok(WO, 201)),
    http.patch(url(endpoints.workOrders.update(WO.id)), () => ok(WO)),
    http.post(url(endpoints.workOrders.close(WO.id)), () => ok({ ...WO, status: 'DONE' })),
    http.post(url(endpoints.workOrders.cancel(WO.id)), () => ok({ ...WO, status: 'CANCELLED' })),
  );
});
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

const UNIT_STATUS_KEYS = [qkRoot.vehicles, qk.dashboardSummary, qk.liveFleet()].map((key) => JSON.stringify(key));

/** The slice of a mutation result the table below drives. */
interface Mutation {
  mutate: (variables: never) => void;
  isSuccess: boolean;
}

const CASES: [string, () => Mutation, unknown][] = [
  ['create', () => useCreateWorkOrder() as unknown as Mutation, { vehicleId: 'veh_1', title: 'Brakes', keepOutOfService: true }],
  ['update', () => useUpdateWorkOrder(WO.id) as unknown as Mutation, { keepOutOfService: false }],
  ['close', () => useCloseWorkOrder(WO.id) as unknown as Mutation, undefined],
  ['cancel', () => useCancelWorkOrder(WO.id) as unknown as Mutation, undefined],
];

describe('work-order mutations refetch unit status', () => {
  it.each(CASES)('%s invalidates vehicles, dashboard and live fleet', async (_name, useHook, variables) => {
    const { Wrapper, invalidated } = setup();
    const { result } = renderHook(useHook, { wrapper: Wrapper });
    result.current.mutate(variables as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidated()).toEqual(expect.arrayContaining(UNIT_STATUS_KEYS));
  });
});
