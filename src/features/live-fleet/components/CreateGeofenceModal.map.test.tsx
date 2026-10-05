// web/tz.md §11.1 — picking the geofence on the map. The real MapLibre map needs WebGL, so a
// probe stands in for it: its buttons fire `onPointsChange` exactly like a click on the map.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ToastProvider } from '@/shared/ui/Toast';
import type { GeofencePickerMapProps } from '@/shared/map/GeofencePickerMap';
import { CreateGeofenceModal } from './CreateGeofenceModal';

vi.stubEnv('VITE_MAP_STYLE_URL', 'https://example.com/style.json');
vi.mock('@/shared/map/GeofencePickerMap', () => ({
  default: ({ mode, points, onPointsChange, colour }: GeofencePickerMapProps) => (
    <div data-testid="picker-map" data-mode={mode} data-points={points.length} data-colour={colour}>
      <button type="button" onClick={() => onPointsChange(mode === 'point' ? [{ lat: 40, lon: -83 }] : [...points, { lat: 40 + points.length, lon: -83 - points.length }])}>
        map click
      </button>
    </div>
  ),
}));

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CreateGeofenceModal open onClose={vi.fn()} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function capturePost() {
  const box: { body: Record<string, unknown> | null } = { body: null };
  server.use(
    http.post(url(endpoints.geofences.create), async ({ request }) => {
      box.body = (await request.json()) as Record<string, unknown>;
      return ok({ id: 'geo_1' });
    }),
  );
  return box;
}

describe('11.1 Create a geofence — map picking', () => {
  it('renders the map and sends the clicked centre for a Circle', async () => {
    const posted = capturePost();
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Circle' }));
    expect(await screen.findByTestId('picker-map')).toHaveAttribute('data-mode', 'point');

    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    await user.type(screen.getByPlaceholderText('0.8'), '0.5');
    await user.click(screen.getByRole('button', { name: 'map click' }));
    expect(screen.getByText(/40\.00000, -83\.00000/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));

    await vi.waitFor(() =>
      expect(posted.body).toMatchObject({ type: 'CIRCLE', centerLat: 40, centerLon: -83, radiusMi: 0.5 }),
    );
    // Untouched colour / yard-move controls reach the wire with their defaults.
    expect(posted.body).toMatchObject({ colour: 'BLUE', countAsYardMove: false });
  });

  it('draws the shape in the picked colour and posts it with count-as-yard-move', async () => {
    const posted = capturePost();
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Circle' }));
    const map = await screen.findByTestId('picker-map');
    expect(map).toHaveAttribute('data-colour', 'BLUE');

    await user.selectOptions(screen.getByLabelText('Colour'), 'GREEN');
    expect(map).toHaveAttribute('data-colour', 'GREEN');

    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    await user.type(screen.getByPlaceholderText('0.8'), '0.5');
    await user.click(screen.getByRole('button', { name: 'map click' }));
    await user.click(screen.getByLabelText('Count time inside as on-duty yard move'));
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));

    await vi.waitFor(() =>
      expect(posted.body).toMatchObject({ type: 'CIRCLE', colour: 'GREEN', countAsYardMove: true }),
    );
  });

  it('asks for a centre before posting a Circle with no point picked', async () => {
    const posted = capturePost();
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole('button', { name: 'Circle' }));
    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Click the map to place the centre of the circle.');
    expect(posted.body).toBeNull();
  });

  it('sends the rectangle spanned by two clicked corners as a POLYGON', async () => {
    const posted = capturePost();
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    await user.click(await screen.findByRole('button', { name: 'map click' }));
    await user.click(screen.getByRole('button', { name: 'map click' }));
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));

    await vi.waitFor(() =>
      expect(posted.body).toMatchObject({
        type: 'POLYGON',
        polygon: [
          { lat: 40, lon: -83 },
          { lat: 40, lon: -84 },
          { lat: 41, lon: -84 },
          { lat: 41, lon: -83 },
        ],
      }),
    );
  });
});
