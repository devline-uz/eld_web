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
} from './vehicles';

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
