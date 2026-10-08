import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TripStopRow } from '@/shared/api/trips';

if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:mock';
vi.mock('@/shared/map/RouteMap', () => ({ default: () => <div data-testid="route-map" /> }));
const { RoutePreview } = await import('./RoutePreview');

const stop = (over: Partial<TripStopRow>): TripStopRow => ({
  id: 's', tripId: 't', sequence: 1, type: 'PICKUP', name: 'A', address: null, latitude: null, longitude: null,
  scheduledAt: null, arrivedAt: null, departedAt: null, status: 'PENDING', note: null, ...over,
});
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ features: [] }) }));
});
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe('RoutePreview', () => {
  it('shows the empty state when stops carry no usable coordinates', async () => {
    wrap(<RoutePreview pickup={stop({ latitude: 0, longitude: 0 })} delivery={stop({ type: 'DELIVERY' })} />);
    expect(await screen.findByText('Route unavailable')).toBeInTheDocument();
  });
  it('shows the empty state without stops', async () => {
    wrap(<RoutePreview pickup={null} delivery={null} />);
    expect(await screen.findByText('Route unavailable')).toBeInTheDocument();
  });
  it('renders the map when both stops have coordinates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    wrap(<RoutePreview pickup={stop({ latitude: 41.8, longitude: -87.6 })} delivery={stop({ type: 'DELIVERY', latitude: 39.1, longitude: -94.5 })} />);
    expect(await screen.findByTestId('route-map')).toBeInTheDocument();
  });
});
