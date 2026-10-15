// Coverage for the vehicles.ts composition module — join hooks, `totalVehicleMiles`, and every
// mutation (create/update/delete/assign-driver/calibrate-odometer/import).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import {
  totalVehicleMiles,
  useVehicle,
  useVehicleAssignedDriver,
  useVehicleDevice,
  useVehicleDtc,
  useVehicleActivities,
  useVehicleHistories,
  useVehiclesPicker,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
  useAssignDriver,
  useCalibrateOdometer,
  useImportVehicles,
  useVehicleCounts,
  deviceConnection,
  joinVehicles,
  type DeviceRow,
  type VehicleRow,
} from './vehicles';
import { qk } from './queryKeys';

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('totalVehicleMiles', () => {
  it('returns the dash odometer when no device reading exists yet', () => {
    expect(totalVehicleMiles({ odometerMi: 1000, deviceOdometerMi: null, odometerOffsetMi: 0 })).toBe(1000);
  });

  it('returns device + offset once a device reading exists (§4.3)', () => {
    expect(totalVehicleMiles({ odometerMi: 1000, deviceOdometerMi: 981109, odometerOffsetMi: 12480 })).toBe(993589);
  });
});

describe('UI-004 useVehicleCounts', () => {
  it('reads ACTIVE / INACTIVE / OUT_OF_SERVICE from one page\'s statusCounts — no per-status requests', async () => {
    const statuses: Array<string | null> = [];
    server.use(
      http.get(url(endpoints.vehicles.list), ({ request }) => {
        statuses.push(new URL(request.url).searchParams.get('status'));
        return ok({ items: [], page: 1, limit: 1, total: 45, totalPages: 45, statusCounts: { ACTIVE: 40, INACTIVE: 3, OUT_OF_SERVICE: 2, total: 45 } });
      }),
    );
    const { result } = renderHook(() => useVehicleCounts(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ all: 45, active: 40, inactive: 3, outOfService: 2 });
    expect(statuses).toEqual([null]);
  });
});

describe('UI-012 deviceConnection', () => {
  it('prefers the effective `connection` over the stored bleState', () => {
    expect(deviceConnection({ connection: 'DISCONNECTED', bleState: 'CONNECTED' })).toBe('DISCONNECTED');
    expect(deviceConnection({ connection: 'CONNECTED', bleState: 'OUT_OF_RANGE' })).toBe('CONNECTED');
  });
  it('falls back to bleState on a backend that predates `connection`', () => {
    expect(deviceConnection({ bleState: 'CONNECTED' })).toBe('CONNECTED');
    expect(deviceConnection({ bleState: 'OUT_OF_RANGE' })).toBe('DISCONNECTED');
  });
});

describe('read hooks', () => {
  it('useVehicle fetches the raw vehicle row', async () => {
    const { result } = renderHook(() => useVehicle('veh_1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.unitNumber).toBeDefined();
  });

  it('useVehicleAssignedDriver finds the driver whose assignedVehicleId matches', async () => {
    server.use(
      http.get(url(endpoints.drivers.list), () =>
        ok({ items: [{ id: 'drv_9', assignedVehicleId: 'veh_9', firstName: 'A', lastName: 'B' }], page: 1, limit: 500, total: 1, totalPages: 1 }),
      ),
    );
    const { result } = renderHook(() => useVehicleAssignedDriver('veh_9'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('drv_9');
  });

  it('useVehicleAssignedDriver resolves null when no driver matches', async () => {
    server.use(
      http.get(url(endpoints.drivers.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
    );
    const { result } = renderHook(() => useVehicleAssignedDriver('veh_9'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('useVehicleDevice (gap B-35) finds the device whose vehicleId matches', async () => {
    server.use(
      http.get(url(endpoints.devices.list), () =>
        ok({ items: [{ id: 'dev_9', serial: 'PT30_X', vehicleId: 'veh_9' }], page: 1, limit: 500, total: 1, totalPages: 1 }),
      ),
    );
    const { result } = renderHook(() => useVehicleDevice('veh_9'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.serial).toBe('PT30_X');
  });

  it('useVehicleDtc reads GET /vehicles/:id/dtc', async () => {
    const { result } = renderHook(() => useVehicleDtc('veh_1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toBeDefined();
  });

  it('useVehicleActivities reads the B-5 gap shape from MSW', async () => {
    const { result } = renderHook(() => useVehicleActivities('veh_1'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items.length).toBeGreaterThan(0);
  });

  it('useVehicleHistories reads the B-4 gap shape from MSW', async () => {
    const { result } = renderHook(() => useVehicleHistories('veh_1', '2026-09-10'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.segments.length).toBeGreaterThan(0);
  });

  it('useVehiclesPicker fetches a reference list of vehicles', async () => {
    const { result } = renderHook(() => useVehiclesPicker(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toBeDefined();
  });
});

describe('mutations', () => {
  it('useCreateVehicle posts to POST /vehicles', async () => {
    server.use(http.post(url(endpoints.vehicles.create), () => ok({ id: 'veh_new', unitNumber: '#200' })));
    const { result } = renderHook(() => useCreateVehicle(), { wrapper: wrapper() });
    result.current.mutate({ unitNumber: '200', vin: '1FUJGLDR8LLLL9999', make: 'Volvo', model: 'VNL', year: 2024 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useUpdateVehicle patches PATCH /vehicles/:id', async () => {
    server.use(http.patch(url(endpoints.vehicles.update(':id')), () => ok({ id: 'veh_1', unitNumber: '#101' })));
    const { result } = renderHook(() => useUpdateVehicle('veh_1'), { wrapper: wrapper() });
    result.current.mutate({ notes: 'updated' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useDeleteVehicle calls DELETE /vehicles/:id', async () => {
    server.use(http.delete(url(endpoints.vehicles.remove(':id')), () => ok({ id: 'veh_1', status: 'INACTIVE' })));
    const { result } = renderHook(() => useDeleteVehicle(), { wrapper: wrapper() });
    result.current.mutate('veh_1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useAssignDriver posts to POST /vehicles/:id/assign-driver', async () => {
    server.use(http.post(url(endpoints.vehicles.assignDriver(':id')), () => ok({ id: 'veh_1', assignedDriverId: 'drv_1' })));
    const { result } = renderHook(() => useAssignDriver('veh_1'), { wrapper: wrapper() });
    result.current.mutate({ driverId: 'drv_1' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useAssignDriver surfaces a VEHICLE_OUT_OF_SERVICE 409 for the caller to render', async () => {
    server.use(
      http.post(url(endpoints.vehicles.assignDriver(':id')), () =>
        new Response(
          JSON.stringify({ statusCode: 409, code: 'VEHICLE_OUT_OF_SERVICE', message: 'Vehicle is out of service.', traceId: 't', timestamp: new Date().toISOString() }),
          { status: 409 },
        ),
      ),
    );
    const { result } = renderHook(() => useAssignDriver('veh_1'), { wrapper: wrapper() });
    result.current.mutate({ driverId: 'drv_1' });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('useCalibrateOdometer posts to POST /vehicles/:id/calibrate-odometer', async () => {
    server.use(
      http.post(url(endpoints.vehicles.calibrateOdometer(':id')), () =>
        ok({ id: 'veh_1', odometerOffsetMiles: 12502, dashOdometerMiles: 993611, deviceOdometerMiles: 981109 }),
      ),
    );
    const { result } = renderHook(() => useCalibrateOdometer('veh_1'), { wrapper: wrapper() });
    result.current.mutate({ odometerMi: 993611 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('useImportVehicles posts to POST /vehicles/import', async () => {
    server.use(http.post(url(endpoints.vehicles.import), () => ok({ imported: 36, updated: 2, failed: [] })));
    const { result } = renderHook(() => useImportVehicles(), { wrapper: wrapper() });
    result.current.mutate({ vehicles: [{ unitNumber: '201', vin: '1FUJGLDR8LLLL0001' }] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.imported).toBe(36);
  });
});

// FE-08 — vehicle create/update must refetch the reference-cached `/devices` lookup, and the
// `/vehicles` row's own `eldSerial` must beat a stale lookup in the table join.
describe('FE-08 — stale ELD serial after a vehicle edit', () => {
  const device = (serial: string, vehicleId: string | null, status = 'ACTIVE'): DeviceRow =>
    ({ id: `dev_${serial}`, serial, model: `M-${serial}`, status, vehicleId, bleState: 'DISCONNECTED', firmwareVersion: null, firmwareOutdated: false }) as DeviceRow;
  const vehicle = (eldSerial?: string | null): VehicleRow =>
    ({ id: 'veh_1', unitNumber: '#101', ...(eldSerial === undefined ? {} : { eldSerial }) }) as VehicleRow;
  const STALE = [device('PT30_OLD5', 'veh_1', 'ACTIVE'), device('PT30_NEW7', null, 'INACTIVE')];
  const joinOne = (v: VehicleRow) => {
    const row = joinVehicles([v], [], STALE)[0];
    if (!row) throw new Error('joinVehicles dropped the row');
    return row;
  };

  it('joinVehicles: the server serial wins over the stale lookup, with that device\'s model/status', () => {
    const row = joinOne(vehicle('PT30_NEW7'));
    expect(row.eldSerial).toBe('PT30_NEW7');
    expect(row.eldDeviceModel).toBe('M-PT30_NEW7');
    expect(row.eldDeviceStatus).toBe('INACTIVE');
  });

  it('joinVehicles: a server null (unpaired) is not overridden by the stale lookup', () => {
    const row = joinOne(vehicle(null));
    expect(row.eldSerial).toBeNull();
    expect(row.eldDeviceModel).toBeNull();
  });

  it('joinVehicles: an older backend that omits eldSerial still falls back to the lookup', () => {
    const row = joinOne(vehicle());
    expect(row.eldSerial).toBe('PT30_OLD5');
  });

  function clientWithStaleDevices() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    queryClient.setQueryData(qk.devices({ limit: 500 }), { items: STALE, page: 1, limit: 500, total: 2, totalPages: 1 });
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    }
    return { queryClient, Wrapper };
  }

  it('useUpdateVehicle invalidates the devices lookup on success', async () => {
    server.use(http.patch(url(endpoints.vehicles.update(':id')), () => ok({ id: 'veh_1', unitNumber: '#101' })));
    const { queryClient, Wrapper } = clientWithStaleDevices();
    const { result } = renderHook(() => useUpdateVehicle('veh_1'), { wrapper: Wrapper });
    expect(queryClient.getQueryState(qk.devices({ limit: 500 }))?.isInvalidated).toBe(false);
    result.current.mutate({ deviceId: 'PT30_NEW7' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(qk.devices({ limit: 500 }))?.isInvalidated).toBe(true);
  });

  it('useCreateVehicle invalidates the devices lookup on success', async () => {
    server.use(http.post(url(endpoints.vehicles.create), () => ok({ id: 'veh_new', unitNumber: '#200' })));
    const { queryClient, Wrapper } = clientWithStaleDevices();
    const { result } = renderHook(() => useCreateVehicle(), { wrapper: Wrapper });
    result.current.mutate({ unitNumber: '200', vin: '1FUJGLDR8LLLL9999', deviceId: 'PT30_NEW7' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(qk.devices({ limit: 500 }))?.isInvalidated).toBe(true);
  });

  it('useDeleteVehicle invalidates the devices lookup on success', async () => {
    server.use(http.delete(url(endpoints.vehicles.remove(':id')), () => ok({ id: 'veh_1', status: 'INACTIVE' })));
    const { queryClient, Wrapper } = clientWithStaleDevices();
    const { result } = renderHook(() => useDeleteVehicle(), { wrapper: Wrapper });
    result.current.mutate('veh_1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(qk.devices({ limit: 500 }))?.isInvalidated).toBe(true);
  });
});
