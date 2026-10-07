// Trailers list — rows, search, paging, empty/error states, and the read-only (vehicles READ) removals.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { resetMockState } from '@/mocks/handlers/mockState';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import TrailersPage from './TrailersPage';

const perm = vi.hoisted(() => ({ level: 'FULL' as 'FULL' | 'READ' }));
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (_key: string, level: 'READ' | 'FULL' = 'READ') => level === 'READ' || perm.level === 'FULL' }),
}));

function renderPage(entry = '/trailers') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[entry]}>
          <TrailersPage />
        </MemoryRouter>
      </ToastProvider>
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
  perm.level = 'FULL';
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

/** Records the query string of every `GET /trailers` the page sends. */
function recordRequests() {
  const seen: URLSearchParams[] = [];
  server.use(
    http.get(url(endpoints.trailers.list), ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return undefined;
    }),
  );
  return seen;
}

describe('Trailers list (server-side)', () => {
  it('renders number, VIN and status columns from the first page', async () => {
    const seen = recordRequests();
    renderPage();
    expect(await screen.findByText('T-4471')).toBeInTheDocument();
    for (const header of ['TRAILER #', 'VIN', 'STATUS']) expect(screen.getByText(header)).toBeInTheDocument();
    expect(screen.getByText('1JJV532W7YL123456')).toBeInTheDocument();
    expect(screen.getByText('Out of service', { selector: 'span' })).toBeInTheDocument();
    expect(seen[0]?.get('page')).toBe('1');
    expect(seen[0]?.get('limit')).toBe('10');
  });

  it('sends the debounced search as q and shows the search empty state', async () => {
    const seen = recordRequests();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('T-4471');
    await user.type(screen.getByLabelText('Search trailer #, VIN'), 't-4472');
    await waitFor(() => expect(seen.some((p) => p.get('q') === 't-4472')).toBe(true));
    expect(await screen.findByText('T-4472')).toBeInTheDocument();
    expect(screen.queryByText('T-4471')).not.toBeInTheDocument();
    // keystrokes are debounced: far fewer requests than characters typed
    expect(seen.filter((p) => p.get('q')).length).toBeLessThan(6);
    await user.clear(screen.getByLabelText('Search trailer #, VIN'));
    await user.type(screen.getByLabelText('Search trailer #, VIN'), 'zzz');
    expect(await screen.findByText('Nothing matches "zzz"')).toBeInTheDocument();
  });

  it('sends the status filter', async () => {
    const seen = recordRequests();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('T-4471');
    await user.click(screen.getByRole('button', { name: 'Inactive' }));
    await waitFor(() => expect(seen.some((p) => p.get('status') === 'INACTIVE')).toBe(true));
    expect(await screen.findByText('T-4473')).toBeInTheDocument();
    expect(screen.queryByText('T-4471')).not.toBeInTheDocument();
  });

  it('pages on the server using ?limit= and ?page=', async () => {
    const seen = recordRequests();
    renderPage('/trailers?limit=2&page=2');
    expect(await screen.findByText('T-4473')).toBeInTheDocument();
    expect(screen.queryByText('T-4471')).not.toBeInTheDocument();
    expect(seen[0]?.get('page')).toBe('2');
    expect(seen[0]?.get('limit')).toBe('2');
  });

  it('sorts on the server when a header is clicked', async () => {
    const seen = recordRequests();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('T-4471');
    await user.click(screen.getByRole('button', { name: /TRAILER #/ }));
    await waitFor(() => expect(seen.some((p) => p.get('sort') === 'number:asc')).toBe(true));
    await user.click(screen.getByRole('button', { name: /TRAILER #/ }));
    await waitFor(() => expect(seen.some((p) => p.get('sort') === 'number:desc')).toBe(true));
  });

  it('ignores an invalid ?sort= instead of 422-ing', async () => {
    const seen = recordRequests();
    renderPage('/trailers?sort=color:asc');
    await screen.findByText('T-4471');
    expect(seen[0]?.has('sort')).toBe(false);
  });

  it('shows the verbatim empty state with both actions for a writer', async () => {
    server.use(http.get(url(endpoints.trailers.list), () => ok({ items: [], page: 1, limit: 10, total: 0, totalPages: 1 })));
    renderPage();
    expect(await screen.findByText('No trailers yet')).toBeInTheDocument();
    const empty = screen.getByText('No trailers yet').parentElement!;
    expect(within(empty).getByRole('button', { name: 'Import CSV' })).toBeInTheDocument();
    expect(within(empty).getByRole('button', { name: 'Add trailer' })).toBeInTheDocument();
  });

  it('shows the error state inside the card with a retry', async () => {
    server.use(http.get(url(endpoints.trailers.list), () => fail(500, 'INTERNAL', 'boom')));
    renderPage();
    expect(await screen.findByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
  });
});

describe('Trailers RBAC (vehicles key)', () => {
  it('FULL sees Add / Import / row actions', async () => {
    renderPage();
    await screen.findByText('T-4471');
    expect(screen.getByRole('button', { name: 'Add trailer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import Trailers' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /actions|more/i }).length).toBeGreaterThan(0);
  });

  it('READ keeps Export and search but the write controls are absent from the DOM', async () => {
    perm.level = 'READ';
    renderPage();
    await screen.findByText('T-4471');
    expect(screen.getByRole('button', { name: 'Export Trailers' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search trailer #, VIN')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add trailer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Import Trailers' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /actions|more/i })).not.toBeInTheDocument();
  });

  it('READ empty state has no actions', async () => {
    perm.level = 'READ';
    server.use(http.get(url(endpoints.trailers.list), () => ok({ items: [], page: 1, limit: 10, total: 0, totalPages: 1 })));
    renderPage();
    expect(await screen.findByText('No trailers yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add trailer' })).not.toBeInTheDocument();
  });
});
