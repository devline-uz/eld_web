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
  id: '0e7c5a4e-1d2b-4c3a-9f10-0000000000d1',
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

function renderPage(path = '/drivers/0e7c5a4e-1d2b-4c3a-9f10-0000000000d1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
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
    http.get(url(endpoints.drivers.hos('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () =>
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
    server.use(http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });
    await user.click(screen.getByRole('button', { name: 'Message' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/messages\?driverId=0e7c5a4e-1d2b-4c3a-9f10-0000000000d1$/);
  });

  it('forbidden: renders <ForbiddenState> and never fetches the driver without `drivers`', async () => {
    permission = false;
    server.use(http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)));
    renderPage();
    expect(
      await screen.findByText(/forbidden|do not have permission|do not have access/i),
    ).toBeInTheDocument();
  });

  it('loading: shows a skeleton before the driver resolves', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), async () => {
        await new Promise((r) => setTimeout(r, 50));
        return ok(DRIVER);
      }),
    );
    renderPage();
    expect(
      document.querySelectorAll('[class*="skeleton"], [class*="animate-pulse"]').length,
    ).toBeGreaterThan(0);
    expect(await screen.findByRole('heading', { name: 'John Smith' })).toBeInTheDocument();
  });

  it('error: renders <ErrorState> with Retry when the driver fetch fails', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () =>
        HttpResponse.json(
          { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Boom' },
          { status: 500 },
        ),
      ),
    );
    renderPage();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('LIVE-019 — a 404 is "Driver not found" with a way back, not a Retry', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () =>
        HttpResponse.json({ statusCode: 404, code: 'NOT_FOUND', message: 'Not found' }, { status: 404 }),
      ),
    );
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Driver not found' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Back to drivers' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/drivers$/);
  });

  it('LIVE-019 — a malformed id is "not found" and never reaches the API', async () => {
    const requests: string[] = [];
    server.events.on('request:start', ({ request }) => requests.push(request.url));
    renderPage('/drivers/not-a-uuid');
    expect(await screen.findByRole('heading', { name: 'Driver not found' })).toBeInTheDocument();
    expect(requests.filter((u) => u.includes('not-a-uuid'))).toEqual([]);
    server.events.removeAllListeners('request:start');
  });

  it('LIVE-024 — the Activity tab says plainly when nothing is on file', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)),
      http.get(url(endpoints.auditLog.list), () => ok({ items: [], nextCursor: null })),
    );
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });
    const activityTab = await screen.findByRole('button', { name: 'Activity' });
    await userEvent.click(activityTab);
    expect(await screen.findByText('No changes or sign-ins recorded for this driver yet.')).toBeInTheDocument();
  });

  it('LIVE-024 — the Activity tab lists this driver record\'s audit trail', async () => {
    let query = '';
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)),
      http.get(url(endpoints.auditLog.list), ({ request }) => {
        query = new URL(request.url).search;
        return ok({
          items: [
            { id: 'a2', createdAt: '2026-10-13T15:00:00.000Z', actorType: 'USER', actorName: 'Sarah Chen', action: 'UPDATE', objectType: 'Driver', objectId: '0e7c5a4e-1d2b-4c3a-9f10-0000000000d1' },
            { id: 'a1', createdAt: '2026-10-12T15:00:00.000Z', actorType: 'DRIVER', action: 'LOGIN', objectType: 'Driver', objectId: '0e7c5a4e-1d2b-4c3a-9f10-0000000000d1' },
          ],
          nextCursor: null,
        });
      }),
    );
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });
    await userEvent.click(await screen.findByRole('button', { name: 'Activity' }));
    expect(await screen.findByText('Profile updated')).toBeInTheDocument();
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Signed in to the app')).toBeInTheDocument();
    expect(query).toContain('objectType=Driver');
    expect(query).toContain('objectId=0e7c5a4e-1d2b-4c3a-9f10-0000000000d1');
  });
});

// B-94 shipped — the Documents tab reads/writes the real `/drivers/:id/documents` API.
describe('W-07 Driver profile — Documents tab', () => {
  it('lists documents and uploads a new one', async () => {
    let uploaded = false;
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)),
      http.get(url(endpoints.drivers.documents('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () =>
        ok(
          uploaded
            ? [
                {
                  id: 'doc_1',
                  type: 'CDL',
                  fileName: 'cdl.pdf',
                  expiresAt: null,
                  uploadedAt: '2026-01-01T00:00:00.000Z',
                  url: 'https://mock/doc_1',
                },
              ]
            : [],
        ),
      ),
      http.post(url(endpoints.drivers.documents('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () =>
        ok({
          id: 'doc_1',
          type: 'CDL',
          fileName: 'cdl.pdf',
          expiresAt: null,
          uploadedAt: '2026-01-01T00:00:00.000Z',
          url: 'https://mock/doc_1',
          uploadUrl: 'https://mock-storage/put',
        }),
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

  it('a file name past the CreateDriverDocumentDto limit is refused before any upload', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)),
      http.get(url(endpoints.drivers.documents('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok([])),
    );
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });
    await user.click(screen.getByRole('button', { name: 'Documents' }));
    await screen.findByText('No documents uploaded.');

    const file = new File(['%PDF-1.4'], `${'a'.repeat(201)}.pdf`, { type: 'application/pdf' });
    await user.upload(document.querySelector('input[type="file"]') as HTMLInputElement, file);

    expect(
      await screen.findByText('File name must be 200 characters or fewer — rename the file and try again.'),
    ).toBeInTheDocument();
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
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok({ ...DRIVER, email: LONG_EMAIL })),
    );
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
    server.use(http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)));
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    const cdl = await screen.findByText('W8569238');
    expect(cdl.className).toContain('text-right');
    expect((cdl.parentElement as HTMLElement).className).toContain('justify-between');
  });

  // ---------------------------------------------------------------- stage-2 dead controls

  it('WB-186 · `View all ›` on the Violations card opens this driver log', async () => {
    server.use(http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    await user.click(screen.getByRole('button', { name: 'View all ›' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/hos-logs\?driverId=0e7c5a4e-1d2b-4c3a-9f10-0000000000d1$/);
  });

  it('WB-180 · `Assign trip` and the Trips tab carry the driver into the Trips filter', async () => {
    server.use(http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    await user.click(screen.getByRole('button', { name: 'Trips' }));
    expect(await screen.findByRole('link', { name: 'Dispatch & Trips' })).toHaveAttribute(
      'href',
      '/trips?fDriver=0e7c5a4e-1d2b-4c3a-9f10-0000000000d1',
    );

    // Navigating away unmounts the profile (no /trips route here), so this click comes last.
    await user.click(screen.getByRole('button', { name: 'Assign trip' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/trips\?fDriver=0e7c5a4e-1d2b-4c3a-9f10-0000000000d1$/);
  });

  it('WB-180 · the DVIRs tab no longer links with a param W-09 never reads', async () => {
    server.use(http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)));
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole('heading', { name: 'John Smith' });

    await user.click(screen.getByRole('button', { name: 'DVIRs' }));
    expect(await screen.findByRole('link', { name: 'DVIR & Maintenance' })).toHaveAttribute(
      'href',
      '/dvir',
    );
  });

  it('WB-185 · a failing HOS card shows a human error with Retry, never the gap id', async () => {
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)),
      http.get(url(endpoints.drivers.hos('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () =>
        HttpResponse.json(
          { statusCode: 500, code: 'INTERNAL_ERROR', message: 'nope' },
          { status: 500 },
        ),
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
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)),
      http.patch(url(endpoints.drivers.update('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), async ({ request }) => {
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
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)),
      http.post(url(endpoints.drivers.resetPassword('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () =>
        ok({ emailedTo: 'john.smith@example.com' }),
      ),
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
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(DRIVER)),
      http.patch(url(endpoints.drivers.update('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), async ({ request }) => {
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
    expect(patched).toMatchObject({
      firstName: 'Jonathan',
      lastName: 'Smith',
      cdlNumber: 'W8569238',
    });
  });
});

describe('W-07 Driver profile — pending email change', () => {
  const PENDING = { ...DRIVER, pendingEmail: 'new@example.com', pendingEmailRequestedAt: '2026-10-13T10:00:00.000Z' };

  it('shows "Pending: … — awaiting confirmation" with Resend and Cancel; the current email stays', async () => {
    server.use(http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(PENDING)));
    renderPage();
    expect(await screen.findByText('Pending: new@example.com — awaiting confirmation')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel change' })).toBeInTheDocument();
    // Verified current address: no "not verified" badge just because a change is pending.
    expect(screen.queryByText('Email not verified')).toBeNull();
  });

  it('Resend posts to the resend endpoint; Cancel deletes the pending change', async () => {
    const calls: string[] = [];
    server.use(
      http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok(PENDING)),
      http.post(url(endpoints.drivers.emailChangeResend('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => {
        calls.push('resend');
        return ok({ pendingEmail: 'new@example.com', emailedTo: 'new@example.com', emailDelivered: true }, 202);
      }),
      http.delete(url(endpoints.drivers.emailChange('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => {
        calls.push('cancel');
        return ok({ ...DRIVER, pendingEmail: null });
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Resend' }));
    expect(await screen.findByText('Confirmation link resent')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel change' }));
    expect(await screen.findByText('Email change cancelled')).toBeInTheDocument();
    expect(calls).toEqual(['resend', 'cancel']);
  });

  it('no banner without a pending change; an unverified current email keeps its badge', async () => {
    server.use(http.get(url(endpoints.drivers.detail('0e7c5a4e-1d2b-4c3a-9f10-0000000000d1')), () => ok({ ...DRIVER, emailVerifiedAt: null })));
    renderPage();
    expect(await screen.findByText('Email not verified')).toBeInTheDocument();
    expect(screen.queryByText(/awaiting confirmation/)).toBeNull();
  });
});
