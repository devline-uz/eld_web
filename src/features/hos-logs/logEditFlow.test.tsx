// WB-146 / WB-147 — 11.11 `Add / edit event` end to end:
//   • the toolbar opens a usable form (the day's latest active record, its start pre-filled),
//   • `Send edit request` really posts, toasts §13.3 verbatim and closes,
//   • a double click posts exactly one §395.30 proposal,
//   • a day with no record proposes a NEW record via `POST /logs/:driverId/events` (B-72).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import { TOAST_COPY } from '@/shared/ui/copy';
import type { PermissionKey } from '@/shared/auth/permissions';
import HosLogsPage from './HosLogsPage';

const TZ = 'America/New_York';
const DRIVER_ID = '11111111-1111-4111-8111-111111111111';
const DATE = '2026-09-10';

let currentCan: (perm: PermissionKey, level?: 'READ' | 'FULL') => boolean = () => true;

vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (p: PermissionKey, l?: 'READ' | 'FULL') => currentCan(p, l) }),
}));
vi.mock('@/shared/auth/Can', () => ({
  Can: ({ perm, level, children }: { perm: PermissionKey; level?: 'READ' | 'FULL'; children: React.ReactNode }) =>
    currentCan(perm, level) ? <>{children}</> : null,
}));
vi.mock('@/shared/auth/AuthProvider', () => ({ useAuth: () => ({ user: { fullName: 'Sarah Chen' } }) }));
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
  hasViolation: false,
  violationCount: 0,
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

const certification = {
  certified: false,
  certifiedAt: null,
  certifiedById: null,
  certifierType: null,
  certificationCount: 0,
  signatureUrl: null,
  recertificationRequired: false,
};

function dayPayload(events: unknown[]) {
  return { driverId: DRIVER_ID, date: DATE, timezone: TZ, summary, graph: [], events, violations: [], certification };
}

function baseHandlers(events: unknown[] = [activeEvent]) {
  return [
    http.get(url(endpoints.drivers.list), () => ok({ items: [driver], page: 1, limit: 200, total: 1, totalPages: 1 })),
    http.get(url(endpoints.vehicles.list), () =>
      ok({ items: [{ id: 'veh-1', unitNumber: '101' }], page: 1, limit: 200, total: 1, totalPages: 1 }),
    ),
    http.get(url(endpoints.logs.day(DRIVER_ID)), () => ok(dayPayload(events))),
    http.get(url(endpoints.logs.events(DRIVER_ID)), () =>
      ok({ driverId: DRIVER_ID, date: DATE, timezone: TZ, events }),
    ),
    http.get(url(endpoints.logs.range(DRIVER_ID)), () =>
      ok({ driverId: DRIVER_ID, from: '2026-09-03', to: DATE, days: [{ ...summary, date: DATE }] }),
    ),
    http.get(url(endpoints.unidentified.list), () => ok({ items: [], total: 0, page: 1 })),
  ];
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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

/** Records every proposal that reaches `POST /logs/:driverId/edit-requests`, answering slowly. */
function captureEditRequests() {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.post(url(endpoints.logs.createEditRequest(DRIVER_ID)), async ({ request }) => {
      bodies.push((await request.json()) as Record<string, unknown>);
      await new Promise((resolve) => setTimeout(resolve, 40));
      return ok({
        id: 'ler_1',
        status: 'PENDING',
        driverId: DRIVER_ID,
        originalEventId: activeEvent.id,
        proposedStatus: 'ON',
        proposedStart: '2026-09-10T18:26:58.000Z',
        proposedEnd: null,
        reason: 'Driver forgot to switch to On duty.',
        applied: false,
      });
    }),
  );
  return bodies;
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
});

describe('11.11 · Add / edit event, end to end', () => {
  it('opens a filled form from the toolbar, posts the proposal, toasts §13.3 and closes', async () => {
    server.use(...baseHandlers());
    const bodies = captureEditRequests();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    // The required times open on the record's own start, never empty.
    expect(within(dialog).getByRole('textbox', { name: /Start time/ })).toHaveValue('14:26:58');

    await userEvent.type(
      within(dialog).getByRole('textbox', { name: /Reason for the edit/ }),
      'Driver forgot to switch to On duty.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send edit request' }));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({
      originalEventId: '8801',
      proposedStatus: 'ON',
      proposedStart: '2026-09-10T18:26:58.000Z',
      reason: 'Driver forgot to switch to On duty.',
    });
    const sentToast = TOAST_COPY.editRequestSent('John Smith');
    expect(await screen.findByText(sentToast.title)).toBeInTheDocument();
    expect(screen.getByText(sentToast.description as string)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('WB-146 · a double click sends exactly one proposal', async () => {
    server.use(...baseHandlers());
    const bodies = captureEditRequests();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Add \/ edit event/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: /Reason for the edit/ }),
      'Driver forgot to switch to On duty.',
    );
    const send = within(dialog).getByRole('button', { name: 'Send edit request' });
    fireEvent.click(send);
    fireEvent.click(send);

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(bodies).toHaveLength(1);
  });

  it('B-72 · a day with no record proposes a new one (inert until the driver accepts)', async () => {
    server.use(...baseHandlers([]));
    const proposals: Array<Record<string, unknown>> = [];
    const editRequests = captureEditRequests();
    server.use(
      http.post(url(endpoints.logs.proposeEvent(DRIVER_ID)), async ({ request }) => {
        proposals.push((await request.json()) as Record<string, unknown>);
        return ok({ id: '9901', status: 'PENDING', kind: 'INSERT', recordStatus: 3, applied: false }, 201);
      }),
    );
    renderPage();

    const button = await screen.findByRole('button', { name: /Add \/ edit event/ });
    await waitFor(() => expect(button).toBeEnabled());
    expect(screen.queryByText(/This day has no duty record yet/)).not.toBeInTheDocument();
    await userEvent.click(button);
    const dialog = await screen.findByRole('dialog');
    // §395.30 banner stays: a carrier only suggests.
    expect(within(dialog).getByText(/a carrier may only suggest an edit/)).toBeInTheDocument();
    expect(within(dialog).getByText('No record on this day')).toBeInTheDocument();

    await userEvent.type(within(dialog).getByRole('textbox', { name: /Start time/ }), '08:00:00');
    await userEvent.type(within(dialog).getByRole('textbox', { name: /End time/ }), '09:30:00');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Personal' }));
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: /Reason for the edit/ }),
      'Driver drove home off duty.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send edit request' }));

    await waitFor(() => expect(proposals).toHaveLength(1));
    expect(editRequests).toHaveLength(0);
    expect(proposals[0]).toEqual({
      status: 'OFF',
      proposedSpecial: 'PC',
      eventDateTime: '2026-09-10T12:00:00.000Z',
      endDateTime: '2026-09-10T13:30:00.000Z',
      annotation: 'Driver drove home off duty.',
      notifyDriver: true,
    });
    expect(await screen.findByText(TOAST_COPY.editRequestSent('John Smith').title)).toBeInTheDocument();
  });
});
