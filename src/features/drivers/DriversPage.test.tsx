// web/tz.md §10 W-06 — the exact §13.2 empty-state copy and a populated roster row (gap B-1,
// served by MSW per web/backend-gaps.md).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

/** Renders the current router location so navigation can be asserted without a route tree. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialEntries: string[] = ['/drivers']) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <DriversPage />
          <LocationProbe />
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
    ]) {
      await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
      await user.click(await screen.findByText(label));
    }

    await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
    await user.click(await screen.findByText('View driver profile'));
  });

  it("row menu Send message deep-links to that driver's conversation (WB-139)", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
    await user.click(await screen.findByText('Send message'));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/messages\?driverId=drv_1$/);
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

  // Regression — the segment tabs and the B-55 client-side filter groups used to narrow the
  // current server page in memory while the footer still reported the server's
  // `total`/`totalPages`: one visible row under "1–10 of 58 drivers", with 6 pages that each
  // re-filtered a different slice. OFF_DUTY now switches to the roster window (WB-103); this fixed
  // fixture does not vary by request params, so the window is the same two rows and the footer's
  // honest fallback (count exactly what was matched) still applies.
  it('the footer counts the rows on screen while a segment narrows the server page', async () => {
    // Only page 1 is stubbed (a genuine gap in this fixture, not a real backend) — the OFF_DUTY
    // window fetch walks the declared `totalPages` in parallel (WB-103) and must see every other
    // page as empty instead of the same two rows repeated.
    server.use(
      http.get(url(endpoints.drivers.roster), ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? 1);
        return ok({
          items: page === 1 ? [rosterEntry('drv_a', 'Ada', 'OFF_DUTY'), rosterEntry('drv_b', 'Bob', 'DRIVING')] : [],
          page,
          limit: 10,
          total: 58,
          totalPages: 6,
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ada Tester');
    expect(screen.getByText('1–10 of 58 drivers')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Off duty/ }));

    expect(await screen.findByText('1–1 of 1 drivers')).toBeInTheDocument();
    expect(screen.queryByText('1–10 of 58 drivers')).not.toBeInTheDocument();
  });

  // WB-103 — the OFF_DUTY segment tab used to filter only the loaded ~10-row server page, so a
  // match that lived on another page was invisible with no hint more existed. It now switches to
  // the reference-cached roster window (`useDriverRosterWindow`) and finds matches across what
  // would have been every server page.
  it('WB-103 — the OFF_DUTY segment tab narrows the whole roster window, not just the loaded page', async () => {
    const OFF_DUTY_IDX = [0, 5, 11];
    const roster = Array.from({ length: 12 }, (_, i) =>
      rosterEntry(`drv_${i}`, `Driver${i}`, OFF_DUTY_IDX.includes(i) ? 'OFF_DUTY' : 'DRIVING'),
    );
    server.use(
      http.get(url(endpoints.drivers.roster), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const limit = Number(params.get('limit') ?? 10);
        const page = Number(params.get('page') ?? 1);
        return ok({
          items: roster.slice((page - 1) * limit, page * limit),
          page,
          limit,
          total: roster.length,
          totalPages: Math.max(1, Math.ceil(roster.length / limit)),
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Driver0 Tester');
    // Row index 11 lives on what would be server page 2 (limit 10) — invisible to an in-memory
    // narrowing of page 1 alone.
    await user.click(screen.getByRole('button', { name: /Off duty/ }));

    expect(await screen.findByText('Driver11 Tester')).toBeInTheDocument();
    expect(screen.getByText('1–3 of 3 drivers')).toBeInTheDocument();
  });

  // WB-103 — same gap for the 11.23 drawer's "Status" field (duty status, no server param either).
  it('WB-103 — the 11.23 "status" filter narrows the whole roster window, not just the loaded page', async () => {
    const DRIVING_IDX = [0, 5, 11];
    const roster = Array.from({ length: 12 }, (_, i) =>
      rosterEntry(`drv_${i}`, `Driver${i}`, DRIVING_IDX.includes(i) ? 'DRIVING' : 'OFF_DUTY'),
    );
    server.use(
      http.get(url(endpoints.drivers.roster), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const limit = Number(params.get('limit') ?? 10);
        const page = Number(params.get('page') ?? 1);
        return ok({
          items: roster.slice((page - 1) * limit, page * limit),
          page,
          limit,
          total: roster.length,
          totalPages: Math.max(1, Math.ceil(roster.length / limit)),
        });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Driver0 Tester');

    await user.click(screen.getByRole('button', { name: /^Filters$/ }));
    await user.click(await screen.findByLabelText('Driving'));
    await user.click(screen.getByRole('button', { name: /Apply 1 filters/ }));

    expect(await screen.findByText('Driver11 Tester')).toBeInTheDocument();
    expect(screen.getByText('1–3 of 3 drivers')).toBeInTheDocument();
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

  // ---------------------------------------------------------------- stage-2 dead controls

  it('WB-182 · row menu `Export 8-day RODS` really queues the pack for that driver', async () => {
    const user = userEvent.setup();
    let query: URLSearchParams | null = null;
    server.use(
      http.get(url(endpoints.reports.fmcsaPack), ({ request }) => {
        query = new URL(request.url).searchParams;
        return ok({ reportId: 'rpt_1', status: 'QUEUED' }, 202);
      }),
    );
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
    await user.click(await screen.findByText('Export 8-day RODS'));

    expect(await screen.findByText('RODS export queued')).toBeInTheDocument();
    expect(query).not.toBeNull();
    expect(query!.get('driverId')).toBeTruthy();
    const from = Date.parse(`${query!.get('from')}T00:00:00Z`);
    const to = Date.parse(`${query!.get('to')}T00:00:00Z`);
    expect((to - from) / 86_400_000).toBe(7);
  });

  it('WB-183 · row menu `Deactivate driver` confirms first, then PATCHes the driver inactive', async () => {
    const user = userEvent.setup();
    const patched: Array<Record<string, unknown>> = [];
    server.use(
      http.patch(url(endpoints.drivers.update(':id')), async ({ request }) => {
        patched.push((await request.json()) as Record<string, unknown>);
        return ok({ id: 'drv_1', status: 'INACTIVE' });
      }),
    );
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
    await user.click(await screen.findByText('Deactivate driver'));
    // Nothing is written before the confirm (§5.9).
    expect(patched).toHaveLength(0);
    expect(await screen.findByText('Deactivate this driver?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    expect(await screen.findByText('1 driver deactivated')).toBeInTheDocument();
    expect(patched).toEqual([{ status: 'INACTIVE' }]);
  });

  it('WB-184 · the bulk bar deactivates every selected driver and reports a partial failure', async () => {
    const user = userEvent.setup();
    let seen = 0;
    server.use(
      http.patch(url(endpoints.drivers.update(':id')), () => {
        seen += 1;
        return seen === 1
          ? ok({ id: 'drv_1', status: 'INACTIVE' })
          : HttpResponse.json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'nope' }, { status: 500 });
      }),
    );
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getAllByRole('checkbox')[1]!);
    await screen.findByText('1 drivers selected');
    await user.click(screen.getAllByRole('checkbox')[2]!);
    await screen.findByText('2 drivers selected');

    await user.click(screen.getByRole('button', { name: 'Deactivate' }));
    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('1 of 2 drivers could not be deactivated')).toBeInTheDocument();
    expect(seen).toBe(2);
  });

  it('WB-184 · `Assign unit` is a single-row action and assigns through the real endpoint', async () => {
    const user = userEvent.setup();
    let assignedTo: string | null = null;
    server.use(
      http.post(url(endpoints.vehicles.assignDriver(':id')), async ({ request }) => {
        assignedTo = ((await request.json()) as { driverId: string }).driverId;
        return ok({ id: 'veh_1' });
      }),
    );
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getAllByRole('checkbox')[1]!);
    await screen.findByText('1 drivers selected');
    await user.click(screen.getAllByRole('checkbox')[2]!);
    expect(await screen.findByText('2 drivers selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign unit' })).toBeDisabled();
    expect(screen.getByText('A unit takes one driver — select a single row.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('checkbox')[2]!);
    await screen.findByText('1 drivers selected');
    await user.click(screen.getByRole('button', { name: 'Assign unit' }));

    const select = await screen.findByRole('combobox');
    const option = (await screen.findAllByRole('option')).find((o) => o.getAttribute('value'))!;
    await user.selectOptions(select, option.getAttribute('value')!);
    await user.click(screen.getByRole('button', { name: 'Assign unit' }));

    await screen.findByText(/assigned$/);
    expect(assignedTo).toBeTruthy();
  });

  it('B-81 shipped · `Reset app password` calls POST /drivers/:id/reset-password', async () => {
    server.use(http.post(url(endpoints.drivers.resetPassword('drv_1')), () => ok({ emailedTo: 'john.smith@example.com' })));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
    const item = await screen.findByText('Reset app password');
    expect(item).not.toHaveAttribute('data-disabled');
    await user.click(item);
    expect(await screen.findByText('Password reset emailed')).toBeInTheDocument();
  });

  it('WB-180 · `Assign trip` carries the driver into the Trips filter (`fDriver`)', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getAllByRole('button', { name: 'Row actions' })[0]!);
    await user.click(await screen.findByText('Assign trip'));

    expect(screen.getByTestId('location').textContent).toMatch(/^\/trips\?fDriver=.+/);
  });

  it('the search box is labelled and clears from its own button', async () => {
    const user = userEvent.setup();
    renderPage(['/drivers?q=smith']);
    await screen.findByText('John Smith');

    expect(screen.getByLabelText('Search drivers')).toHaveValue('smith');
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByLabelText('Search drivers')).toHaveValue('');
  });

  it('WB-181 · a failing driver export is toasted instead of failing silently', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.drivers.export), () =>
        HttpResponse.json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Export failed' }, { status: 500 }),
      ),
    );
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getByRole('button', { name: /Export Drivers/ }));
    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
  });

  it('bulk bar `Send message` with 2+ rows opens the broadcast modal, sends, toasts and clears the selection', async () => {
    const user = userEvent.setup();
    let sentTo: string[] = [];
    server.use(
      http.post(url(endpoints.conversations.broadcast), async ({ request }) => {
        sentTo = ((await request.json()) as { driverIds: string[] }).driverIds;
        return ok({ sent: sentTo.length, deliveries: [] });
      }),
    );
    renderPage();
    await screen.findByText('John Smith');

    await user.click(screen.getAllByRole('checkbox')[1]!);
    await screen.findByText('1 drivers selected');
    await user.click(screen.getAllByRole('checkbox')[2]!);
    await screen.findByText('2 drivers selected');

    await user.click(screen.getByRole('button', { name: 'Send message' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send message' });
    expect(within(dialog).getByText('2 drivers · each one receives it in their own conversation')).toBeInTheDocument();

    await user.type(within(dialog).getByRole('textbox', { name: /Message/ }), 'Fuel stop at exit 12.');
    await user.click(within(dialog).getByRole('button', { name: 'Send message' }));

    expect(await screen.findByText('Message sent to 2 drivers')).toBeInTheDocument();
    expect(sentTo).toHaveLength(2);
    expect(screen.queryByRole('dialog', { name: 'Send message' })).not.toBeInTheDocument();
    expect(screen.queryByText('2 drivers selected')).not.toBeInTheDocument();
  });
});
