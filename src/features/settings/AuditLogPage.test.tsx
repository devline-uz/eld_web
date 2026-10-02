// web/tz.md W-23 — the cursor window walk, client-side pagination (WB-270), the verbatim empty
// copy, the in-card error, the row-click drawer, and the `auditLog`-gated CSV export.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
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

function tree(route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>
          <AuditLogPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

function renderPage(route = '/settings/audit-log') {
  return render(tree(route));
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

  it('walks the cursor chunks automatically (no Load more) and opens the before/after drawer', async () => {
    const user = userEvent.setup();
    const requests: URLSearchParams[] = [];
    server.use(
      http.get(url(endpoints.auditLog.list), ({ request }) => {
        const search = new URL(request.url).searchParams;
        requests.push(search);
        const cursor = search.get('cursor');
        if (!cursor) return ok({ items: [entry('1', 'UPDATE', 'Role · Dispatcher')], nextCursor: 'cursor-2' });
        if (cursor === 'cursor-2') return ok({ items: [entry('2', 'CREATE', 'Role · Auditor')], nextCursor: 'cursor-3' });
        return ok({ items: [entry('3', 'DELETE', 'Role · Old role')], nextCursor: null });
      }),
    );

    renderPage();
    expect(await screen.findByText('Role · Old role')).toBeInTheDocument();
    expect(screen.getByText('Role · Dispatcher')).toBeInTheDocument();
    expect(screen.getByText('Role · Auditor')).toBeInTheDocument();
    expect(requests.map((r) => r.get('cursor'))).toEqual([null, 'cursor-2', 'cursor-3']);
    // Each chunk asks for the server's own ceiling, never an unbounded page.
    expect(requests.every((r) => r.get('limit') === '200')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(await screen.findByText(/1–3 of 3 entries/)).toBeInTheDocument();

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

  it('WB-111 / WB-270 — CSV export honours the action filter and covers the page shown, without a new request', async () => {
    const user = userEvent.setup();
    let calls = 0;
    const rows = [
      entry('1', 'UPDATE', 'Role · Dispatcher'),
      ...Array.from({ length: 12 }, (_, i) => entry(`c${i}`, 'CREATE', `User · U${i}`)),
    ];
    server.use(
      http.get(url(endpoints.auditLog.list), () => {
        calls += 1;
        return ok({ items: rows, nextCursor: null });
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
    expect(await screen.findByText(/1–10 of 12 entries/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() => expect(capturedBlob).not.toBeNull());
    expect(calls).toBe(1);

    const text = await capturedBlob!.text();
    expect(text).toContain('User · U0');
    expect(text).toContain('User · U9');
    // Page 2 and the filtered-out row are not on the page shown.
    expect(text).not.toContain('User · U10');
    expect(text).not.toContain('Role · Dispatcher');
  });

  it('gates Export CSV on the auditLog permission', async () => {
    server.use(http.get(url(endpoints.auditLog.list), () => ok({ items: [], nextCursor: null })));
    const { rerender } = renderPage();
    expect(await screen.findByRole('button', { name: /export csv/i })).toBeInTheDocument();

    auditLogPerm = false;
    rerender(tree('/settings/audit-log'));
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

  it('drops the hint once every entry is loaded', async () => {
    server.use(
      http.get(url(endpoints.auditLog.list), () => ok({ items: [entry('a1', 'UPDATE', 'Dispatcher role')], nextCursor: null })),
    );
    renderPage();
    await screen.findByText('Dispatcher role');
    expect(screen.queryByText(/not loaded/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load older entries' })).not.toBeInTheDocument();
  });

  it('never loops on a repeated cursor', async () => {
    let calls = 0;
    server.use(
      http.get(url(endpoints.auditLog.list), ({ request }) => {
        calls += 1;
        const id = new URL(request.url).searchParams.get('cursor') ? 'a2' : 'a1';
        return ok({ items: [entry(id, 'UPDATE', 'Dispatcher role')], nextCursor: 'a1' });
      }),
    );
    renderPage();
    await screen.findAllByText('Dispatcher role');
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(2);
  });

  it('stops at the window limit, says so, and Load older entries extends the window', async () => {
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
    expect(
      await screen.findByText(/Showing the 5 most recent entries — older entries in the selected date range are not loaded yet/),
    ).toBeInTheDocument();
    // 1000 entries / 200 per request = 5 requests, never more.
    expect(calls).toBe(5);
    await user.click(screen.getByRole('button', { name: 'Load older entries' }));
    expect(await screen.findByText(/Showing the 10 most recent entries/)).toBeInTheDocument();
    expect(calls).toBe(10);
  });

  it('shows a live count with Stop, and Stop ends the walk', async () => {
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
    expect(await screen.findByText('Searching older entries… 1 entries searched so far.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText(/Search stopped after 1 entries/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Stop' })).not.toBeInTheDocument();
    release();
    await new Promise((r) => setTimeout(r, 50));
    expect(calls).toBe(2);
  });

  it('stops fetching once the loaded chunks reach past the start of the date range', async () => {
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

// WB-270 — `Export CSV` uses the app's export icon (Lucide `Upload`), like DVIR/Vehicles.
describe('WB-270 export icon', () => {
  it('Export CSV renders the Upload icon, not Download', async () => {
    server.use(http.get(url(endpoints.auditLog.list), () => ok({ items: [], nextCursor: null })));
    renderPage();
    const button = await screen.findByRole('button', { name: /export csv/i });
    expect(button.querySelector('svg.lucide-upload')).not.toBeNull();
    expect(button.querySelector('svg.lucide-download')).toBeNull();
  });
});

// WB-270 — the shared Pagination (10/25/50/100, `?page=&limit=`) replaces `Load more` and the
// >500-row virtualisation (WD-102): a page never renders more than 100 rows.
describe('WB-270 audit log pagination', () => {
  const rows = Array.from({ length: 23 }, (_, i) =>
    i < 3 ? entry(`d${i}`, 'DELETE', `Role · D${i}`) : entry(`u${i}`, 'UPDATE', `Role · R${i}`),
  );
  beforeEach(() => {
    server.use(http.get(url(endpoints.auditLog.list), () => ok({ items: rows, nextCursor: null })));
  });
  const pager = async (summary: RegExp) => (await screen.findByText(summary)).closest('.border-t') as HTMLElement;
  const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').length - 1;

  it('shows 10 rows per page and moves between pages', async () => {
    const user = userEvent.setup();
    renderPage();
    const bar = await pager(/1–10 of 23 entries/);
    expect(bodyRows()).toBe(10);
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();

    await user.click(within(bar).getByRole('button', { name: '3' }));
    await pager(/21–23 of 23 entries/);
    expect(bodyRows()).toBe(3);
    expect(screen.getByText('Role · R22')).toBeInTheDocument();

    await user.click(within(bar).getByRole('button', { name: 'Previous page' }));
    await pager(/11–20 of 23 entries/);
  });

  it('a new page size re-pages from page 1', async () => {
    const user = userEvent.setup();
    renderPage('/settings/audit-log?page=2');
    const bar = await pager(/11–20 of 23 entries/);
    await user.selectOptions(within(bar).getByLabelText('Rows per page:'), '25');
    await pager(/1–23 of 23 entries/);
    expect(bodyRows()).toBe(23);
  });

  it('a filter or search change resets to page 1', async () => {
    const user = userEvent.setup();
    renderPage('/settings/audit-log?page=2');
    await pager(/11–20 of 23 entries/);
    await user.selectOptions(screen.getByLabelText('Filter by action'), 'UPDATE');
    await pager(/1–10 of 20 entries/);

    await user.click(within(await pager(/1–10 of 20 entries/)).getByRole('button', { name: '2' }));
    await pager(/11–20 of 20 entries/);
    await user.type(screen.getByPlaceholderText('Search action, object or user…'), 'role');
    await pager(/1–10 of 20 entries/);
  });

  it('a page past the end snaps back to the last page', async () => {
    renderPage('/settings/audit-log?page=9');
    await pager(/21–23 of 23 entries/);
    expect(bodyRows()).toBe(3);
  });

  it('caps a hand-written page size at 100 rows and renders no virtual-row attributes', async () => {
    const many = Array.from({ length: 150 }, (_, i) => entry(`m${i}`, 'UPDATE', `Role · M${i}`));
    server.use(http.get(url(endpoints.auditLog.list), () => ok({ items: many, nextCursor: null })));
    renderPage('/settings/audit-log?limit=500');
    await pager(/1–100 of 150 entries/);
    expect(bodyRows()).toBe(100);
    expect(screen.getByRole('table')).not.toHaveAttribute('aria-rowcount');
  });
});
