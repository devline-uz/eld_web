import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { DRIVERS, VEHICLES } from '@/mocks/handlers/mockState';
import { fail, ok, server, url } from '@/mocks/server';
import { ApiError } from './errors';
import { endpoints } from './endpoints';
import { fetchGlobalSearch, useGlobalSearch } from './search';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const page = <T,>(items: T[]) => ({ items, page: 1, limit: 5, total: items.length, totalPages: 1 });

describe('fetchGlobalSearch (B-10)', () => {
  it('uses GET /search and applies the permission scope', async () => {
    const all = await fetchGlobalSearch('smith', { drivers: true, vehicles: true });
    expect(all.drivers.map((d) => d.name)).toEqual(['John Smith', 'Smith Rodriguez']);
    expect(all.vehicles).toHaveLength(1);
    // WB-176 — derived from the fixture, not a pinned literal: the handler and the panel now
    // report the units `GET /vehicles` really answers.
    expect(all.scope).toEqual({ units: VEHICLES.length, drivers: DRIVERS.length, logs: 1284 });

    const driversOnly = await fetchGlobalSearch('smith', { drivers: true, vehicles: false });
    expect(driversOnly.vehicles).toEqual([]);
    const vehiclesOnly = await fetchGlobalSearch('smith', { drivers: false, vehicles: true });
    expect(vehiclesOnly.drivers).toEqual([]);
  });

  it('makes exactly one /search call, never the /drivers + /vehicles fan-out (WD-093)', async () => {
    const seen: string[] = [];
    server.use(
      http.get(url(endpoints.search.root), ({ request }) => {
        const params = new URL(request.url).searchParams;
        seen.push(`search:${params.get('q')}:${params.get('limit')}`);
        // A section the caller may not read may be absent altogether.
        return ok({ q: 'smith', drivers: [{ id: 'd1', name: 'Walter Smith', unitNumber: null, dutyStatus: null, openViolations: null, openWarnings: null, homeTerminalName: null }] });
      }),
      http.get(url(endpoints.drivers.list), () => {
        seen.push('drivers');
        return ok(page([]));
      }),
      http.get(url(endpoints.vehicles.list), () => {
        seen.push('vehicles');
        return ok(page([]));
      }),
    );
    const result = await fetchGlobalSearch('smith', { drivers: true, vehicles: true });
    expect(seen).toEqual(['search:smith:5']);
    expect(result.drivers[0]).toMatchObject({ id: 'd1', name: 'Walter Smith' });
    expect(result.vehicles).toEqual([]);
    expect(result.scope).toBeUndefined();
  });

  it('surfaces a 404 as an error instead of fanning out', async () => {
    server.use(http.get(url(endpoints.search.root), () => fail(404, 'NOT_FOUND', 'Cannot GET /api/search')));
    await expect(fetchGlobalSearch('smith', { drivers: true, vehicles: true })).rejects.toBeInstanceOf(ApiError);
  });

  it('throws a 400 so the palette can show its error', async () => {
    server.use(http.get(url(endpoints.search.root), () => fail(400, 'VALIDATION_FAILED', 'bad q')));
    await expect(fetchGlobalSearch('x!', { drivers: true, vehicles: true })).rejects.toBeInstanceOf(ApiError);
  });
});

describe('useGlobalSearch', () => {
  it('stays idle below two characters and with no searchable scope', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const short = renderHook(() => useGlobalSearch('s', { drivers: true, vehicles: true }), { wrapper });
    expect(short.result.current.fetchStatus).toBe('idle');
    const noScope = renderHook(() => useGlobalSearch('smith', { drivers: false, vehicles: false }), { wrapper });
    expect(noScope.result.current.fetchStatus).toBe('idle');
    const real = renderHook(() => useGlobalSearch(' smith ', { drivers: true, vehicles: true }), { wrapper });
    await waitFor(() => expect(real.result.current.data?.drivers).toHaveLength(2));
  });

  it('refetches when the scope widens instead of serving the narrowed result (WB-090)', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result, rerender } = renderHook(({ vehicles }) => useGlobalSearch('smith', { drivers: true, vehicles }), {
      wrapper,
      initialProps: { vehicles: false },
    });
    await waitFor(() => expect(result.current.data?.drivers).toHaveLength(2));
    expect(result.current.data?.vehicles).toEqual([]);
    rerender({ vehicles: true });
    await waitFor(() => expect(result.current.data?.vehicles).toHaveLength(1));
  });
});
