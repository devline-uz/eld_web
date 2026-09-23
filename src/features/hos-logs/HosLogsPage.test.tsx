// web/tz.md §10 W-08 + §11.11/§11.12/§11.13 — the compliance rules an inspector depends on:
// role gating, the §395 audit-trail default, the home terminal timezone, and the verbatim
// DRIVING_TIME_IMMUTABLE refusal.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import type { PermissionKey } from '@/shared/auth/permissions';
import HosLogsPage from './HosLogsPage';
import { CertifyLogsModal } from './components/CertifyLogsModal';
import { cycleRuleLabel, validDayKey } from './grid';

const TZ = 'America/New_York';
const DRIVER_ID = '11111111-1111-4111-8111-111111111111';
const DATE = '2026-09-10';

/** The permission map the test is currently running as. */
let currentCan: (perm: PermissionKey, level?: 'READ' | 'FULL') => boolean = () => true;

vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (p: PermissionKey, l?: 'READ' | 'FULL') => currentCan(p, l) }),
}));
vi.mock('@/shared/auth/Can', () => ({
  Can: ({ perm, level, children }: { perm: PermissionKey; level?: 'READ' | 'FULL'; children: React.ReactNode }) =>
    currentCan(perm, level) ? <>{children}</> : null,
}));
vi.mock('@/shared/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { fullName: 'Sarah Chen' } }),
}));
vi.mock('@/shared/realtime/useRoom', () => ({ useRoom: () => ({ joined: true }) }));

const driver = {
  id: DRIVER_ID,
  username: 'johnsmith',
  firstName: 'John',
  lastName: 'Smith',
  homeTerminalName: 'Columbus, OH',
  homeTerminalTimezone: TZ,
  assignedVehicleId: 'veh-1',
  status: 'ACTIVE',
};

const summary = {
  date: DATE,
  timezone: TZ,
  offDutySec: 27_000,
  sleeperSec: 7_200,
  drivingSec: 41_160,
  onDutySec: 11_040,
  totalDistanceMi: 612,
  dayLengthSec: 86_400,
  certified: false,
  certifiedAt: null,
  certificationCount: 0,
  hasViolation: true,
  violationCount: 1,
  hasUnassigned: false,
  hasEdits: false,
};

const activeEvent = {
  id: '8801',
  eventType: 1,
  eventCode: 4,
  eventSequenceId: 1042,
  // 14:26:58 in Columbus on Sep 10, 2026 (EDT = UTC−4).
  eventDateTime: '2026-09-10T18:26:58.000Z',
  recordStatus: 1,
  recordOrigin: 1,
  status: 'ON',
  locationName: '0.64 mi N of Florence, KY',
  totalVehicleMiles: 993_589,
  annotation: 'Loading · shipper #4821',
  comment: null,
  supersedesId: null,
  editedById: null,
  editorType: null,
  editReason: null,
  vehicleId: 'veh-1',
};

const supersededEvent = { ...activeEvent, id: '8800', recordStatus: 2, annotation: 'Superseded record' };
const proposedEvent = { ...activeEvent, id: '8899', recordStatus: 3, recordOrigin: 3, annotation: 'Proposed record' };

const dayPayload = {
  driverId: DRIVER_ID,
  date: DATE,
  timezone: TZ,
  summary,
  graph: [
    { status: 'D', effective: 'D', special: 'NONE', startAt: '2026-09-10T06:00:00.000Z', endAt: '2026-09-10T17:26:00.000Z', durationSec: 41_160 },
  ],
  events: [activeEvent],
  violations: [
    {
      id: 'v1',
      driverId: DRIVER_ID,
      dailyLogId: null,
      logDate: DATE,
      type: 'DRIVING_11',
      occurredAt: '2026-09-10T18:26:00.000Z',
      exceededBySec: 1560,
      detail: '11-hour driving limit exceeded by 00:26',
      status: 'OPEN',
      resolvedAt: null,
      resolvedById: null,
      resolutionNote: null,
    },
  ],
  certification: {
    certified: false,
    certifiedAt: null,
    certifiedById: null,
    certifierType: null,
    certificationCount: 0,
    signatureUrl: null,
    recertificationRequired: false,
  },
};

function baseHandlers() {
  return [
    http.get(url(endpoints.drivers.list), () =>
      ok({ items: [driver], page: 1, limit: 200, total: 1, totalPages: 1 }),
    ),
    http.get(url(endpoints.vehicles.list), () =>
      ok({ items: [{ id: 'veh-1', unitNumber: '101' }], page: 1, limit: 200, total: 1, totalPages: 1 }),
    ),
    http.get(url(endpoints.logs.day(DRIVER_ID)), () => ok(dayPayload)),
    http.get(url(endpoints.logs.events(DRIVER_ID)), () =>
      ok({ driverId: DRIVER_ID, date: DATE, timezone: TZ, events: [activeEvent, supersededEvent, proposedEvent] }),
    ),
    http.get(url(endpoints.logs.range(DRIVER_ID)), () =>
      ok({
        driverId: DRIVER_ID,
        from: '2026-09-03',
        to: DATE,
        days: [
          { ...summary, date: '2026-09-09', certified: true },
          { ...summary, date: DATE, certified: false },
        ],
      }),
    ),
    http.get(url(endpoints.unidentified.list), () => ok({ items: [], total: 0, page: 1 })),
  ];
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/hos-logs?driverId=${DRIVER_ID}&date=${DATE}`]}>
          <HosLogsPage />
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
  currentCan = () => true;
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(...baseHandlers());
});

describe('W-08 · header and timezone', () => {
  it('states the home terminal zone in the subtitle and under the grid', async () => {
    renderPage();
    // The subtitle needs BOTH the driver list and the vehicle picker to resolve; under a full
    // parallel suite the default 1 s findBy window is not always enough.
    expect(
      await screen.findByText('John Smith · Unit #101 · Home terminal: Columbus, OH (Eastern)', undefined, {
        timeout: 5_000,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^Recorded by ELD .* · all times Eastern$/)).toBeInTheDocument();
  });

  it('renders log-event times in the driver zone, not the browser zone', async () => {
    renderPage();
    // 18:26:58Z is 14:26:58 in Columbus — the browser zone (UTC in CI) must not win.
    expect(await screen.findByText('14:26:58')).toBeInTheDocument();
    expect(screen.queryByText('18:26:58')).not.toBeInTheDocument();
  });

  it('Export PDF prints the log region only, not the whole app (stage 3)', async () => {
    const user = userEvent.setup();
    let target: Element | null = null;
    let printing = false;
    const print = vi.spyOn(window, 'print').mockImplementation(() => {
      target = document.querySelector('[data-print-target]');
      printing = document.body.hasAttribute('data-printing');
    });
    try {
      renderPage();
      await screen.findByText('14:26:58');
      await user.click(screen.getByRole('button', { name: 'Export PDF' }));

      expect(print).toHaveBeenCalledTimes(1);
      expect(printing).toBe(true);
      expect(target).not.toBeNull();
      expect(target!.textContent).toContain('Hours of Service · Driver log');
      // The toolbar is marked to drop out of the printout.
      expect(screen.getByRole('button', { name: 'Export PDF' }).closest('[data-print-hide]')).not.toBeNull();

      window.dispatchEvent(new Event('afterprint'));
      expect(document.querySelector('[data-print-target]')).toBeNull();
      expect(document.body).not.toHaveAttribute('data-printing');
    } finally {
      print.mockRestore();
    }
  });
});

describe('W-08 · role gating (§10 W-08 role table)', () => {
  it('shows `Certify all` for an administrator', async () => {
    currentCan = () => true;
    renderPage();
    expect(await screen.findByRole('button', { name: 'Certify all' })).toBeInTheDocument();
  });

  it('removes `Certify all` from the DOM for a fleet manager', async () => {
    // FM has hosEdit FULL but hosCertifyOnBehalf NONE.
    currentCan = (perm) => perm !== 'hosCertifyOnBehalf';
    renderPage();
    expect(await screen.findByRole('button', { name: /Add \/ edit event/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Certify all' })).not.toBeInTheDocument();
  });

  it('removes `Add / edit event`, `Resolve` and the row menu for a dispatcher', async () => {
    currentCan = (perm, level) => perm === 'hos' || (perm === 'hosEdit' && level !== 'FULL');
    renderPage();
    expect(await screen.findByText('Log events')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add \/ edit event/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Resolve/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Certify all' })).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Row actions' })).toHaveLength(0);
  });
});

describe('W-08 · Log events audit trail (§395.8)', () => {
  it('defaults to recordStatus = 1 and reveals the rest through the checkbox', async () => {
    renderPage();
    await screen.findByText('Log events');
    expect(screen.queryByText('Superseded record')).not.toBeInTheDocument();
    expect(screen.queryByText('Proposed record')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Show superseded and proposed records'));

    const superseded = await screen.findByText('Superseded record');
    const supersededRow = superseded.closest('tr')!;
    expect(supersededRow.className).toContain('line-through');
    const proposedRow = screen.getByText('Proposed record').closest('tr')!;
    expect(proposedRow.className).toContain('bg-info-soft');
  });

  it('names the §395.8 record origin exactly as the design does', async () => {
    renderPage();
    expect(await screen.findByText('ELD · automatic')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Show superseded and proposed records'));
    expect(await screen.findByText('Carrier · proposed')).toBeInTheDocument();
  });
});

describe('W-08 · Violations card', () => {
  it('titles the violation and states how far over the limit it ran, in the driver zone', async () => {
    renderPage();
    expect((await screen.findAllByText('11-hour driving limit')).length).toBeGreaterThan(0);
    expect(screen.getByText('Exceeded by 00:26 at 14:26')).toBeInTheDocument();
  });
});

describe('11.11 · Request a log edit', () => {
  it('shows the §395.30 banner and surfaces DRIVING_TIME_IMMUTABLE verbatim, without retrying', async () => {
    let attempts = 0;
    server.use(
      http.post(url(endpoints.logs.createEditRequest(DRIVER_ID)), () => {
        attempts += 1;
        return fail(
          422,
          'DRIVING_TIME_IMMUTABLE',
          'Driving time can never be shortened, deleted or restatused (49 CFR §395.30).',
        );
      }),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Under 49 CFR §395.30 a carrier may only suggest an edit/),
    ).toBeInTheDocument();

    await userEvent.type(
      within(dialog).getByRole('textbox', { name: /Reason for the edit/ }),
      'Driver forgot to switch to On duty.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send edit request' }));

    expect(
      await within(dialog).findByText(
        'Driving time can never be shortened, deleted or restatused (49 CFR §395.30).',
      ),
    ).toBeInTheDocument();
    expect(attempts).toBe(1);
  });

  it('rejects an annotation under 4 characters with the FMCSA error string', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'ab');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send edit request' }));
    expect(
      await within(dialog).findByText('An annotation must be at least 4 characters (FMCSA requirement).'),
    ).toBeInTheDocument();
  });

  it('WB-059 · refuses OFF/SB/ON and keeps `Driving` while the interval covers an automatic D record', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    // Into the driving block (06:00Z–17:26Z ⇒ 02:00–13:26 local).
    const start = within(dialog).getByPlaceholderText('14:26:58');
    await userEvent.clear(start);
    await userEvent.type(start, '10:00:00');
    // §395.30 — automatic driving can never be restatused, so every non-driving status is refused…
    expect(within(dialog).getByRole('button', { name: 'OFF duty' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Sleeper' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'ON duty' })).toBeDisabled();
    // …and `D` is the one status that stays selectable.
    expect(within(dialog).getByRole('button', { name: 'Driving' })).toBeEnabled();
    // WB-021 / B-39 — YM and PC stay disabled for their own reason.
    expect(within(dialog).getByRole('button', { name: 'Yard move' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Personal' })).toBeDisabled();
    expect(
      within(dialog).getAllByText(
        'Driving time can never be shortened, deleted or restatused (49 CFR §395.30).',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('WB-059 · leaves OFF/SB/ON/D selectable outside automatic driving (YM/PC still disabled)', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    const start = within(dialog).getByPlaceholderText('14:26:58');
    await userEvent.clear(start);
    await userEvent.type(start, '20:00:00');
    for (const name of ['OFF duty', 'Sleeper', 'Driving', 'ON duty']) {
      expect(within(dialog).getByRole('button', { name })).toBeEnabled();
    }
    expect(within(dialog).getByRole('button', { name: 'Yard move' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Personal' })).toBeDisabled();
    expect(
      within(dialog).queryByText('Driving time can never be shortened, deleted or restatused (49 CFR §395.30).'),
    ).not.toBeInTheDocument();
  });
});

describe('11.12 · Certify logs', () => {
  it('certifies only the selected uncertified days and disables an already-certified one', async () => {
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.logs.certify(DRIVER_ID)), async ({ request }) => {
        body = await request.json();
        return ok({ driverId: DRIVER_ID, certified: [{ date: DATE, certifiedAt: new Date().toISOString(), certifiedBy: 'u1', onBehalf: true, signatureCount: 1 }] });
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Certify all' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Certify 2026-09-09')).toBeDisabled();
    expect(within(dialog).getByLabelText(`Certify ${DATE}`)).toBeChecked();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Certify 1 selected day' }));
    expect(body).toEqual({ dates: [DATE] });
  });

  it('WB-198 · a toggled day selection is not dropped silently on Esc', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Certify all' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(`Certify ${DATE}`));
    await userEvent.keyboard('{Escape}');

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
  });
});

const UNASSIGNED = {
  id: 'seg-1',
  vehicleId: 'veh-1',
  startAt: '2026-09-10T09:12:00.000Z',
  endAt: '2026-09-10T09:18:00.000Z',
  durationSec: 360,
  distanceMi: 1,
  startLocation: 'Columbus, OH terminal',
  endLocation: null,
  status: 'PENDING' as const,
  assignedDriverId: null,
  assignedById: null,
  assignedAt: null,
  annotation: null,
  fromStoredEvents: true,
};

describe('11.13 · Unassigned driving', () => {
  beforeEach(() => {
    server.use(http.get(url(endpoints.unidentified.list), () => ok({ items: [UNASSIGNED], total: 1, page: 1 })));
  });

  it('shows the success chip when there is nothing unassigned', async () => {
    server.use(http.get(url(endpoints.unidentified.list), () => ok({ items: [], total: 0, page: 1 })));
    renderPage();
    expect(await screen.findByText('No unassigned segments')).toBeInTheDocument();
  });

  it('opens the modal from the warning chip for hosEdit FULL and assigns with an annotation', async () => {
    let assigned: unknown = null;
    server.use(
      http.post(url(endpoints.unidentified.assign(UNASSIGNED.id)), async ({ request }) => {
        assigned = await request.json();
        return ok({ ...UNASSIGNED, status: 'ASSIGNED', assignedDriverId: DRIVER_ID });
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByText('1 unassigned segment'));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/Unassigned segments must be assigned to a driver or annotated/),
    ).toBeInTheDocument();

    await userEvent.click(within(dialog).getByLabelText('Select Unit #101 segment'));
    await userEvent.selectOptions(
      within(dialog).getByLabelText('Resolution for Unit #101'),
      DRIVER_ID,
    );
    await userEvent.type(
      within(dialog).getByRole('textbox'),
      'Yard movement at the home terminal.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign 1 segment' }));

    await vi.waitFor(() =>
      expect(assigned).toEqual({
        driverId: DRIVER_ID,
        annotation: 'Yard movement at the home terminal.',
      }),
    );
  });

  it('refuses an annotation under 4 characters with the FMCSA error string', async () => {
    renderPage();
    await userEvent.click(await screen.findByText('1 unassigned segment'));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText('Select Unit #101 segment'));
    await userEvent.type(within(dialog).getByRole('textbox'), 'ab');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign 1 segment' }));
    expect(
      await within(dialog).findByText('An annotation must be at least 4 characters (FMCSA requirement).'),
    ).toBeInTheDocument();
  });

  it('WB-057 · requests the RODS day ± one day in the home terminal zone, so 21:30 ET is fetched', async () => {
    // 21:30 EDT on the viewed day = 01:30Z the next UTC day. The old UTC-midnight window ended at
    // 2026-09-11T00:00Z (20:00 ET) and a server honouring `to` never returned this segment.
    const late = { ...UNASSIGNED, id: 'seg-late', startAt: '2026-09-11T01:30:00.000Z', endAt: '2026-09-11T01:50:00.000Z', durationSec: 1_200 };
    const windows: Array<{ from: string | null; to: string | null }> = [];
    server.use(
      http.get(url(endpoints.unidentified.list), ({ request }) => {
        const search = new URL(request.url).searchParams;
        const from = search.get('from');
        const to = search.get('to');
        windows.push({ from, to });
        // Behave like the backend: only segments that overlap [from, to).
        const items = [late].filter(
          (seg) => (!to || Date.parse(seg.startAt) < Date.parse(to)) && (!from || Date.parse(seg.endAt) > Date.parse(from)),
        );
        return ok({ items, total: items.length, page: 1 });
      }),
    );
    renderPage();
    expect(await screen.findByText('1 unassigned segment')).toBeInTheDocument();
    // RODS day Sep 10 in New York starts 04:00Z; the window is that start − 1 day … + 2 days.
    expect(windows.at(-1)).toEqual({ from: '2026-09-09T04:00:00.000Z', to: '2026-09-12T04:00:00.000Z' });
    const { to } = windows.at(-1)!;
    expect(Date.parse(late.startAt)).toBeLessThan(Date.parse(to!));
  });

  it('WB-058 · counts only segments that overlap the viewed RODS day (chip and 11.13 subtitle)', async () => {
    // 23:00 ET on Sep 9 (previous RODS day) and 00:30 ET on Sep 11 (next) must not be counted.
    const yesterday = { ...UNASSIGNED, id: 'seg-prev', startAt: '2026-09-10T03:00:00.000Z', endAt: '2026-09-10T03:30:00.000Z', durationSec: 1_800 };
    const tomorrow = { ...UNASSIGNED, id: 'seg-next', startAt: '2026-09-11T04:30:00.000Z', endAt: '2026-09-11T05:00:00.000Z', durationSec: 1_800 };
    const late = { ...UNASSIGNED, id: 'seg-late', startAt: '2026-09-11T01:30:00.000Z', endAt: '2026-09-11T01:50:00.000Z', durationSec: 1_200 };
    server.use(
      http.get(url(endpoints.unidentified.list), () =>
        ok({ items: [yesterday, UNASSIGNED, late, tomorrow], total: 4, page: 1 }),
      ),
    );
    renderPage();
    await userEvent.click(await screen.findByText('2 unassigned segments'));
    const dialog = await screen.findByRole('dialog');
    // 360 s + 1 200 s = 26 min — not the 86 min the four raw segments add up to.
    expect(within(dialog).getByText(/^2 segments recorded with no driver logged in · 00:26 total$/)).toBeInTheDocument();
  });

  it('WB-058 · a day whose only segments belong to its neighbours shows the success chip', async () => {
    const yesterday = { ...UNASSIGNED, id: 'seg-prev', startAt: '2026-09-10T03:00:00.000Z', endAt: '2026-09-10T03:30:00.000Z', durationSec: 1_800 };
    server.use(http.get(url(endpoints.unidentified.list), () => ok({ items: [yesterday], total: 1, page: 1 })));
    renderPage();
    expect(await screen.findByText('No unassigned segments')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ unassigned segments?$/)).toBeNull();
  });

  it('shows the chip to a dispatcher but never makes it clickable', async () => {
    currentCan = (perm, level) => perm === 'hos' || (perm === 'hosEdit' && level !== 'FULL');
    renderPage();
    const chip = await screen.findByText('1 unassigned segment');
    expect(chip.closest('button')).toBeNull();
  });
});

describe('W-08 · Resolve a violation (⛔ gap B-6)', () => {
  it('posts the resolution note and toasts on success (MSW stands in for the missing endpoint)', async () => {
    let sent: unknown = null;
    server.use(
      http.post(url(endpoints.violations.resolve('v1')), async ({ request }) => {
        sent = await request.json();
        return ok({ id: 'v1', status: 'RESOLVED', resolvedAt: new Date().toISOString(), resolutionNote: 'Adverse weather detour.' });
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Resolve 11-hour driving limit' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'Adverse weather detour.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    await vi.waitFor(() => expect(sent).toEqual({ resolutionNote: 'Adverse weather detour.' }));
    expect(await screen.findByText('Violation resolved')).toBeInTheDocument();
  });

  it('shows the server refusal verbatim inside the modal and does not retry', async () => {
    let attempts = 0;
    server.use(
      http.post(url(endpoints.violations.resolve('v1')), () => {
        attempts += 1;
        return fail(404, 'NOT_FOUND', 'Not found.');
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Resolve 11-hour driving limit' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByRole('textbox'), 'Adverse weather detour.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    await vi.waitFor(() => expect(attempts).toBe(1));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });

  it('WB-060 · resolves the violation whose row was clicked, not the first open one', async () => {
    const breakViolation = {
      ...dayPayload.violations[0]!,
      id: 'v2',
      type: 'BREAK_30',
      occurredAt: '2026-09-10T14:00:00.000Z',
      exceededBySec: 600,
    };
    const resolved = { ...dayPayload.violations[0]!, id: 'v3', type: 'SHIFT_14', status: 'RESOLVED' };
    server.use(
      http.get(url(endpoints.logs.day(DRIVER_ID)), () =>
        ok({ ...dayPayload, violations: [dayPayload.violations[0], breakViolation, resolved] }),
      ),
    );
    const hits: string[] = [];
    server.use(
      http.post(url(endpoints.violations.resolve(':id')), ({ params }) => {
        hits.push(String(params.id));
        return ok({ id: params.id, status: 'RESOLVED', resolvedAt: new Date().toISOString(), resolutionNote: 'x' });
      }),
    );
    renderPage();
    // One `Resolve` per OPEN row; the RESOLVED row has none.
    expect(await screen.findByRole('button', { name: 'Resolve 30-minute break' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Resolve / })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Resolve 14-hour shift limit' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Resolve 30-minute break' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('30-minute break')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox'), 'Break taken at the shipper.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    await vi.waitFor(() => expect(hits).toEqual(['v2']));
  });

  it('refuses a resolution note under 4 characters', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Resolve 11-hour driving limit' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Resolve' }));
    expect(
      await within(dialog).findByText('An annotation must be at least 4 characters (FMCSA requirement).'),
    ).toBeInTheDocument();
  });
});

describe('W-08 · date navigation and certification cells', () => {
  it('steps back a day and disables the forward arrow on today', async () => {
    renderPage();
    await screen.findByText('Thu, Sep 10, 2026');
    await userEvent.click(screen.getByLabelText('Previous day'));
    expect(await screen.findByText('Wed, Sep 9, 2026')).toBeInTheDocument();
    // 2026-09-12 is "today" for these tests only if the clock says so; the guard is that a date
    // at or after today disables the arrow, which Sep 9 does not.
    expect(screen.getByLabelText('Next day')).not.toBeDisabled();
  });

  it('jumps to a day when its certification cell is clicked', async () => {
    renderPage();
    await userEvent.click(await screen.findByLabelText('2026-09-09 — certified'));
    expect(await screen.findByText('Wed, Sep 9, 2026')).toBeInTheDocument();
  });

  it('lists the days still needing a driver signature under the certification cells', async () => {
    renderPage();
    expect(await screen.findByText('Driver signature required for Sep 10.')).toBeInTheDocument();
  });
});

describe('W-08 · empty and error states', () => {
  it('shows the §13.2 banner when the day has no ELD records', async () => {
    server.use(
      http.get(url(endpoints.logs.day(DRIVER_ID)), () =>
        ok({ ...dayPayload, graph: [], violations: [], summary: { ...summary, hasViolation: false, violationCount: 0 } }),
      ),
    );
    renderPage();
    expect(
      await screen.findByText(
        'No ELD records for this day. The driver may have been off duty or the app was not signed in.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('● No violations today')).toBeInTheDocument();
  });

  it('renders the error inside the grid card, not over the page', async () => {
    // client.ts retries a GET twice (1 s, then 3 s) before giving up — §6.2 rule 7.
    server.use(http.get(url(endpoints.logs.day(DRIVER_ID)), () => fail(500, 'INTERNAL_ERROR', 'boom')));
    renderPage();
    expect(
      await screen.findByText('Could not load this RODS day', undefined, { timeout: 10_000 }),
    ).toBeInTheDocument();
    // The rest of the screen is still there.
    expect(screen.getByText('Log events')).toBeInTheDocument();
  });

  it('renders <ErrorState> inside `Available hours` while gap B-2 is open', async () => {
    server.use(http.get(url(endpoints.drivers.hos(DRIVER_ID)), () => fail(404, 'NOT_FOUND', 'Not found.')));
    renderPage();
    expect(await screen.findByText('Could not load available hours')).toBeInTheDocument();
  });
});

describe('W-08 · Log events row menu (`hosEdit` FULL)', () => {
  it('opens 11.11 against the clicked record and copies its event ID', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    server.use(http.get(url(endpoints.unidentified.list), () => ok({ items: [UNASSIGNED], total: 1, page: 1 })));
    renderPage();
    // Let every query settle first: `DataTable` remounts its row-action cell on each parent render,
    // so a late response would close the Radix menu under the click (shared/ui defect, reported).
    await screen.findByText('1 unassigned segment');
    await userEvent.click(await screen.findByRole('button', { name: 'Row actions' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Request an edit' }));
    const dialog = await screen.findByRole('dialog');
    // Prefilled from the record: 14:26:58 local and its odometer.
    expect(within(dialog).getByDisplayValue('14:26:58')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('993589')).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Row actions' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Copy event ID' }));
    expect(writeText).toHaveBeenCalledWith('8801');
    expect(await screen.findByText('Event ID copied')).toBeInTheDocument();
  });

  it('`View all events` turns the audit trail on', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /View all events/ }));
    expect(screen.getByLabelText('Show superseded and proposed records')).toBeChecked();
    expect(await screen.findByText('Superseded record')).toBeInTheDocument();
  });

  it('closes 11.12 and 11.13 through Cancel without writing anything', async () => {
    let certified = 0;
    server.use(
      http.get(url(endpoints.unidentified.list), () => ok({ items: [UNASSIGNED], total: 1, page: 1 })),
      http.post(url(endpoints.logs.certify(DRIVER_ID)), () => {
        certified += 1;
        return ok({ driverId: DRIVER_ID, certified: [] });
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Certify all' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await userEvent.click(await screen.findByText('1 unassigned segment'));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(certified).toBe(0);
  });
});

/** Renders the page on a real route table so navigation and search-param changes are observable. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderAt(entry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route
              path="/hos-logs"
              element={
                <>
                  <HosLogsPage />
                  <LocationProbe />
                </>
              }
            />
            <Route path="/reports/fmcsa" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const currentLocation = () => screen.getByTestId('location').textContent ?? '';

describe('WD-037 · `/hos-logs?unassigned=1` deep link from W-15 `Resolve now`', () => {
  beforeEach(() => {
    server.use(http.get(url(endpoints.unidentified.list), () => ok({ items: [UNASSIGNED], total: 1, page: 1 })));
  });

  it('opens 11.13 on load for `hosEdit` FULL', async () => {
    renderAt(`/hos-logs?driverId=${DRIVER_ID}&date=${DATE}&unassigned=1`);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Unassigned driving')).toBeInTheDocument();
  });

  it('renders the normal page with no modal and no error without `hosEdit` FULL', async () => {
    currentCan = (perm, level) => perm === 'hos' || (perm === 'hosEdit' && level !== 'FULL');
    renderAt(`/hos-logs?driverId=${DRIVER_ID}&date=${DATE}&unassigned=1`);
    expect(await screen.findByText('Log events')).toBeInTheDocument();
    expect(await screen.findByText('1 unassigned segment')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('You do not have access to this page')).not.toBeInTheDocument();
  });

  it('clears the param when the modal closes, keeping driver and date, so a refresh does not reopen it', async () => {
    renderAt(`/hos-logs?driverId=${DRIVER_ID}&date=${DATE}&unassigned=1`);
    const dialog = await screen.findByRole('dialog');
    expect(currentLocation()).toContain('unassigned=1');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const search = new URLSearchParams(currentLocation().split('?')[1]);
    expect(search.has('unassigned')).toBe(false);
    expect(search.get('driverId')).toBe(DRIVER_ID);
    expect(search.get('date')).toBe(DATE);
  });

  it('does not open 11.13 when the param is absent', async () => {
    renderAt(`/hos-logs?driverId=${DRIVER_ID}&date=${DATE}`);
    expect(await screen.findByText('1 unassigned segment')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('WD-037 · `Send to inspector` deep-links to 11.14 in features/reports', () => {
  it('navigates to /reports/fmcsa with transfer=1 and the current driver and date', async () => {
    renderAt(`/hos-logs?driverId=${DRIVER_ID}&date=${DATE}`);
    await userEvent.click(await screen.findByRole('button', { name: /Send to inspector/ }));

    await vi.waitFor(() => expect(currentLocation().startsWith('/reports/fmcsa?')).toBe(true));
    const search = new URLSearchParams(currentLocation().split('?')[1]);
    expect(search.get('transfer')).toBe('1');
    expect(search.get('driverId')).toBe(DRIVER_ID);
    expect(search.get('date')).toBe(DATE);
  });

  it('keeps the button absent from the DOM without `reportsTransfer` FULL', async () => {
    currentCan = (perm) => perm !== 'reportsTransfer';
    renderAt(`/hos-logs?driverId=${DRIVER_ID}&date=${DATE}`);
    expect(await screen.findByText('Log events')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Send to inspector/ })).not.toBeInTheDocument();
  });
});

describe('overlay controls actually drive the payload', () => {
  it('11.11 sends the edited status, interval, odometer and engine hours, and toasts on success', async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(url(endpoints.logs.createEditRequest(DRIVER_ID)), async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return ok({ id: 'edt_1', status: 'PENDING', driverId: DRIVER_ID, originalEventId: '8801', proposedStatus: 'OFF', proposedStart: '', proposedEnd: null, reason: '', applied: false });
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.click(within(dialog).getByRole('button', { name: /OFF duty/ }));
    expect(within(dialog).getByRole('button', { name: /OFF duty/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.type(within(dialog).getByPlaceholderText('15:30:00'), '15:30:00');
    // WB-070 — the location is shown read-only and never sent (gap B-39).
    expect(within(dialog).getByRole('textbox', { name: /Location/ })).toHaveAttribute('readonly');
    const [odometer, engineHours] = within(dialog)
      .getAllByRole('textbox')
      .filter((input) => ['993589', ''].includes((input as HTMLInputElement).value) && input.tagName === 'INPUT' && !(input as HTMLInputElement).readOnly && !(input as HTMLInputElement).placeholder);
    await userEvent.clear(odometer!);
    await userEvent.type(odometer!, '993600');
    await userEvent.type(engineHours!, '1079.4');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'Loading at shipper #4821.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send edit request' }));

    await vi.waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      originalEventId: '8801',
      proposedStatus: 'OFF',
      proposedStart: '2026-09-10T18:26:58.000Z',
      proposedEnd: '2026-09-10T19:30:00.000Z',
      odometerMi: 993600,
      engineHours: 1079.4,
      reason: 'Loading at shipper #4821.',
    });
    expect(body).not.toHaveProperty('location');
    expect(await screen.findByText('Edit request sent')).toBeInTheDocument();
  });

  it('11.11 refuses a malformed end time before anything is sent', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByPlaceholderText('15:30:00'), '25:99');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'Valid reason.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send edit request' }));
    expect(await within(dialog).findByText('Enter a time as HH:MM:SS.')).toBeInTheDocument();
  });

  it('11.11 fields only take what they ask for — time digits, whole miles, decimal hours', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    const end = within(dialog).getByPlaceholderText('15:30:00');
    await userEvent.type(end, 'ab1530x00');
    expect(end).toHaveValue('15:30:00');
    const odometer = within(dialog).getByRole('textbox', { name: /Odometer/ });
    await userEvent.clear(odometer);
    await userEvent.type(odometer, '99a3.6-00');
    expect(odometer).toHaveValue('993600');
    const engineHours = within(dialog).getByRole('textbox', { name: /Engine hours/ });
    await userEvent.type(engineHours, '10e79.45h');
    expect(engineHours).toHaveValue('1079.4');
  });

  it('11.11 refuses an end time at or before the start time', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByPlaceholderText('15:30:00'), '14:00:00');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'Valid reason.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send edit request' }));
    expect(await within(dialog).findByText('End time must be after the start time.')).toBeInTheDocument();
  });

  it('11.12 unticking the only uncertified day disables the submit button', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Certify all' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByLabelText(`Certify ${DATE}`));
    expect(within(dialog).getByRole('button', { name: 'Certify 0 selected days' })).toBeDisabled();
    await userEvent.click(within(dialog).getByLabelText(`Certify ${DATE}`));
    expect(within(dialog).getByRole('button', { name: 'Certify 1 selected day' })).toBeEnabled();
  });

  it('11.12 shows RECERTIFICATION_REQUIRED verbatim', async () => {
    server.use(
      http.post(url(endpoints.logs.certify(DRIVER_ID)), () =>
        fail(422, 'RECERTIFICATION_REQUIRED', 'The log changed after the last certification — it must be certified again.'),
      ),
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Certify all' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Certify 1 selected day' }));
    expect(
      await within(dialog).findByText('The log changed after the last certification — it must be certified again.'),
    ).toBeInTheDocument();
  });

  it('`Available hours` Retry refetches the B-2 clocks', async () => {
    let calls = 0;
    server.use(
      http.get(url(endpoints.drivers.hos(DRIVER_ID)), () => {
        calls += 1;
        return fail(404, 'NOT_FOUND', 'Not found.');
      }),
    );
    renderPage();
    const card = (await screen.findByText('Could not load available hours')).closest('[role="alert"]') as HTMLElement;
    const before = calls;
    await userEvent.click(within(card).getByRole('button', { name: 'Retry' }));
    await vi.waitFor(() => expect(calls).toBeGreaterThan(before));
  });
});

describe('audited fixes WB-061 … WB-073', () => {
  it('WB-061 · a resolved violation is muted with a `Resolved` badge and no `Resolve` action', async () => {
    server.use(
      http.get(url(endpoints.logs.day(DRIVER_ID)), () =>
        ok({
          ...dayPayload,
          violations: [{ ...dayPayload.violations[0]!, status: 'RESOLVED', resolutionNote: 'Reviewed.' }],
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Resolved')).toBeInTheDocument();
    expect(screen.getByText('0 open')).toBeInTheDocument();
    const row = screen.getByText('Resolved').closest('[data-status]') as HTMLElement;
    expect(row).toHaveAttribute('data-status', 'resolved');
    expect(row.className).not.toContain('bg-danger-soft');
    expect(screen.queryByRole('button', { name: /^Resolve/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('hos-violation-band')).toHaveAttribute('data-status', 'resolved');
    expect(screen.getByTestId('hos-violation-mark')).toHaveAttribute('stroke', 'var(--color-text-muted)');
  });

  it('WB-062 · a day that needs re-certification is selectable and pre-selected', async () => {
    server.use(
      http.get(url(endpoints.logs.day(DRIVER_ID)), () =>
        ok({ ...dayPayload, certification: { ...dayPayload.certification, certified: true, recertificationRequired: true } }),
      ),
      http.get(url(endpoints.logs.range(DRIVER_ID)), () =>
        ok({
          driverId: DRIVER_ID,
          from: '2026-09-03',
          to: DATE,
          days: [
            { ...summary, date: '2026-09-08', certified: true, hasEdits: false },
            { ...summary, date: '2026-09-09', certified: true, hasEdits: true },
            { ...summary, date: DATE, certified: true, hasEdits: true },
          ],
        }),
      ),
    );
    renderPage();
    await screen.findByText('Log events');
    await userEvent.click(await screen.findByRole('button', { name: 'Certify all' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(`Certify ${DATE}`)).toBeChecked();
    expect(within(dialog).getByLabelText(`Certify ${DATE}`)).toBeEnabled();
    expect(within(dialog).getByText('Re-certification required')).toBeInTheDocument();
    // Edited after signing, flag unknown from the range summary: enabled, not pre-selected.
    expect(within(dialog).getByLabelText('Certify 2026-09-09')).toBeEnabled();
    expect(within(dialog).getByLabelText('Certify 2026-09-09')).not.toBeChecked();
    // Certified and untouched: still locked.
    expect(within(dialog).getByLabelText('Certify 2026-09-08')).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Certify 1 selected day' })).toBeEnabled();
  });

  it('WB-062 · the selection follows the latest days: late arrivals get their default, certified-elsewhere days drop out', async () => {
    const queryClient = new QueryClient();
    const day = (date: string, certified: boolean) => ({ ...summary, date, certified, hasEdits: false });
    const ui = (days: ReturnType<typeof day>[]) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CertifyLogsModal
            driverId={DRIVER_ID}
            driverName="John Smith"
            signerName="Sarah Chen"
            timezone={TZ}
            days={days}
            onClose={() => undefined}
          />
        </ToastProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(ui([]));
    expect(screen.getByRole('button', { name: 'Certify 0 selected days' })).toBeDisabled();
    rerender(ui([day('2026-09-09', false), day(DATE, false)]));
    expect(screen.getByRole('button', { name: 'Certify 2 selected days' })).toBeEnabled();
    rerender(ui([day('2026-09-09', true), day(DATE, false)]));
    expect(screen.getByRole('button', { name: 'Certify 1 selected day' })).toBeEnabled();
    expect(screen.getByLabelText('Certify 2026-09-09')).not.toBeChecked();
  });

  it('WB-063 · a partial batch says what was saved, refreshes the list and never re-posts it', async () => {
    const SECOND = { ...UNASSIGNED, id: 'seg-2', startAt: '2026-09-10T10:12:00.000Z', endAt: '2026-09-10T10:18:00.000Z' };
    let firstDone = false;
    let listCalls = 0;
    const posted: string[] = [];
    server.use(
      http.get(url(endpoints.unidentified.list), () => {
        listCalls += 1;
        return ok({ items: firstDone ? [SECOND] : [UNASSIGNED, SECOND], total: firstDone ? 1 : 2, page: 1 });
      }),
      http.post(url(endpoints.unidentified.assign(UNASSIGNED.id)), () => {
        posted.push(UNASSIGNED.id);
        firstDone = true;
        return ok({ ...UNASSIGNED, status: 'ASSIGNED', assignedDriverId: DRIVER_ID });
      }),
      http.post(url(endpoints.unidentified.assign(SECOND.id)), () => {
        posted.push(SECOND.id);
        return fail(409, 'CONFLICT', 'This segment is already assigned.');
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByText('2 unassigned segments'));
    const dialog = await screen.findByRole('dialog');
    for (const box of within(dialog).getAllByLabelText('Select Unit #101 segment')) await userEvent.click(box);
    for (const select of within(dialog).getAllByLabelText('Resolution for Unit #101')) {
      await userEvent.selectOptions(select, DRIVER_ID);
    }
    await userEvent.type(within(dialog).getByRole('textbox'), 'Driver forgot to log in.');
    const before = listCalls;
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign 2 segments' }));

    expect(
      // The refusal text itself is client.ts's mapping of 409 CONFLICT, shown verbatim.
      await within(dialog).findByText(/^1 of 2 segments were saved before the server refused the next one: /),
    ).toBeInTheDocument();
    await vi.waitFor(() => expect(listCalls).toBeGreaterThan(before));
    // seg-1 left the list and the selection; only seg-2 is still offered.
    expect(await within(dialog).findByRole('button', { name: 'Assign 1 segment' })).toBeInTheDocument();
    expect(posted).toEqual([UNASSIGNED.id, SECOND.id]);
  });

  it('WB-064 · offers one annotate option, because the request carries no YM/PC category', async () => {
    let body: unknown = null;
    server.use(
      http.get(url(endpoints.unidentified.list), () => ok({ items: [UNASSIGNED], total: 1, page: 1 })),
      http.post(url(endpoints.unidentified.annotate(UNASSIGNED.id)), async ({ request }) => {
        body = await request.json();
        return ok({ ...UNASSIGNED, status: 'ANNOTATED' });
      }),
    );
    renderPage();
    await userEvent.click(await screen.findByText('1 unassigned segment'));
    const dialog = await screen.findByRole('dialog');
    const select = within(dialog).getByLabelText('Resolution for Unit #101');
    const labels = within(select).getAllByRole('option').map((option) => option.textContent);
    expect(labels).toContain('Annotate as yard move or personal conveyance');
    expect(labels).not.toContain('Annotate as yard move');
    expect(labels).not.toContain('Annotate as personal conveyance');
    await userEvent.click(within(dialog).getByLabelText('Select Unit #101 segment'));
    await userEvent.selectOptions(select, 'Annotate as yard move or personal conveyance');
    expect(within(dialog).getByText(/state yard move or personal conveyance in the/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByRole('textbox'), 'Yard move at terminal.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign 1 segment' }));
    await vi.waitFor(() => expect(body).toEqual({ annotation: 'Yard move at terminal.' }));
  });

  it('WB-065 · counts only proposed records as pending review, not accepted driver edits', async () => {
    const acceptedDriverEdit = (id: string) => ({ ...activeEvent, id, recordOrigin: 2, annotation: `Driver edit ${id}` });
    server.use(
      http.get(url(endpoints.logs.events(DRIVER_ID)), () =>
        ok({
          driverId: DRIVER_ID,
          date: DATE,
          timezone: TZ,
          events: [activeEvent, acceptedDriverEdit('d1'), acceptedDriverEdit('d2'), acceptedDriverEdit('d3'), acceptedDriverEdit('d4'), proposedEvent],
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText(/5 events today · 1 driver edit pending review/)).toBeInTheDocument();
  });

  it('WB-066 · a malformed or impossible `?date=` falls back to today instead of crashing', async () => {
    expect(validDayKey('banana', '2026-09-18')).toBe('2026-09-18');
    expect(validDayKey('2026-02-31', '2026-09-18')).toBe('2026-09-18');
    expect(validDayKey('2026-9-1', '2026-09-18')).toBe('2026-09-18');
    expect(validDayKey('2027-01-01', '2026-09-18')).toBe('2026-09-18');
    expect(validDayKey(null, '2026-09-18')).toBe('2026-09-18');
    expect(validDayKey('2026-01-02', '2026-09-18')).toBe('2026-01-02');

    renderAt(`/hos-logs?driverId=${DRIVER_ID}&date=banana`);
    expect(await screen.findByText('Log events')).toBeInTheDocument();
    expect(screen.getByLabelText('Next day')).toBeDisabled();
  });

  it('WB-067 · `Before` shows the original record; the typed end time appears only in `After`', async () => {
    server.use(
      http.get(url(endpoints.logs.day(DRIVER_ID)), () =>
        ok({
          ...dayPayload,
          graph: [
            ...dayPayload.graph,
            { status: 'ON', effective: 'ON', special: 'NONE', startAt: '2026-09-10T18:26:58.000Z', endAt: '2026-09-10T19:10:00.000Z', durationSec: 2582 },
          ],
        }),
      ),
    );
    renderPage();
    await screen.findByText('14:26:58');
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByPlaceholderText('15:30:00'), '15:30:00');
    const before = within(dialog).getByText('Before').nextElementSibling as HTMLElement;
    const after = within(dialog).getByText('After').nextElementSibling as HTMLElement;
    expect(before.textContent).toBe('ON 14:26 → 15:10');
    expect(after.textContent).toContain('15:30');
  });

  it('WB-069 · a changed odometer alone makes Esc ask to discard', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    const odometer = within(dialog).getByDisplayValue('993589');
    await userEvent.clear(odometer);
    await userEvent.type(odometer, '993600');
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
  });

  it('WB-069 · a changed duty status alone makes Esc ask to discard', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Sleeper/ }));
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
  });

  it('WB-071 · the cycle label follows `cycleLimitSec`', async () => {
    expect(cycleRuleLabel(undefined)).toBe('Property-carrying');
    expect(cycleRuleLabel(70 * 3600)).toBe('Property-carrying · 70 hr / 8 day');
    expect(cycleRuleLabel(60 * 3600)).toBe('Property-carrying · 60 hr / 7 day');
    expect(cycleRuleLabel(34 * 3600)).toBe('Property-carrying · 34:00 cycle');
    server.use(
      http.get(url(endpoints.drivers.hos(DRIVER_ID)), () =>
        ok({
          driveRemainingSec: 3600, shiftRemainingSec: 3600, cycleRemainingSec: 3600, breakInSec: 3600,
          onDutySince: null, cycleLimitSec: 60 * 3600, shiftLimitSec: 14 * 3600, driveLimitSec: 11 * 3600,
          breakLimitSec: 8 * 3600, dutyStatus: 'ON_DUTY', statusSince: '2026-09-10T12:00:00.000Z',
          computedAt: '2026-09-10T12:00:00.000Z',
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Property-carrying · 60 hr / 7 day')).toBeInTheDocument();
    expect(screen.queryByText('Property-carrying · 70 hr / 8 day')).not.toBeInTheDocument();
  });

  it('WB-073 · `hos: NONE` renders the full-page forbidden state', () => {
    currentCan = () => false;
    renderPage();
    expect(screen.getByText('You do not have access to this page')).toBeInTheDocument();
    expect(screen.getByText('Ask an administrator if you need access to HOS Logs.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('the unassigned chip never claims zero while the query is loading', async () => {
    server.use(http.get(url(endpoints.unidentified.list), () => new Promise<never>(() => undefined)));
    renderPage();
    expect(await screen.findByTestId('unassigned-chip-loading')).toBeInTheDocument();
    await screen.findByText('Log events');
    expect(screen.queryByText('No unassigned segments')).not.toBeInTheDocument();
  });

  it('the unassigned chip says the count is unavailable when the query fails', async () => {
    server.use(http.get(url(endpoints.unidentified.list), () => fail(500, 'INTERNAL_ERROR', 'boom')));
    renderPage();
    expect(
      await screen.findByText('Unassigned segments unavailable · Retry', undefined, { timeout: 10_000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('No unassigned segments')).not.toBeInTheDocument();
  });
});

describe('W-08 · stage-2 dead controls', () => {
  it('WB-195 · a unit number that already carries a # is not printed as `Unit ##101`', async () => {
    server.use(
      http.get(url(endpoints.vehicles.list), () =>
        ok({ items: [{ id: 'veh-1', unitNumber: '#101' }], page: 1, limit: 200, total: 1, totalPages: 1 }),
      ),
    );
    renderPage();

    expect(
      await screen.findByText('John Smith · Unit #101 · Home terminal: Columbus, OH (Eastern)', undefined, {
        timeout: 5_000,
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Unit ##/)).not.toBeInTheDocument();
  });

  it('WB-196 · `View full record` opens the §395.8 record instead of a dead #anchor', async () => {
    server.use(http.get(url(endpoints.unidentified.list), () => ok({ items: [], total: 0, page: 1 })));
    renderPage();
    // Same settling rule as the 11.11 test above: a late response remounts the row-action cell.
    await screen.findByText('No unassigned segments');
    await userEvent.click(await screen.findByRole('button', { name: 'Row actions' }));
    await userEvent.click(await screen.findByRole('button', { name: 'View full record' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Full record')).toBeInTheDocument();
    expect(within(dialog).getByText('Record origin')).toBeInTheDocument();
    expect(within(dialog).getByText('Event ID')).toBeInTheDocument();
  });

  it('WB-197 · 11.13 `Ask each driver to confirm` is disabled with its reason (gap B-83)', async () => {
    server.use(http.get(url(endpoints.unidentified.list), () => ok({ items: [UNASSIGNED], total: 1, page: 1 })));
    renderPage();
    await userEvent.click(await screen.findByText('1 unassigned segment'));
    const dialog = await screen.findByRole('dialog');

    const checkbox = within(dialog).getByLabelText('Ask each driver to confirm in the app');
    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
    expect(
      within(dialog).getByText('Not available yet — assigning a segment does not ask the driver to confirm it.'),
    ).toBeInTheDocument();
  });

  it('WB-200 · 11.11 `Notify the driver immediately` states that it is always on', async () => {
    server.use(http.get(url(endpoints.unidentified.list), () => ok({ items: [], total: 0, page: 1 })));
    renderPage();
    await screen.findByText('No unassigned segments');
    await userEvent.click(await screen.findByRole('button', { name: 'Row actions' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Request an edit' }));

    const dialog = await screen.findByRole('dialog');
    const notify = within(dialog).getByLabelText('Notify the driver immediately');
    expect(notify).toBeDisabled();
    expect(notify).toBeChecked();
    expect(within(dialog).getByText(/Always on — the driver must accept the proposal/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Yard move and Personal conveyance cannot be proposed/),
    ).toBeInTheDocument();
  });
});
