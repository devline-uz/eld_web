// web/tz.md W-23 — cursor pagination (both `Load more` steps), the verbatim empty copy, the
// in-card error, the row-click drawer, and the `auditLog`-gated CSV export.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, fail, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import AuditLogPage from './AuditLogPage';

let auditLogPerm = true;
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (key: string) => (key === 'auditLog' ? auditLogPerm : true) }),
}));
vi.mock('@/shared/auth/Can', () => ({
  Can: ({ perm, children }: { perm: string; children: React.ReactNode }) =>
    (perm === 'auditLog' ? auditLogPerm : true) ? children : null,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuditLogPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

function entry(id: string, action: string, objectLabel: string) {
  return {
    id,
    createdAt: new Date().toISOString(),
    actorType: 'USER' as const,
    actorName: 'Sarah Chen',
    action,
    objectType: 'Role',
    objectLabel,
    details: 'Changed permission level',
    before: { roles: 'READ' },
    after: { roles: 'FULL' },
    traceId: 'trace-1',
    userAgent: 'vitest',
    ipAddress: '10.0.0.1',
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  auditLogPerm = true;
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(http.get(url(endpoints.carrier.root), () => ok({ id: 'carrier', name: 'Acme', timezone: 'America/New_York', erodsMode: 'TEST' })));
});

describe('AuditLogPage — W-23', () => {
  it('shows the exact §13.2 empty-state copy', async () => {
    server.use(http.get(url(endpoints.auditLog.list), () => ok({ items: [], nextCursor: null })));
    renderPage();
    expect(await screen.findByText('No events match these filters')).toBeInTheDocument();
    expect(screen.getByText('Try a wider date range or clear the filters.')).toBeInTheDocument();
  });

  it('shows an in-card error with Retry on failure, and Retry re-fetches', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.auditLog.list), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    const retryButton = await screen.findByText('Retry', {}, { timeout: 8000 });
    server.resetHandlers();
    server.use(http.get(url(endpoints.carrier.root), () => ok({ id: 'carrier', name: 'Acme', timezone: 'America/New_York', erodsMode: 'TEST' })));
    server.use(http.get(url(endpoints.auditLog.list), () => ok({ items: [], nextCursor: null })));
    await user.click(retryButton);
    expect(await screen.findByText('No events match these filters')).toBeInTheDocument();
  });

  it('paginates forward across two cursors and opens the before/after drawer', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.auditLog.list), ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (!cursor) return ok({ items: [entry('1', 'UPDATE', 'Role · Dispatcher')], nextCursor: 'cursor-2' });
        if (cursor === 'cursor-2') return ok({ items: [entry('2', 'CREATE', 'Role · Auditor')], nextCursor: 'cursor-3' });
        return ok({ items: [entry('3', 'DELETE', 'Role · Old role')], nextCursor: null });
      }),
    );

    renderPage();
    expect(await screen.findByText('Role · Dispatcher')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Role · Auditor')).toBeInTheDocument();
    // Forward accumulation keeps the earlier page visible.
    expect(screen.getByText('Role · Dispatcher')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Role · Old role')).toBeInTheDocument();
    // The server signalled a terminal page (`nextCursor: null`) — no further `Load more`.
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();

    await user.click(screen.getByText('Role · Dispatcher'));
    expect(await screen.findByText('Trace ID: trace-1')).toBeInTheDocument();
  });

  it('filters the loaded page by search text', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.auditLog.list), () =>
        ok({ items: [entry('1', 'UPDATE', 'Role · Dispatcher'), entry('2', 'CREATE', 'User · Anna Weiss')], nextCursor: null }),
      ),
    );
    renderPage();
    await screen.findByText('Role · Dispatcher');
    await user.type(screen.getByPlaceholderText('Search action, object or user…'), 'anna');
    expect(screen.queryByText('Role · Dispatcher')).not.toBeInTheDocument();
    expect(screen.getByText('User · Anna Weiss')).toBeInTheDocument();
  });

  it('exports the visible page to a CSV file', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.auditLog.list), () => ok({ items: [entry('1', 'UPDATE', 'Role · Dispatcher')], nextCursor: null })));
    const createObjectURL = vi.fn(() => 'blob:mock');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    renderPage();
    await screen.findByText('Role · Dispatcher');
    await user.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  });

  it('WB-111 — CSV export honours the active action filter and forwards the server-side params', async () => {
    const user = userEvent.setup();
    const exportRequests: URLSearchParams[] = [];
    server.use(
      http.get(url(endpoints.auditLog.list), ({ request }) => {
        const search = new URL(request.url).searchParams;
        if (search.get('limit') === '200') exportRequests.push(search);
        return ok({
          items: [entry('1', 'UPDATE', 'Role · Dispatcher'), entry('2', 'CREATE', 'User · Anna Weiss')],
          nextCursor: null,
        });
      }),
    );
    let capturedBlob: Blob | null = null;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return 'blob:mock';
    });
    URL.revokeObjectURL = vi.fn();

    renderPage();
    await screen.findByText('Role · Dispatcher');

    await user.selectOptions(screen.getByLabelText('Filter by action'), 'CREATE');
    expect(screen.queryByText('Role · Dispatcher')).not.toBeInTheDocument();
    expect(screen.getByText('User · Anna Weiss')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() => expect(exportRequests.length).toBe(1));

    const text = await capturedBlob!.text();
    expect(text).toContain('User · Anna Weiss');
    expect(text).not.toContain('Role · Dispatcher');
  });

  it('gates Export CSV on the auditLog permission', async () => {
    server.use(http.get(url(endpoints.auditLog.list), () => ok({ items: [], nextCursor: null })));
    const { rerender } = renderPage();
    expect(await screen.findByRole('button', { name: /export csv/i })).toBeInTheDocument();

    auditLogPerm = false;
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToastProvider>
          <AuditLogPage />
        </ToastProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.queryByRole('button', { name: /export csv/i })).not.toBeInTheDocument());
  });
});

/* ------------------------------------------------------------------ stage-2 */

describe('AuditLogPage — stage-2', () => {
  it('gives the search box an accessible name and shows an audit-specific error card', async () => {
    server.use(http.get(url(endpoints.auditLog.list), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    expect(await screen.findByText('Could not load the audit log')).toBeInTheDocument();
    expect(screen.queryByText('Could not load the fleet')).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search action, object or user' })).toBeInTheDocument();
  });

  it('says the local filters only cover the loaded entries while older pages exist (B-64)', async () => {
    server.use(
      http.get(url(endpoints.auditLog.list), () =>
        ok({ items: [entry('a1', 'UPDATE', 'Dispatcher role')], nextCursor: 'a1' }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/apply to the 1 entries loaded so far/)).toBeInTheDocument();
  });

  it('drops the hint once every page is loaded', async () => {
    server.use(
      http.get(url(endpoints.auditLog.list), () => ok({ items: [entry('a1', 'UPDATE', 'Dispatcher role')], nextCursor: null })),
    );
    renderPage();
    await screen.findByText('Dispatcher role');
    expect(screen.queryByText(/entries loaded so far/)).not.toBeInTheDocument();
  });

  // B-64 web side — while a local filter is active, older pages are fetched automatically.
  it('fetches older pages automatically while searching, without Load more', async () => {
    const user = userEvent.setup();
    const cursors: (string | null)[] = [];
    server.use(
      http.get(url(endpoints.auditLog.list), ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        if (!cursor) return ok({ items: [entry('1', 'UPDATE', 'Role · Dispatcher')], nextCursor: 'c2' });
        if (cursor === 'c2') return ok({ items: [entry('2', 'CREATE', 'Role · Auditor')], nextCursor: 'c3' });
        return ok({ items: [entry('3', 'DELETE', 'User · Anna Weiss')], nextCursor: null });
      }),
    );
    renderPage();
    await screen.findByText('Role · Dispatcher');
    expect(cursors).toEqual([null]);
    await user.type(screen.getByPlaceholderText('Search action, object or user…'), 'anna');
    expect(await screen.findByText('User · Anna Weiss')).toBeInTheDocument();
    expect(cursors).toEqual([null, 'c2', 'c3']);
    expect(screen.queryByText(/entries loaded so far/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    // Clearing the search keeps the pages already fetched.
    await user.clear(screen.getByPlaceholderText('Search action, object or user…'));
    expect(screen.getByText('Role · Auditor')).toBeInTheDocument();
  });

  it('stops at the automatic-search cap and says older entries are not covered', async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get(url(endpoints.auditLog.list), ({ request }) => {
        calls += 1;
        const cursor = new URL(request.url).searchParams.get('cursor') ?? 'p0';
        const n = Number(cursor.slice(1));
        return ok({ items: [entry(`e${n}`, 'UPDATE', `Entry ${n}`)], nextCursor: `p${n + 1}` });
      }),
    );
    renderPage();
    await screen.findByText('Entry 0');
    await user.selectOptions(screen.getByLabelText('Filter by action'), 'DELETE');
    expect(
      await screen.findByText(/Searched the 20 most recent entries \(the automatic search limit\)/, {}, { timeout: 15000 }),
    ).toBeInTheDocument();
    // 1000 entries / 50 per page = 20 pages, never more.
    expect(calls).toBe(20);
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
  }, 20000);

  it('shows a live count with Stop, and Stop ends the automatic search', async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    server.use(
      http.get(url(endpoints.auditLog.list), async ({ request }) => {
        calls += 1;
        const cursor = new URL(request.url).searchParams.get('cursor');
        if (!cursor) return ok({ items: [entry('1', 'UPDATE', 'Role · Dispatcher')], nextCursor: 'c2' });
        await gate;
        return ok({ items: [entry('2', 'CREATE', 'Role · Auditor')], nextCursor: 'c3' });
      }),
    );
    renderPage();
    await screen.findByText('Role · Dispatcher');
    await user.type(screen.getByPlaceholderText('Search action, object or user…'), 'zzz');
    expect(await screen.findByText('Searching older entries… 1 entries searched so far.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText(/Search stopped after 1 entries/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    release();
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(2);
  });

  it('stops fetching once the loaded pages reach past the start of the date range', async () => {
    const user = userEvent.setup();
    const old = { ...entry('2', 'DELETE', 'Role · Ancient'), createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString() };
    const cursors: (string | null)[] = [];
    server.use(
      http.get(url(endpoints.auditLog.list), ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);
        if (!cursor) return ok({ items: [entry('1', 'UPDATE', 'Role · Dispatcher')], nextCursor: 'c2' });
        return ok({ items: [old], nextCursor: 'c3' });
      }),
    );
    renderPage();
    await screen.findByText('Role · Dispatcher');
    await user.selectOptions(screen.getByLabelText('Filter by action'), 'DELETE');
    expect(await screen.findByText('Searched every entry in the selected date range (2 loaded).')).toBeInTheDocument();
    expect(cursors).toEqual([null, 'c2']);
  });
});
