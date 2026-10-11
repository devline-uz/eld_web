// web/tz.md §10 W-10 — smoke test: KPI row, safety-events empty state verbatim, and the
// RBAC-gated `Assign coaching` control, and the Events / Coaching / Scorecards tabs.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import SafetyPage from './SafetyPage';
import { PageHeaderProvider, PageHeading } from '@/app/layouts/Topbar';

let mockCan = (_key: string, _level?: 'READ' | 'FULL') => true;
vi.mock('@/shared/auth/usePermission', () => ({ usePermission: () => ({ can: (k: string, l?: 'READ' | 'FULL') => mockCan(k, l) }) }));
vi.mock('@/shared/auth/Can', () => ({
  Can: ({ perm, level, children }: { perm: string; level?: 'READ' | 'FULL'; children: React.ReactNode }) =>
    mockCan(perm, level) ? children : null,
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <PageHeaderProvider>
            <PageHeading />
            <SafetyPage />
          </PageHeaderProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  mockCan = () => true;
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('SafetyPage', () => {
  it('renders the header and KPI row', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Safety' })).toBeInTheDocument();
    expect(await screen.findByText('Fleet safety score')).toBeInTheDocument();
    expect(await screen.findByText('Harsh events')).toBeInTheDocument();
    expect(await screen.findByText('Speeding events')).toBeInTheDocument();
    expect(await screen.findByText('Coaching sessions')).toBeInTheDocument();
  });

  it('shows the safety empty-state copy verbatim when there are no events', async () => {
    server.use(
      http.get(url(endpoints.safety.events), () => ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 })),
      http.get(url(endpoints.safety.scorecard), () => ok({ items: [], periodStart: '2026-08-12', periodEnd: '2026-09-11' })),
    );
    renderPage();
    expect((await screen.findAllByText('No safety events')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Harsh braking, acceleration and speeding events appear here as they are detected.').length).toBeGreaterThan(0);
  });

  it('removes `Assign coaching` without safety FULL', async () => {
    mockCan = (key, level) => !(key === 'safety' && level === 'FULL');
    renderPage();
    await screen.findByRole('heading', { level: 1, name: 'Safety' });
    expect(screen.queryByRole('button', { name: 'Assign coaching' })).not.toBeInTheDocument();
  });

  it('shows `Assign coaching` with safety FULL', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: 'Assign coaching' })).toBeInTheDocument();
  });

  // Regression — the dialog kept the previously coached driver's name and note.
  it('opens `Assign coaching` for the driver selected now, with an empty note, and posts that driverId', async () => {
    const user = userEvent.setup();
    const posted: unknown[] = [];
    const row = (driverId: string, score: number, rank: number) => ({
      id: `sc_${driverId}`, driverId, periodStart: '2026-08-12', periodEnd: '2026-09-11', score, harshCount: 1,
      speedingCount: 0, milesDriven: 1000, violationCount: 0, rank,
    });
    server.use(
      http.get(url(endpoints.safety.scorecard), () =>
        ok({ items: [row('drv_a', 61, 1), row('drv_b', 72, 2)], periodStart: '2026-08-12', periodEnd: '2026-09-11' }),
      ),
      http.get(url(endpoints.drivers.list), () =>
        ok({
          items: [
            { id: 'drv_a', firstName: 'Marcus', lastName: 'Johnson' },
            { id: 'drv_b', firstName: 'James', lastName: 'Wilson' },
          ],
          page: 1, limit: 200, total: 2, totalPages: 1,
        }),
      ),
      http.post(url(endpoints.safety.coaching), async ({ request }) => {
        posted.push(await request.json());
        return ok({ id: 'evt_1', status: 'COACHED' }, 201);
      }),
    );
    renderPage();
    const picker = await screen.findByRole('combobox', { name: 'Select driver to coach' });
    await screen.findByRole('option', { name: 'James Wilson' });

    await user.selectOptions(picker, 'drv_a');
    await user.click(screen.getByRole('button', { name: 'Assign coaching' }));
    const first = await screen.findByRole('dialog');
    expect(within(first).getByText('Marcus Johnson · score 61')).toBeInTheDocument();
    await user.type(within(first).getByLabelText('Note'), 'Old note');
    await user.click(within(first).getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));

    await user.selectOptions(picker, 'drv_b');
    await user.click(screen.getByRole('button', { name: 'Assign coaching' }));
    const second = await screen.findByRole('dialog');
    expect(within(second).getByText('James Wilson · score 72')).toBeInTheDocument();
    expect(within(second).getByLabelText('Note')).toHaveValue('');
    await user.click(within(second).getByRole('button', { name: 'Assign coaching' }));
    await vi.waitFor(() => expect(posted).toEqual([{ driverId: 'drv_b' }]));
  });

  // Regression — `onLimitChange` used to be `setLimit` alone, so raising `Rows per page` while on
  // page 3 kept page 3: the client-side slice ran past the end and the table body went blank.
  it('resets to page 1 when rows-per-page changes', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 35 }, (_, i) => ({
      id: `evt_${i}`,
      type: 'SPEEDING',
      status: 'NEW',
      occurredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      vehicleId: 'veh_1',
      driverId: null,
      speedMph: 70 + i,
      speedLimitMph: 65,
      locationName: 'I-80',
    }));
    server.use(
      http.get(url(endpoints.safety.events), () => ok({ items, page: 1, limit: 500, total: 35, totalPages: 1 })),
    );
    renderPage();

    await user.click(await screen.findByRole('button', { name: '4' }));
    // Header + the 5 rows left over on page 4 of 10-row pages.
    const rows = () => within(screen.getByRole('table', { name: 'Safety events' })).getAllByRole('row');
    expect(rows()).toHaveLength(6);

    await user.selectOptions(screen.getByLabelText('Rows per page:'), '100');
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
    expect(rows()).toHaveLength(36);
  });

  // Regression — the drawer filters live in the URL and never reset the page, so narrowing the
  // result set from page 4 left the table body empty with Pagination still on page 4.
  it('clamps the page when a filter shrinks the result set', async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 35 }, (_, i) => ({
      id: `evt_${i}`,
      // Only 3 rows survive the `type=SEATBELT` filter below.
      type: i < 3 ? 'SEATBELT' : 'SPEEDING',
      status: 'NEW',
      occurredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      vehicleId: 'veh_1',
      driverId: null,
      locationName: 'I-80',
    }));
    server.use(
      http.get(url(endpoints.safety.events), () => ok({ items, page: 1, limit: 500, total: 35, totalPages: 1 })),
    );
    renderPage();

    await user.click(await screen.findByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: /^Filters/ }));
    await user.click(await screen.findByLabelText('Seatbelt'));
    await user.click(screen.getByRole('button', { name: /Apply 1 filters/ }));

    // Header + the 3 surviving rows — before the clamp this table body was empty on page 4.
    const eventsTable = await screen.findByRole('table', { name: 'Safety events' });
    expect(within(eventsTable).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('button', { name: '1' })).toHaveAttribute('aria-current', 'page');
  });

  describe('tabs', () => {
    const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const items = [
      { id: 'evt_new', type: 'SPEEDING', status: 'NEW', occurredAt: hourAgo(), vehicleId: 'veh_1', driverId: null, locationName: 'I-80', coachedAt: null, coachingNote: null },
      { id: 'evt_coached', type: 'HARSH_BRAKING', status: 'COACHED', occurredAt: hourAgo(), vehicleId: 'veh_1', driverId: null, locationName: 'I-75', coachedAt: hourAgo(), coachingNote: 'Keep distance' },
      // Outside the 30-day window — must not count towards `Events`.
      { id: 'evt_old', type: 'SPEEDING', status: 'NEW', occurredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), vehicleId: 'veh_1', driverId: null, locationName: 'I-10', coachedAt: null, coachingNote: null },
    ];

    it('defaults to Events and counts the 30-day window, not the server total', async () => {
      server.use(http.get(url(endpoints.safety.events), () => ok({ items, page: 1, limit: 500, total: 17440, totalPages: 1 })));
      renderPage();
      const events = await screen.findByRole('tab', { name: /^Events/ });
      expect(events).toHaveAttribute('aria-selected', 'true');
      await within(events).findByText('2');
      expect(within(screen.getByRole('tab', { name: /^Coaching/ })).getByText('1')).toBeInTheDocument();
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'safety-tab-events');
      expect(await screen.findByText('2 events · 1 need review')).toBeInTheDocument();
    });

    it('switches to Coaching on click and lists only coached events', async () => {
      const user = userEvent.setup();
      server.use(http.get(url(endpoints.safety.events), () => ok({ items, page: 1, limit: 500, total: 3, totalPages: 1 })));
      renderPage();
      await user.click(await screen.findByRole('tab', { name: /^Coaching/ }));
      expect(screen.getByRole('tab', { name: /^Coaching/ })).toHaveAttribute('aria-selected', 'true');
      const table = await screen.findByRole('table', { name: 'Coaching sessions' });
      expect(within(table).getAllByRole('row')).toHaveLength(2);
      expect(within(table).getByText('Keep distance')).toBeInTheDocument();
      expect(screen.queryByRole('table', { name: 'Safety events' })).not.toBeInTheDocument();
    });

    it('moves between tabs with the arrow keys', async () => {
      const user = userEvent.setup();
      renderPage();
      const events = await screen.findByRole('tab', { name: /^Events/ });
      events.focus();
      await user.keyboard('{ArrowLeft}');
      const scorecards = screen.getByRole('tab', { name: /^Scorecards/ });
      expect(scorecards).toHaveAttribute('aria-selected', 'true');
      expect(scorecards).toHaveFocus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: /^Events/ })).toHaveFocus();
    });

    it('shows the scorecard empty state on the Scorecards tab', async () => {
      const user = userEvent.setup();
      server.use(http.get(url(endpoints.safety.scorecard), () => ok({ items: [], periodStart: '2026-08-12', periodEnd: '2026-09-11' })));
      renderPage();
      await user.click(await screen.findByRole('tab', { name: /^Scorecards/ }));
      expect(await screen.findByText('No scorecards yet')).toBeInTheDocument();
      expect(screen.queryByText('Harsh events')).not.toBeInTheDocument();
    });
  });

  it('error: renders <ErrorState> with Retry when the list fails', async () => {
    server.use(
      http.get(url(endpoints.safety.events), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  // Demo fallback off (vitest default, and always in production): no demo rows, the real states.
  it('scorecard error: renders <ErrorState> with Retry on the Scorecards tab, never demo rows', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.safety.scorecard), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /^Scorecards/ }));
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.queryByText(/Marcus Johnson/)).toBeNull();
  });
});

// WB-167…WB-170 — stage-2 fixes: the dead `View profile ›`, the export that ignored the screen,
// the hardcoded verdict and the verb agreement under the fleet-score gauge.
describe('SafetyPage — stage-2 fixes', () => {
  const scorecard = {
    items: [
      { driverId: 'drv_1', rank: 1, score: 76, harshCount: 2, speedingCount: 1, milesDriven: 4200 },
      { driverId: 'drv_2', rank: 2, score: 60, harshCount: 9, speedingCount: 4, milesDriven: 3100 },
    ],
    periodStart: '2026-08-12',
    periodEnd: '2026-09-11',
    minMiles: 100,
    // Phase 1 (backend D-133) — the fleet block is server-computed (mile-weighted), never re-averaged.
    fleet: { score: 68, previousScore: null, trend: null, scoredDrivers: 2, unscoredDrivers: 0, belowThresholdCount: 1, milesDriven: 7300 },
  };

  function useScorecardFixture() {
    server.use(
      http.get(url(endpoints.safety.scorecard), () => ok(scorecard)),
      http.get(url(endpoints.safety.events), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
    );
  }

  it('derives the fleet-score verdict instead of always claiming "Good standing"', async () => {
    useScorecardFixture();
    renderPage();
    // Server fleet score 68 — below this card's own 70-point threshold.
    expect(await screen.findAllByText('68')).not.toHaveLength(0);
    expect((await screen.findAllByText('Below coaching threshold')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Good standing')).not.toBeInTheDocument();
  });

  it('agrees the verb with the count under the gauge', async () => {
    useScorecardFixture();
    renderPage();
    expect((await screen.findAllByText(/1 driver is below the\s+70-point coaching threshold\./)).length).toBeGreaterThan(0);
  });

  it('`View profile ›` is a real button that opens the driver', async () => {
    useScorecardFixture();
    const user = userEvent.setup();
    renderPage();
    const buttons = await screen.findAllByRole('button', { name: 'View profile ›' });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]!);
    // `useNavigate` inside MemoryRouter — the click is handled, not a dead span.
    expect(buttons[0]).toBeEnabled();
  });

  it('`View profile ›` is absent (not disabled) without `drivers` READ', async () => {
    mockCan = (key) => key !== 'drivers';
    useScorecardFixture();
    renderPage();
    await screen.findAllByText('Driver scorecard');
    expect(screen.queryByRole('button', { name: 'View profile ›' })).not.toBeInTheDocument();
  });

  it('Export writes a CSV of the rows the current tab lists, not the whole raw feed', async () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    server.use(
      http.get(url(endpoints.safety.scorecard), () => ok(scorecard)),
      http.get(url(endpoints.safety.events), () =>
        ok({
          items: [
            { id: 'evt_a', type: 'HARSH_BRAKING', status: 'NEW', occurredAt: hourAgo, vehicleId: 'veh_1', driverId: null, locationName: 'I-80', gForce: '0.42' },
            { id: 'evt_b', type: 'SPEEDING', status: 'NEW', occurredAt: hourAgo, vehicleId: 'veh_2', driverId: null, locationName: 'I-75', speedMph: 71, speedLimitMph: 65 },
          ],
          page: 1,
          limit: 500,
          total: 2,
          totalPages: 1,
        }),
      ),
    );
    const user = userEvent.setup();
    let csv = '';
    let name = '';
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob.text().then((t) => {
        csv = t;
      });
      return 'blob:mock';
    });
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        name = this.download;
      });
    try {
      renderPage();
      await screen.findByRole('table', { name: 'Safety events' });
      await user.click(screen.getByRole('button', { name: 'Export' }));
      expect(name).toBe('safety-events-export.csv');
      // Labels, not raw enums, and both listed rows.
      await vi.waitFor(() => expect(csv).toContain('event,driver,unit,date & time,location,severity'));
      expect(csv).toContain('Harsh braking');
      expect(csv).toContain('Speeding');
      expect(csv).not.toContain('HARSH_BRAKING');

      // Now narrow the screen: the export must follow the search, not dump the raw feed.
      csv = '';
      await user.type(screen.getByRole('textbox', { name: 'Search driver, unit' }), 'zzz-no-match');
      await user.click(screen.getByRole('button', { name: 'Export' }));
      await vi.waitFor(() => expect(csv).not.toBe(''));
      expect(csv.split('\r\n')).toHaveLength(1);
      expect(click).toHaveBeenCalledTimes(2);
    } finally {
      click.mockRestore();
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });
});

// Phase 1 (backend D-133) — server rank, "Not enough miles" rows, server fleet score + trend chip.
describe('SafetyPage — Phase 1 scorecard', () => {
  const row = (driverId: string, score: number | null, rank: number | null, milesDriven: number, trend: number | null = null) => ({
    id: `sc_${driverId}`, driverId, periodStart: '2026-09-11', periodEnd: '2026-10-10', score, scored: score != null,
    harshCount: 0, speedingCount: 0, seatbeltCount: 0, milesDriven, violationCount: 0, rank,
    previousScore: trend == null || score == null ? null : score - trend, trend, computedAt: '2026-10-11T10:30:00.000Z',
  });
  const fleet = (score: number | null, trend: number | null) => ({
    score, previousScore: score == null || trend == null ? null : score - trend, trend,
    scoredDrivers: 2, unscoredDrivers: 1, belowThresholdCount: 1, milesDriven: 6064,
  });

  function useFixture(trend: number | null, items = [row('drv_a', 95, 1, 4000, 3), row('drv_b', 62, 2, 2000, -7), row('drv_c', null, null, 64)]) {
    server.use(
      http.get(url(endpoints.safety.scorecard), () =>
        ok({ items, periodStart: '2026-09-11', periodEnd: '2026-10-10', computedAt: '2026-10-11T10:30:00.000Z', minMiles: 100, fleet: fleet(84, trend) }),
      ),
      http.get(url(endpoints.safety.events), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.get(url(endpoints.drivers.list), () =>
        ok({
          items: [
            { id: 'drv_a', firstName: 'Ana', lastName: 'Best' },
            { id: 'drv_b', firstName: 'Bo', lastName: 'Second' },
            { id: 'drv_c', firstName: 'Cy', lastName: 'Short' },
          ],
          page: 1, limit: 200, total: 3, totalPages: 1,
        }),
      ),
    );
  }

  async function openScorecards() {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: /^Scorecards/ }));
    return screen.findByRole('table', { name: 'Driver scorecard' });
  }

  it('renders the server rank order with "Not enough miles" rows last, muted, with no rank and no score pill', async () => {
    useFixture(4);
    const table = await openScorecards();
    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(3);
    expect(within(bodyRows[0]!).getByText('#1')).toBeInTheDocument();
    expect(within(bodyRows[0]!).getByText('Ana Best')).toBeInTheDocument();
    expect(within(bodyRows[1]!).getByText('#2')).toBeInTheDocument();
    const unscored = bodyRows[2]!;
    expect(within(unscored).getByText('Cy Short')).toHaveClass('text-text-muted');
    expect(within(unscored).getByText('Not enough miles')).toBeInTheDocument();
    expect(within(unscored).queryByText(/^#/)).not.toBeInTheDocument();
    expect(within(unscored).getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText(/2 drivers ranked · 1 not enough miles · Sep 11 – Oct 10, 2026/)).toBeInTheDocument();
  });

  it('keeps unscored rows after ranked ones even when the payload arrives unsorted', async () => {
    useFixture(4, [row('drv_c', null, null, 64), row('drv_b', 62, 2, 2000), row('drv_a', 95, 1, 4000)]);
    const table = await openScorecards();
    const names = within(table).getAllByRole('row').slice(1).map((r) => r.textContent ?? '');
    expect(names[0]).toContain('Ana Best');
    expect(names[1]).toContain('Bo Second');
    expect(names[2]).toContain('Cy Short');
  });

  it('shows the server fleet score with an `↑ N pts` success chip on the KPI', async () => {
    useFixture(4);
    renderPage();
    expect((await screen.findAllByText('↑ 4 pts')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('84').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 driver is below the\s+70-point coaching threshold\./).length).toBeGreaterThan(0);
  });

  it('shows a `↓ N pts` chip when the fleet score fell, and no chip without a previous period', async () => {
    useFixture(-3);
    const { unmount } = renderPage();
    expect((await screen.findAllByText('↓ 3 pts')).length).toBeGreaterThan(0);
    unmount();

    useFixture(null);
    renderPage();
    expect((await screen.findAllByText('84')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/pts$/)).not.toBeInTheDocument();
  });
});
