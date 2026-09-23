// web/tz.md §11.1 — renders `dwellMinutes` / `afterHoursOnly` even though they are gap B-15
// (disabled, never dropped silently), and posts to `POST /geofences` on save.
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

  it('disables Address with its reason on screen (B-93) instead of sending POLYGON', () => {
    renderModal();
    const address = screen.getByRole('button', { name: 'Address' });
    expect(address).toBeDisabled();
    expect(address).toHaveAccessibleDescription(/Address shape is not available yet/);
    expect(screen.getByText(/Address shape is not available yet/)).toBeVisible();
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
