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
    expect(all.source).toBe('search');
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

  it('falls back to /drivers?q= + /vehicles?q= when /search is 404 (live API today)', async () => {
    const seen: string[] = [];
    server.use(
      http.get(url(endpoints.search.root), () => fail(404, 'NOT_FOUND', 'Cannot GET /api/search')),
      http.get(url(endpoints.drivers.list), ({ request }) => {
        seen.push(`drivers:${new URL(request.url).searchParams.get('q')}`);
        return ok(page([{ id: 'd1', firstName: 'Walter', lastName: 'Smith', username: 'ws', homeTerminalName: 'Columbus, OH' }]));
      }),
      http.get(url(endpoints.vehicles.list), ({ request }) => {
        seen.push(`vehicles:${new URL(request.url).searchParams.get('q')}`);
        return ok(page([{ id: 'v1', unitNumber: '101', make: null, model: null, vin: 'VIN1' }]));
      }),
    );
    const result = await fetchGlobalSearch('smith', { drivers: true, vehicles: true });
    expect(result.source).toBe('fallback');
    expect(seen.sort()).toEqual(['drivers:smith', 'vehicles:smith']);
    expect(result.drivers[0]).toMatchObject({ id: 'd1', name: 'Walter Smith', unitNumber: null, homeTerminalName: 'Columbus, OH' });
    expect(result.vehicles[0]).toMatchObject({ id: 'v1', unitNumber: '101', driverName: null });
    expect(result.scope).toBeUndefined();

    const none = await fetchGlobalSearch('smith', { drivers: false, vehicles: false });
    expect(none.drivers).toEqual([]);
    expect(none.vehicles).toEqual([]);
  });

  it('uses the username when a fallback driver has no name', async () => {
    server.use(
      http.get(url(endpoints.search.root), () => fail(404, 'NOT_FOUND', 'missing')),
      http.get(url(endpoints.drivers.list), () =>
        ok(page([{ id: 'd2', firstName: '', lastName: '', username: 'nobody', homeTerminalName: null }])),
      ),
    );
    const result = await fetchGlobalSearch('nob', { drivers: true, vehicles: false });
    expect(result.drivers[0]).toMatchObject({ name: 'nobody', homeTerminalName: null });
  });

  it('throws anything other than a 404 so the palette can show its error', async () => {
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
