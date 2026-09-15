// web/tz.md §11.1 — renders `dwellMinutes` / `afterHoursOnly` even though they are gap B-15
// (disabled, never dropped silently), and posts to `POST /geofences` on save.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ToastProvider } from '@/shared/ui/Toast';
import { CreateGeofenceModal } from './CreateGeofenceModal';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderModal(onClose = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CreateGeofenceModal open onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('11.1 Create a geofence', () => {
  it('renders the dwell and after-hours checkboxes disabled (gap B-15), not dropped', () => {
    renderModal();
    expect(screen.getByLabelText(/Dwell longer than — not yet supported/)).toBeDisabled();
    expect(screen.getByLabelText(/After-hours entry — not yet supported/)).toBeDisabled();
  });

  it('posts to POST /geofences and fires the geofenceCreated toast on save', async () => {
    let posted: unknown = null;
    server.use(
      http.post(url(endpoints.geofences.create), async ({ request }) => {
        posted = await request.json();
        return ok({ id: 'geo_1' });
      }),
    );
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Columbus terminal');
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));

    expect(await screen.findByText('Geofence created', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(posted).toMatchObject({ name: 'Columbus terminal' });
    // ⛔ B-15 — dropped from the payload, not sent as an unknown field.
    expect(posted).not.toHaveProperty('dwellMinutes');
    expect(posted).not.toHaveProperty('afterHoursOnly');
  });
});
