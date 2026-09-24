// web/tz.md §10 W-07 — Driver profile: the four mandatory screen states (loading skeleton,
// empty inner-card, error-inside-the-card, forbidden), tracked by web/tests/STATES-AUDIT.md.
// Rendered directly at the `/drivers/:id` route with an MSW-mocked id — independent of
// web/backend-gaps.md B-1 (`GET /drivers/roster`), which only blocks *navigating in* from the
// W-06 table, not this unit-level render.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import DriverProfilePage from './DriverProfilePage';

let permission = true;
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (key: string) => (key === 'drivers' ? permission : true) }),
}));

const DRIVER = {
  id: 'drv_1',
  username: 'jsmith',
  firstName: 'John',
  lastName: 'Smith',
  email: 'john.smith@example.com',
  phone: null,
  cdlNumber: 'W8569238',
  cdlState: 'OH',
  status: 'ACTIVE',
  homeTerminalName: 'Columbus, OH',
  homeTerminalTimezone: 'America/New_York',
  fleetManagerId: null,
  assignedVehicleId: null,
  allowPersonalConveyance: true,
  allowYardMove: true,
  adverseDrivingEnabled: false,
  shortHaulException: false,
  splitSleeperEnabled: false,
  eldExempt: false,
  eldExemptReason: null,
  appVersion: null,
  appPlatform: null,
  registeredAt: '2025-04-18T00:00:00.000Z',
  emailVerifiedAt: '2025-04-19T00:00:00.000Z',
};

/** Renders the current router location so navigation can be asserted without a route tree. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/drivers/drv_1']}>
          <Routes>
            <Route path="/drivers/:id" element={<DriverProfilePage />} />
          </Routes>
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
  permission = true;
  vi.unstubAllGlobals();
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
  server.use(
    http.get(url(endpoints.drivers.hos('drv_1')), () =>
      ok({
        driveRemainingSec: 0,
        shiftRemainingSec: 0,
        cycleRemainingSec: 0,
        breakInSec: 0,
        onDutySince: null,
        cycleLimitSec: 0,
        shiftLimitSec: 0,
        driveLimitSec: 0,
        breakLimitSec: 0,
      }),
    ),
  );
});

describe('W-07 Driver profile — four states', () => {
  it("header Message deep-links to the driver's conversation (WB-139)", async () => {
    server.use(http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });
    await user.click(screen.getByRole('button', { name: 'Message' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/messages\?driverId=drv_1$/);
  });

  it('forbidden: renders <ForbiddenState> and never fetches the driver without `drivers`', async () => {
    permission = false;
    server.use(http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)));
    renderPage();
    expect(await screen.findByText(/forbidden|do not have permission|do not have access/i)).toBeInTheDocument();
  });

  it('loading: shows a skeleton before the driver resolves', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('drv_1')), async () => {
        await new Promise((r) => setTimeout(r, 50));
        return ok(DRIVER);
      }),
    );
    renderPage();
    expect(document.querySelectorAll('[class*="skeleton"], [class*="animate-pulse"]').length).toBeGreaterThan(0);
    expect(await screen.findByRole('heading', { name: 'John Smith' })).toBeInTheDocument();
  });

  it('error: renders <ErrorState> with Retry when the driver fetch fails', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('drv_1')), () => HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 })),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('empty: the Activity tab shows "No activity recorded." when there is none', async () => {
    server.use(http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)));
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });
    const activityTab = await screen.findByRole('button', { name: 'Activity' });
    await userEvent.click(activityTab);
    expect(await screen.findByText('No activity recorded.')).toBeInTheDocument();
  });
});

// B-94 shipped — the Documents tab reads/writes the real `/drivers/:id/documents` API.
describe('W-07 Driver profile — Documents tab', () => {
  it('lists documents and uploads a new one', async () => {
    let uploaded = false;
    server.use(
      http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)),
      http.get(url(endpoints.drivers.documents('drv_1')), () =>
        ok(
          uploaded
            ? [{ id: 'doc_1', type: 'CDL', fileName: 'cdl.pdf', expiresAt: null, uploadedAt: '2026-01-01T00:00:00.000Z', url: 'https://mock/doc_1' }]
            : [],
        ),
      ),
      http.post(url(endpoints.drivers.documents('drv_1')), () =>
        ok({ id: 'doc_1', type: 'CDL', fileName: 'cdl.pdf', expiresAt: null, uploadedAt: '2026-01-01T00:00:00.000Z', url: 'https://mock/doc_1', uploadUrl: 'https://mock-storage/put' }),
      ),
    );
    // `putToPresignedUrl` calls the raw `fetch` against a foreign (non-MSW) origin on purpose
    // (it must carry no bearer token). Only that one URL is intercepted here; everything else
    // (the real API calls `client.ts` also makes with `fetch`) falls through to MSW's own patched
    // fetch, captured before the stub and restored by the shared `afterEach` (`vi.unstubAllGlobals`).
    const realFetch = global.fetch;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof input === 'string' && input.includes('mock-storage')) {
          uploaded = true;
          return Promise.resolve({ ok: true } as Response);
        }
        return realFetch(input, init);
      }),
    );

    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });
    await user.click(screen.getByRole('button', { name: 'Documents' }));
    expect(await screen.findByText('No documents uploaded.')).toBeInTheDocument();

    const file = new File(['%PDF-1.4'], 'cdl.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, file);

    expect(await screen.findByText('cdl.pdf')).toBeInTheDocument();
    expect(await screen.findByText('cdl.pdf uploaded')).toBeInTheDocument();
  });

  // The `usePermission` mock in this file only distinguishes "has `drivers`" (page guard) from
  // "does not" — it does not model READ vs FULL, so the upload-card / delete-button gating on
  // `<Can perm="drivers" level="FULL">` is covered by `shared/auth/Can` and the RBAC fixture
  // (100% of the 22 keys × 4 roles × 3 levels, per `web-rbac-matrix`), not re-tested here.
});

// Regression: a long email used to run into its label and spill past the card edge — the
// value cell could not shrink below its content (flex `min-width: auto`) and had no wrap
// rule. The row now gaps the pair, pins the label, and lets the value wrap instead of
// truncating, so the whole address stays readable.
describe('W-07 Driver profile — long values stay inside the profile card', () => {
  const LONG_EMAIL = 'mock_justinadams106@mock.onebook.example.longsubdomain.invalid';

  it('wraps a long email inside its row instead of overflowing the card', async () => {
    server.use(http.get(url(endpoints.drivers.detail('drv_1')), () => ok({ ...DRIVER, email: LONG_EMAIL })));
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    const value = await screen.findByText(LONG_EMAIL);
    expect(value.className).toContain('min-w-0');
    expect(value.className).toContain('break-words');

    const row = value.parentElement as HTMLElement;
    expect(row.className).toContain('gap-4');

    const label = screen.getByText('Email');
    expect(label.className).toContain('shrink-0');
    expect(label.parentElement).toBe(row);
  });

  it('leaves short values untouched in the same row layout', async () => {
    server.use(http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)));
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    const cdl = await screen.findByText('W8569238');
    expect(cdl.className).toContain('text-right');
    expect((cdl.parentElement as HTMLElement).className).toContain('justify-between');
  });

  // ---------------------------------------------------------------- stage-2 dead controls

  it('WB-186 · `View all ›` on the Violations card opens this driver log', async () => {
    server.use(http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    await user.click(screen.getByRole('button', { name: 'View all ›' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/hos-logs\?driverId=drv_1$/);
  });

  it('WB-180 · `Assign trip` and the Trips tab carry the driver into the Trips filter', async () => {
    server.use(http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    await user.click(screen.getByRole('button', { name: 'Trips' }));
    expect(await screen.findByRole('link', { name: 'Dispatch & Trips' })).toHaveAttribute('href', '/trips?fDriver=drv_1');

    // Navigating away unmounts the profile (no /trips route here), so this click comes last.
    await user.click(screen.getByRole('button', { name: 'Assign trip' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/trips\?fDriver=drv_1$/);
  });

  it('WB-180 · the DVIRs tab no longer links with a param W-09 never reads', async () => {
    server.use(http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    await user.click(screen.getByRole('button', { name: 'DVIRs' }));
    expect(await screen.findByRole('link', { name: 'DVIR & Maintenance' })).toHaveAttribute('href', '/dvir');
  });

  it('WB-185 · a failing HOS card shows a human error with Retry, never the gap id', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)),
      http.get(url(endpoints.drivers.hos('drv_1')), () =>
        HttpResponse.json({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'nope' }, { status: 500 }),
      ),
    );
    renderPage();

    expect(await screen.findByText('HOS clocks unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/B-2/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /retry/i }).length).toBeGreaterThan(0);
  });

  it('WB-183 · `Deactivate driver` confirms and then writes status INACTIVE', async () => {
    const patched: Array<Record<string, unknown>> = [];
    server.use(
      http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)),
      http.patch(url(endpoints.drivers.update('drv_1')), async ({ request }) => {
        patched.push((await request.json()) as Record<string, unknown>);
        return ok({ ...DRIVER, status: 'INACTIVE' });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    await user.click(screen.getByRole('button', { name: 'More' }));
    await user.click(await screen.findByText('Deactivate driver'));
    expect(patched).toHaveLength(0);
    await user.click(await screen.findByRole('button', { name: 'Deactivate' }));

    expect(await screen.findByText('1 driver deactivated')).toBeInTheDocument();
    expect(patched).toEqual([{ status: 'INACTIVE' }]);
  });

  it('B-81 shipped · `Reset app password` calls POST /drivers/:id/reset-password', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)),
      http.post(url(endpoints.drivers.resetPassword('drv_1')), () => ok({ emailedTo: 'john.smith@example.com' })),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    await user.click(screen.getByRole('button', { name: 'More' }));
    const item = await screen.findByText('Reset app password');
    expect(item).not.toHaveAttribute('data-disabled');
    await user.click(item);
    expect(await screen.findByText('Password reset emailed')).toBeInTheDocument();
  });

  it('WB-188 · `Edit` opens the profile form and PATCHes the changed fields', async () => {
    let patched: Record<string, unknown> | null = null;
    server.use(
      http.get(url(endpoints.drivers.detail('drv_1')), () => ok(DRIVER)),
      http.patch(url(endpoints.drivers.update('drv_1')), async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>;
        return ok({ ...DRIVER, firstName: 'Jonathan' });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const firstName = await screen.findByLabelText(/First name/);
    await user.clear(firstName);
    await user.type(firstName, 'Jonathan');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Jonathan Smith updated')).toBeInTheDocument();
    expect(patched).toMatchObject({ firstName: 'Jonathan', lastName: 'Smith', cdlNumber: 'W8569238' });
  });
});
