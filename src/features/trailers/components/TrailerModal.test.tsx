// Add / Edit / Delete / Import trailer overlays — validation, 409 mapping, toasts, invalidation.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { resetMockState } from '@/mocks/handlers/mockState';
import { endpoints } from '@/shared/api/endpoints';
import { qkRoot } from '@/shared/api/queryKeys';
import { VALIDATION_MESSAGES } from '@/shared/forms/messages';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import type { TrailerRow } from '@/shared/api/trailers';
import { TrailerModal } from './TrailerModal';
import { DeleteTrailerModal } from './DeleteTrailerModal';
import { ImportTrailersModal } from './ImportTrailersModal';

const TRAILER: TrailerRow = { id: 'trl_1', number: 'T-4471', vin: '1JJV532W7YL123456', status: 'ACTIVE', deletedAt: null };

function renderWithProviders(children: React.ReactNode, queryClient?: QueryClient) {
  const client = queryClient ?? new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  resetMockState();
});
afterAll(() => server.close());
beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('Add trailer', () => {
  it('requires a number and rejects a malformed VIN before any request', async () => {
    const post = vi.fn();
    server.use(http.post(url(endpoints.trailers.create), () => (post(), ok({}, 201))));
    const user = userEvent.setup();
    renderWithProviders(<TrailerModal onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Save trailer' }));
    expect(await screen.findByText(VALIDATION_MESSAGES.trailerNumber)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Trailer number/), 'T-5001');
    await user.type(screen.getByLabelText('VIN'), 'SHORT');
    await user.click(screen.getByRole('button', { name: 'Save trailer' }));
    expect(await screen.findByText(VALIDATION_MESSAGES.vin)).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('creates a trailer (VIN optional), toasts and invalidates the trailers keys', async () => {
    let sent: unknown;
    server.use(
      http.post(url(endpoints.trailers.create), async ({ request }) => {
        sent = await request.json();
        return ok({ ...TRAILER, id: 'trl_9', number: 'T-5001' }, 201);
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TrailerModal onClose={onClose} />, queryClient);
    await user.type(screen.getByLabelText(/Trailer number/), 'T-5001');
    await user.click(screen.getByRole('button', { name: 'Save trailer' }));
    expect(await screen.findByText('Trailer T-5001 created')).toBeInTheDocument();
    expect(sent).toEqual({ number: 'T-5001' });
    expect(onClose).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qkRoot.trailers });
  });

  it('maps a server 409 to the number field and keeps the modal open', async () => {
    server.use(http.post(url(endpoints.trailers.create), () => fail(409, 'CONFLICT', 'Trailer "T-9" already exists.')));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TrailerModal onClose={onClose} />);
    await user.type(screen.getByLabelText(/Trailer number/), 'T-9');
    await user.click(screen.getByRole('button', { name: 'Save trailer' }));
    expect(await screen.findByText(VALIDATION_MESSAGES.trailerNumberTaken)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not pre-check against a list: a taken number is only known from the server 409', async () => {
    const posts: unknown[] = [];
    server.use(
      http.post(url(endpoints.trailers.create), async ({ request }) => {
        posts.push(await request.json());
        return fail(409, 'CONFLICT', 'Trailer "T-4471" already exists.');
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TrailerModal onClose={() => {}} />);
    await user.type(screen.getByLabelText(/Trailer number/), 'T-4471');
    await user.click(screen.getByRole('button', { name: 'Save trailer' }));
    expect(await screen.findByText(VALIDATION_MESSAGES.trailerNumberTaken)).toBeInTheDocument();
    expect(posts).toHaveLength(1);
  });

  it('maps a 409 on a rename onto the number field', async () => {
    server.use(http.patch(url(endpoints.trailers.update('trl_1')), () => fail(409, 'CONFLICT', 'Trailer "T-4472" already exists.')));
    const user = userEvent.setup();
    renderWithProviders(<TrailerModal trailer={TRAILER} onClose={() => {}} />);
    const input = screen.getByLabelText(/Trailer number/);
    await user.clear(input);
    await user.type(input, 'T-4472');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText(VALIDATION_MESSAGES.trailerNumberTaken)).toBeInTheDocument();
  });

  it('asks before discarding a dirty form, not an untouched one', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<TrailerModal onClose={onClose} />);
    await user.type(screen.getByLabelText(/Trailer number/), 'T-1');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect((await screen.findAllByText(/discard/i)).length).toBeGreaterThan(0);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Edit trailer', () => {
  it('PATCHes number, vin and status and toasts', async () => {
    let sent: unknown;
    server.use(
      http.patch(url(endpoints.trailers.update('trl_1')), async ({ request }) => {
        sent = await request.json();
        return ok(TRAILER);
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<TrailerModal trailer={TRAILER} onClose={() => {}} />);
    await user.selectOptions(screen.getByLabelText('Status'), 'INACTIVE');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Trailer T-4471 updated')).toBeInTheDocument();
    expect(sent).toEqual({ number: 'T-4471', vin: '1JJV532W7YL123456', status: 'INACTIVE' });
  });
});

describe('Delete trailer', () => {
  it('deletes and toasts', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DeleteTrailerModal trailer={TRAILER} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Delete trailer' }));
    expect(await screen.findByText('Trailer T-4471 deleted')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('states the soft-delete semantics and shows a server refusal (already deleted → 404) without closing', async () => {
    server.use(http.delete(url(endpoints.trailers.remove('trl_1')), () => fail(404, 'NOT_FOUND', 'Trailer not found.')));
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<DeleteTrailerModal trailer={TRAILER} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'Delete trailer' }));
    expect(screen.getByText(/the number\s+can be reused/)).toBeInTheDocument();
    expect(await screen.findByText('Trailer not found.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Import trailers', () => {
  it('rejects a file over 5 MB and a file without a number column', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportTrailersModal onClose={() => {}} />);
    const input = screen.getByLabelText('Trailers CSV file');
    const big = new File(['x'], 'big.csv', { type: 'text/csv' });
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
    await user.upload(input, big);
    expect(await screen.findByText('File is larger than 5 MB.')).toBeInTheDocument();
    await user.upload(input, new File(['vin\nabc'], 'bad.csv', { type: 'text/csv' }));
    expect(await screen.findByText(/needs a "number" column/)).toBeInTheDocument();
  });

  it('imports and toasts the created / updated / failed summary', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ImportTrailersModal onClose={onClose} />);
    await user.upload(screen.getByLabelText('Trailers CSV file'), new File(['number,vin\nT-6001,\nT-4471,1JJV532W7YL123456\n'], 't.csv', { type: 'text/csv' }));
    await user.click(await screen.findByRole('button', { name: 'Import 2 trailers' }));
    expect(await screen.findByText('2 trailers imported')).toBeInTheDocument();
    expect(screen.getByText('1 created · 1 updated · 0 failed.')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps per-row failures visible when the server reports some', async () => {
    server.use(http.post(url(endpoints.trailers.import), () => ok({ imported: 1, updated: 0, failed: [{ index: 1, error: 'Unknown error' }] }, 201)));
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<ImportTrailersModal onClose={onClose} />);
    await user.upload(screen.getByLabelText('Trailers CSV file'), new File(['number\nA\nB\n'], 't.csv', { type: 'text/csv' }));
    await user.click(await screen.findByRole('button', { name: 'Import 2 trailers' }));
    expect(await screen.findByText(/Row 2: Unknown error/)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
