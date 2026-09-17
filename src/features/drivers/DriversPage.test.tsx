// web/tz.md §10 W-06 — the exact §13.2 empty-state copy and a populated roster row (gap B-1,
// served by MSW per web/backend-gaps.md).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import DriversPage from './DriversPage';

vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: () => true }) }));

/** One `DriverRosterEntry` (B-1 shape) — enough for the paging regressions below. */
function rosterEntry(id: string, firstName: string, dutyStatus: 'DRIVING' | 'ON_DUTY' | 'SLEEPER' | 'OFF_DUTY') {
  return {
    driver: {
      id,
      username: firstName.toLowerCase(),
      firstName,
      lastName: 'Tester',
      homeTerminalName: 'Columbus, OH',
      appVersion: 'v2.24',
      email: null,
      eldExempt: false,
      allowPersonalConveyance: false,
      allowYardMove: false,
      shortHaulException: false,
      splitSleeperEnabled: false,
    },
    dutyStatus,
    unit: null,
    hos: { driveRemainingSec: 3600, shiftRemainingSec: 3600, cycleRemainingSec: 3600 },
    openViolations: 0,
    emailVerified: null,
  };
}

function renderPage(initialEntries: string[] = ['/drivers']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <DriversPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('W-06 Drivers', () => {
  it('renders the exact §13.2 empty-state copy when the roster is empty', async () => {
    server.use(
      http.get(url(endpoints.drivers.roster), () => ok({ items: [], page: 1, limit: 10, total: 0, totalPages: 1 })),
    );

    renderPage();

    expect(await screen.findByText('No drivers yet')).toBeInTheDocument();
    expect(
      screen.getByText('Add drivers so they can sign in to the mobile app and start logging hours.'),
    ).toBeInTheDocument();
  });

  it('renders a roster row with HOS meters, unit and violations from the B-1 shape', async () => {
    renderPage();

    expect(await screen.findByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText('#101')).toBeInTheDocument();
    expect(screen.getByText('1 open')).toBeInTheDocument();
  });

  it('switches segments, opens the row menu and shows the bulk bar', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('John Smith');

    await user.click(screen.getByRole('button', { name: /Violations/ }));
    expect(await screen.findByText('John Smith')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^All/ }));

    await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
    expect(await screen.findByText('View driver profile')).toBeInTheDocument();
    expect(screen.getByText('Open HOS logs')).toBeInTheDocument();
    expect(screen.getByText('Send message')).toBeInTheDocument();
    expect(screen.getByText('Assign trip')).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Request log edit')).toBeInTheDocument();
    expect(screen.getByText('Certify on behalf')).toBeInTheDocument();
    expect(screen.getByText('Export 8-day RODS')).toBeInTheDocument();
    expect(screen.getByText('Reset app password')).toBeInTheDocument();
    expect(screen.getByText('Deactivate driver')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);
    expect(await screen.findByText('1 drivers selected')).toBeInTheDocument();
    expect(screen.getByText('Assign unit')).toBeInTheDocument();
    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
  });

  it('the search box, every row-menu item and the Logs button all reach their handler', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('John Smith');

    // §6.9 `q` is forwarded to the (mocked) roster endpoint — this only exercises the onChange
    // handler and the URL param write, since MSW's roster fixture does not filter by query.
    await user.type(screen.getByPlaceholderText('Search driver, username…'), 'smith');
    await screen.findByText('John Smith');

    await user.click(screen.getAllByRole('button', { name: 'Logs' })[0]!);

    for (const label of [
      'Open HOS logs',
      'Send message',
      'Assign trip',
      'Request log edit',
      'Certify on behalf',
      'Export 8-day RODS',
      'Reset app password',
    ]) {
      await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
      await user.click(await screen.findByText(label));
    }

    await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
    await user.click(await screen.findByText('View driver profile'));
  });

  it('11.23 Filters — "open violations only" narrows the roster, shows a chip and Clear all resets it', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getByRole('button', { name: /^Filters$/ }));
    await user.click(await screen.findByText('Only drivers with open violations'));
    await user.click(screen.getByRole('button', { name: /Apply 1 filters/ }));

    expect(screen.queryByText('Kristin Watson')).not.toBeInTheDocument();
    expect(screen.getByText(/Filters · 1/)).toBeInTheDocument();
    expect(screen.getByText(/Open violations only/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(await screen.findByText('Kristin Watson')).toBeInTheDocument();
  });

  // Regression — the segment tabs and the B-55 client-side filter groups narrow the current server
  // page in memory, but the footer used to report the server's `total`/`totalPages`: one visible
  // row under "1–10 of 58 drivers", with 6 pages that each re-filtered a different slice.
  it('the footer counts the rows on screen while a segment narrows the server page', async () => {
    server.use(
      http.get(url(endpoints.drivers.roster), () =>
        ok({
          items: [rosterEntry('drv_a', 'Ada', 'OFF_DUTY'), rosterEntry('drv_b', 'Bob', 'DRIVING')],
          page: 1,
          limit: 10,
          total: 58,
          totalPages: 6,
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ada Tester');
    expect(screen.getByText('1–10 of 58 drivers')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Off duty/ }));

    expect(await screen.findByText('1–1 of 1 drivers')).toBeInTheDocument();
    expect(screen.queryByText('1–10 of 58 drivers')).not.toBeInTheDocument();
  });

  // Regression — `Number('abc')` is `NaN` and `?page=0` / `?page=-3` stay out of range, and all
  // three went out on the wire as `GET /drivers/roster?page=NaN|0|-3` (and into the query key).
  // Asserted on the request, not on the footer: `<Pagination>` clamps its own display.
  it('an invalid ?page= asks the server for page 1', async () => {
    const requestedPages: (string | null)[] = [];
    server.use(
      http.get(url(endpoints.drivers.roster), ({ request }) => {
        requestedPages.push(new URL(request.url).searchParams.get('page'));
        return ok({
          items: [rosterEntry('drv_a', 'Ada', 'DRIVING')],
          page: 1,
          limit: 10,
          total: 58,
          totalPages: 3,
        });
      }),
    );

    renderPage(['/drivers?page=abc']);

    await screen.findByText('Ada Tester');
    expect(requestedPages).toContain('1');
    expect(requestedPages.some((p) => p === null || !Number.isInteger(Number(p)) || Number(p) < 1)).toBe(false);
  });

  // Regression — a `page` past the end of the roster came back empty and the card showed the
  // "No drivers yet" empty state over a full roster.
  it('a ?page= past the last roster page snaps back instead of showing the empty state', async () => {
    server.use(
      http.get(url(endpoints.drivers.roster), ({ request }) => {
        const requested = Number(new URL(request.url).searchParams.get('page') ?? '1');
        return ok({
          items: requested > 3 ? [] : [rosterEntry('drv_a', 'Ada', 'DRIVING')],
          page: requested,
          limit: 10,
          total: 58,
          totalPages: 3,
        });
      }),
    );

    renderPage(['/drivers?page=9']);

    expect(await screen.findByText('Ada Tester')).toBeInTheDocument();
    expect(screen.queryByText('No drivers yet')).not.toBeInTheDocument();
  });

  // Regression — the headline and the segment tabs counted the ~10 rows of the *current server
  // page*: `All 10 | On duty 8 | Off duty 2` under a "115 drivers" headline (the first number came
  // from the server's `total`, the other two from the page). Every counter now describes the whole
  // server-filtered roster, so `All` = `On duty` + `Off duty`.
  it('the segment tabs count the whole roster, not the loaded server page', async () => {
    const ALL = 25;
    const OFF_DUTY = 9;
    const VIOLATIONS = 4;
    const roster = Array.from({ length: ALL }, (_, i) => {
      const entry = rosterEntry(`drv_${i}`, `Driver${i}`, i < OFF_DUTY ? 'OFF_DUTY' : 'DRIVING');
      entry.openViolations = i < VIOLATIONS ? 1 : 0;
      return entry;
    });
    const requestedLimits: (string | null)[] = [];
    server.use(
      http.get(url(endpoints.drivers.roster), ({ request }) => {
        const params = new URL(request.url).searchParams;
        requestedLimits.push(params.get('limit'));
        const limit = Number(params.get('limit') ?? 10);
        const page = Number(params.get('page') ?? 1);
        return ok({
          items: roster.slice((page - 1) * limit, page * limit),
          page,
          limit,
          total: ALL,
          totalPages: Math.max(1, Math.ceil(ALL / limit)),
        });
      }),
    );

    renderPage();

    // The table still renders one 10-row server page…
    expect(await screen.findByText('Driver0 Tester')).toBeInTheDocument();
    expect(screen.getByText('1–10 of 25 drivers')).toBeInTheDocument();

    // …while every counter describes all 25 drivers.
    expect(await screen.findByRole('button', { name: 'All 25' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `On duty ${ALL - OFF_DUTY}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Off duty ${OFF_DUTY}` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Violations ${VIOLATIONS}` })).toBeInTheDocument();
    expect(screen.getByText(`25 drivers · ${ALL - OFF_DUTY} on duty · ${VIOLATIONS} with active violations`)).toBeInTheDocument();
    // The counters read the roster in one pass instead of the table's 10-row page.
    expect(requestedLimits.some((l) => Number(l) > 10)).toBe(true);
  });

  // The same invariant against the full MSW roster (58 drivers, 6 server pages of 10).
  it('All equals On duty + Off duty across the whole mocked roster', async () => {
    renderPage();

    await screen.findByRole('button', { name: 'All 58' });
    const number = (el: HTMLElement) => Number(/\d+/.exec(el.textContent ?? '')![0]);
    const onDuty = screen.getByRole('button', { name: /^On duty \d+$/ });
    const offDuty = screen.getByRole('button', { name: /^Off duty \d+$/ });

    expect(number(onDuty) + number(offDuty)).toBe(58);
    expect(screen.getByText(new RegExp(`^58 drivers · ${number(onDuty)} on duty · `))).toBeInTheDocument();
  });

  it('error: renders <ErrorState> with Retry when the list fails', async () => {
    server.use(
      http.get(url(endpoints.drivers.roster), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
