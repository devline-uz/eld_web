import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TripStopRow } from '@/shared/api/trips';

if (!window.URL.createObjectURL) window.URL.createObjectURL = () => 'blob:mock';
import type { RouteMapProps } from '@/shared/map/RouteMap';

let mapProps: RouteMapProps | null = null;
vi.mock('@/shared/map/RouteMap', () => ({
  default: (props: RouteMapProps) => {
    mapProps = props;
    return <div data-testid="route-map" />;
  },
}));
const { RoutePreview } = await import('./RoutePreview');

const stop = (over: Partial<TripStopRow>): TripStopRow => ({
  id: 's', tripId: 't', sequence: 1, type: 'PICKUP', name: 'A', address: null, latitude: null, longitude: null,
  scheduledAt: null, arrivedAt: null, departedAt: null, status: 'PENDING', note: null, ...over,
});
beforeEach(() => {
  mapProps = null;
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
  it('passes the placeable intermediate stops to the map and the router in route order', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    wrap(
      <RoutePreview
        pickup={stop({ latitude: 41.8, longitude: -87.6 })}
        waypoints={[
          stop({ type: 'CHECKPOINT', sequence: 2, latitude: 41.6, longitude: -86.2 }),
          stop({ type: 'CHECKPOINT', sequence: 3, latitude: null, longitude: null }),
          stop({ type: 'CHECKPOINT', sequence: 4, latitude: 41.1, longitude: -85.1 }),
        ]}
        delivery={stop({ type: 'DELIVERY', latitude: 39.1, longitude: -94.5 })}
      />,
    );
    expect(await screen.findByTestId('route-map')).toBeInTheDocument();
    expect(mapProps?.pickup).toEqual({ lat: 41.8, lon: -87.6 });
    expect(mapProps?.waypoints).toEqual([{ lat: 41.6, lon: -86.2 }, { lat: 41.1, lon: -85.1 }]);
    expect(mapProps?.delivery).toEqual({ lat: 39.1, lon: -94.5 });
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/route/v1/driving/-87.6,41.8;-86.2,41.6;-85.1,41.1;-94.5,39.1?');
  });
});
