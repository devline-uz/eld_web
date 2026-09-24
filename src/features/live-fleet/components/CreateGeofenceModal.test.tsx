// web/tz.md §11.1 — the Address shape, `dwellMinutes` and `afterHoursOnly` are live (B-93/B-15
// shipped, web/backend-gaps.md 2026-09-24 handoff); posts to `POST /geofences` on save.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
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
  it('renders the dwell and after-hours checkboxes enabled and toggleable (B-15 shipped)', async () => {
    const user = userEvent.setup();
    renderModal();
    const dwellCheckbox = screen.getByLabelText('Dwell longer than');
    const dwellMinutes = screen.getByLabelText('Dwell minutes');
    const afterHours = screen.getByLabelText('After-hours entry');
    expect(dwellCheckbox).not.toBeDisabled();
    expect(afterHours).not.toBeDisabled();
    expect(dwellMinutes).toBeDisabled();

    await user.click(dwellCheckbox);
    expect(dwellMinutes).not.toBeDisabled();
  });

  it('posts dwellMinutes/afterHoursOnly/radiusMi and fires the geofenceCreated toast on save', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(url(endpoints.geofences.create), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return ok({ id: 'geo_1' });
      }),
    );
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Columbus terminal');
    await user.type(screen.getByPlaceholderText('0.8'), '0.5');
    await user.click(screen.getByLabelText('Dwell longer than'));
    await user.click(screen.getByLabelText('After-hours entry'));
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));

    expect(await screen.findByText('Geofence created', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
    expect(posted).toMatchObject({ name: 'Columbus terminal', radiusMi: 0.5, dwellMinutes: 45, afterHoursOnly: true });
  });

  it('unlocks the Address shape, requires an address, and sends type: ADDRESS', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(url(endpoints.geofences.create), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return ok({ id: 'geo_1' });
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Address' }));
    expect(screen.getByRole('button', { name: 'Address' })).not.toBeDisabled();
    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    await user.type(screen.getByPlaceholderText('4517 Washington Ave., Columbus, OH 43004'), '123 Main St, Columbus, OH');
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));

    await vi.waitFor(() => expect(posted).toMatchObject({ type: 'ADDRESS', address: '123 Main St, Columbus, OH' }));
  });

  it('surfaces GEOCODER_NOT_CONFIGURED in the in-modal banner', async () => {
    server.use(
      http.post(url(endpoints.geofences.create), () =>
        HttpResponse.json(
          { statusCode: 422, code: 'GEOCODER_NOT_CONFIGURED', message: 'No geocoding service is configured.', details: {}, traceId: 't1' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole('button', { name: 'Address' }));
    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    await user.type(screen.getByPlaceholderText('4517 Washington Ave., Columbus, OH 43004'), '123 Main St');
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Address lookup is not configured/);
  });
});

// WB — `Cancel` called `onClose` directly and so skipped the 11.30 confirm that Esc and X honour,
// and a 422 was swallowed entirely (the toast was suppressed for it, but `details` was never fed
// into `setError`, so the modal just sat there).
describe('11.1 Create a geofence — close and failure are never silent', () => {
  it('closes an untouched form on Cancel without a confirm', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirms on Cancel once the form has been edited', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('puts a 422 the fields cannot carry into the in-modal banner', async () => {
    server.use(
      http.post(url(endpoints.geofences.create), () =>
        HttpResponse.json(
          { statusCode: 422, code: 'VALIDATION_ERROR', message: 'Invalid geofence', details: { polygon: 'Must have at least three points.' }, traceId: 't1' },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

// Stage 3 — the shape segments and the Save guard.
describe('11.1 Create a geofence — shape segments and double-submit', () => {
  it('presses whichever of Circle/Rectangle/Polygon was picked and sends the matching type', async () => {
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.post(url(endpoints.geofences.create), async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return ok({ id: 'geo_1' });
      }),
    );
    const user = userEvent.setup();
    renderModal();
    const segment = (name: string) => screen.getByRole('button', { name });

    expect(segment('Rectangle')).toHaveAttribute('aria-pressed', 'true');
    await user.click(segment('Polygon'));
    expect(segment('Polygon')).toHaveAttribute('aria-pressed', 'true');
    expect(segment('Rectangle')).toHaveAttribute('aria-pressed', 'false');
    await user.click(segment('Circle'));
    expect(segment('Circle')).toHaveAttribute('aria-pressed', 'true');
    expect(segment('Polygon')).toHaveAttribute('aria-pressed', 'false');

    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    await user.click(screen.getByRole('button', { name: 'Save geofence' }));
    await vi.waitFor(() => expect(posted).toMatchObject({ type: 'CIRCLE' }));
  });

  it('sends one POST while the request is in flight, however many times Save is clicked', async () => {
    let calls = 0;
    let release: () => void = () => undefined;
    server.use(
      http.post(url(endpoints.geofences.create), async () => {
        calls += 1;
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return ok({ id: 'geo_1' });
      }),
    );
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText('Columbus terminal'), 'Yard A');
    const save = screen.getByRole('button', { name: 'Save geofence' });
    await user.click(save);
    await vi.waitFor(() => expect(save).toBeDisabled());
    await user.click(save);
    await user.dblClick(save);
    release();
    expect(await screen.findByText('Geofence created', {}, { timeout: 8000 })).toBeInTheDocument();
    expect(calls).toBe(1);
  });
});
