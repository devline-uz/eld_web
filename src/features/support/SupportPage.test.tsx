// web/tz.md W-24 — four states, ticket creation, and the B-12 Viewer state (button stays in the
// DOM; a forbidden write shows inline rather than crashing the page).
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
import SupportPage from './SupportPage';
import { SUPPORT_REASON } from './lib/copy';

// WB-245/WB-246 — Submit follows `support:FULL`; each test picks the level (FULL by default).
const perm = vi.hoisted(() => ({ support: 'FULL' as 'NONE' | 'READ' | 'FULL' }));
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({
    can: (key: string, level: 'READ' | 'FULL' = 'READ') =>
      key === 'support' && (level === 'READ' ? perm.support !== 'NONE' : perm.support === 'FULL'),
  }),
}));

vi.mock('@/shared/auth/AuthProvider', () => ({
  useAuth: () => ({ user: { email: 'diane.foster@example.com' } }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SupportPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  perm.support = 'FULL';
});
afterAll(() => server.close());

beforeEach(() => {
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

describe('SupportPage — W-24', () => {
  it('opens the email and phone channels', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
    renderPage();
    await screen.findByText('Email support');
    await user.click(screen.getByRole('button', { name: /send email/i }));
    await user.click(screen.getByRole('button', { name: /call now/i }));
    expect(windowOpen).toHaveBeenCalledWith('mailto:support@onebookeld.com');
    expect(windowOpen).toHaveBeenCalledWith('tel:+18005550142');
    windowOpen.mockRestore();
  });

  it('shows the exact §13.2 empty-state copy for no tickets', async () => {
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    renderPage();
    expect(await screen.findByText('No tickets yet')).toBeInTheDocument();
    expect(screen.getByText('Open a ticket and our team replies within about four hours.')).toBeInTheDocument();
  });

  it('shows an in-card error with Retry on failure', async () => {
    server.use(http.get(url(endpoints.support.tickets), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    expect(await screen.findByText('Retry', {}, { timeout: 8000 })).toBeInTheDocument();
  });

  it('filters tickets by segment', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.support.tickets), () =>
        ok({
          items: [
            { id: 'tck_1', number: 'TCK-1', subject: 'Open one', priority: 'NORMAL', status: 'OPEN', createdAt: new Date().toISOString() },
            { id: 'tck_2', number: 'TCK-2', subject: 'In progress one', priority: 'NORMAL', status: 'IN_PROGRESS', createdAt: new Date().toISOString() },
            { id: 'tck_3', number: 'TCK-3', subject: 'Resolved one', priority: 'NORMAL', status: 'RESOLVED', createdAt: new Date().toISOString() },
          ],
          page: 1,
          limit: 50,
          total: 3,
          totalPages: 1,
        }),
      ),
    );
    renderPage();
    await screen.findByText('Open one');
    expect(screen.getByText('In progress one')).toBeInTheDocument();
    expect(screen.getByText('Resolved one')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^open/i }));
    expect(screen.queryByText('In progress one')).not.toBeInTheDocument();
    expect(screen.queryByText('Resolved one')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /in progress/i }));
    expect(screen.getByText('In progress one')).toBeInTheDocument();
    expect(screen.queryByText('Open one')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /resolved/i }));
    expect(screen.getByText('Resolved one')).toBeInTheDocument();
    expect(screen.queryByText('Open one')).not.toBeInTheDocument();

    // `All` is the landing segment and brings every ticket back.
    await user.click(screen.getByRole('button', { name: /^all 3/i }));
    expect(screen.getByRole('button', { name: /^all 3/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Open one')).toBeInTheDocument();
    expect(screen.getByText('In progress one')).toBeInTheDocument();
  });

  it('opens New ticket from the table\'s own empty state when a segment has no matches', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.support.tickets), () =>
        ok({
          items: [{ id: 'tck_1', number: 'TCK-1', subject: 'Open one', priority: 'NORMAL', status: 'OPEN', createdAt: new Date().toISOString() }],
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        }),
      ),
    );
    renderPage();
    await screen.findByText('Open one');
    await user.click(screen.getByRole('button', { name: /resolved/i }));

    expect(await screen.findByText('No tickets yet')).toBeInTheDocument();
    // Two "New ticket" buttons exist once the table's own empty state renders — the header CTA
    // and the empty-state action; the second is this test's target.
    const newTicketButtons = screen.getAllByRole('button', { name: 'New ticket' });
    await user.click(newTicketButtons[newTicketButtons.length - 1]!);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('renders populated tickets', async () => {
    server.use(
      http.get(url(endpoints.support.tickets), () =>
        ok({
          items: [
            {
              id: 'tck_1',
              number: 'TCK-000122229',
              subject: 'Device PT30_A86E offline',
              priority: 'URGENT',
              status: 'OPEN',
              requesterName: 'Sarah Chen',
              createdAt: new Date().toISOString(),
            },
          ],
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
        }),
      ),
    );
    renderPage();
    expect(await screen.findByText('Device PT30_A86E offline')).toBeInTheDocument();
  });

  it('opens a ticket and shows the created toast', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    let created: unknown = null;
    server.use(
      http.post(url(endpoints.support.createTicket), async ({ request }) => {
        created = await request.json();
        return ok({ id: 'tck_9', number: 'TCK-000009', subject: 'Test', status: 'OPEN', priority: 'NORMAL' }, 201);
      }),
    );

    renderPage();
    await user.click(await screen.findByRole('button', { name: /new ticket/i }));
    await user.type(screen.getByLabelText(/subject/i), 'Reader failed pairing');
    await user.type(screen.getByLabelText(/description/i), 'Cannot pair the PT30 to unit 126.');
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    await waitFor(() => expect(created).not.toBeNull());
    expect(created).toMatchObject({ subject: 'Reader failed pairing', priority: 'NORMAL' });
    expect(await screen.findByText('Support ticket opened')).toBeInTheDocument();
  });

  it('the attachment controls are disabled with a reason and the body carries no fake "attached" marker (B-91)', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    let body: unknown = null;
    server.use(
      http.post(url(endpoints.support.createTicket), async ({ request }) => {
        body = await request.json();
        return ok({ id: 'tck_9', number: 'TCK-000009', subject: 'Test', status: 'OPEN', priority: 'URGENT' }, 201);
      }),
    );

    renderPage();
    await user.click(await screen.findByRole('button', { name: /new ticket/i }));
    const diagnostics = screen.getByRole('checkbox', { name: /include device diagnostics/i });
    const events = screen.getByRole('checkbox', { name: /include the last 24 h/i });
    expect(diagnostics).toBeDisabled();
    expect(diagnostics).not.toBeChecked();
    expect(events).toBeDisabled();
    expect(events).not.toBeChecked();
    expect(screen.getByText(/cannot attach device diagnostics or ELD events/)).toBeInTheDocument();
    expect(screen.getByText(/the ticket API cannot carry files/)).toBeInTheDocument();
    await user.selectOptions(screen.getByDisplayValue('ELD hardware'), 'Billing');
    await user.selectOptions(screen.getByDisplayValue('Normal'), 'URGENT');
    await user.type(screen.getByLabelText(/subject/i), 'Billing question');
    await user.type(screen.getByLabelText(/description/i), 'Invoice looks wrong.');
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    await waitFor(() => expect(body).not.toBeNull());
    // Exactly the description — no "[Device diagnostics attached]" claim for a file never sent.
    expect(body).toMatchObject({ category: 'Billing', priority: 'URGENT', body: 'Invoice looks wrong.' });
  });

  it('shows a generic error toast for a non-403 ticket submission failure', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    server.use(http.post(url(endpoints.support.createTicket), () => fail(500, 'INTERNAL_ERROR', 'Boom')));

    renderPage();
    await user.click(await screen.findByRole('button', { name: /new ticket/i }));
    await user.type(screen.getByLabelText(/subject/i), 'Cannot pair device');
    await user.type(screen.getByLabelText(/description/i), 'Steps to reproduce.');
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    expect(await screen.findByText('Something went wrong on our side. Try again.')).toBeInTheDocument();
  });

  it('shows a required-field error inline when the subject is left blank', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    renderPage();
    await user.click(await screen.findByRole('button', { name: /new ticket/i }));
    await user.type(screen.getByLabelText(/description/i), 'Some description.');
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('closes the New ticket modal with Cancel', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    renderPage();
    await user.click(await screen.findByRole('button', { name: /new ticket/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('keeps the inline 403 fallback when the server still refuses a FULL-looking role (B-12)', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    server.use(http.post(url(endpoints.support.createTicket), () => fail(403, 'FORBIDDEN', 'You do not have access to this.')));

    renderPage();
    await user.click(await screen.findByRole('button', { name: /new ticket/i }));
    await user.type(screen.getByLabelText(/subject/i), 'Cannot see my hours');
    await user.type(screen.getByLabelText(/description/i), 'Please help.');
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access to this.');
    // The page itself never gets replaced by <ForbiddenState> — the form is still on screen.
    expect(screen.getByRole('button', { name: 'Submit ticket' })).toBeInTheDocument();
  });

  // WB-245 — a Viewer (`support: READ`) still sees `+ New ticket` (§21.4) but Submit is disabled
  // with the B-12 reason on screen instead of a guaranteed 403.
  it('support:READ (Viewer): New ticket stays, Submit ticket is disabled with the reason and sends nothing', async () => {
    perm.support = 'READ';
    const user = userEvent.setup();
    let calls = 0;
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    server.use(
      http.post(url(endpoints.support.createTicket), () => {
        calls += 1;
        return ok({ id: 'tkt_1' }, 201);
      }),
    );

    renderPage();
    const [newTicket] = await screen.findAllByRole('button', { name: /new ticket/i });
    if (!newTicket) throw new Error('New ticket button missing');
    await user.click(newTicket);
    await user.type(screen.getByLabelText(/subject/i), 'Cannot see my hours');
    await user.type(screen.getByLabelText(/description/i), 'Please help.');
    const submit = screen.getByRole('button', { name: 'Submit ticket' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription(SUPPORT_REASON.ticketForbidden);
    expect(screen.getByText(SUPPORT_REASON.ticketForbidden)).toBeVisible();
    await user.click(submit);
    expect(calls).toBe(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ stage-2 */

const TICKET = {
  id: 'tkt_1',
  number: '10231',
  subject: 'ELD keeps disconnecting, "unit 101"',
  priority: 'HIGH',
  status: 'OPEN',
  requesterName: 'Diane Foster',
  createdAt: new Date('2026-09-01T10:00:00Z').toISOString(),
  updatedAt: new Date('2026-09-02T10:00:00Z').toISOString(),
};

describe('SupportPage — stage-2', () => {
  it('Start chat is disabled with a visible reason (B-90)', async () => {
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    renderPage();
    expect(await screen.findByRole('button', { name: /start chat/i })).toBeDisabled();
    expect(screen.getByText('Live chat is not available yet — use email or the roadside line.')).toBeInTheDocument();
  });

  it('gives the search box an accessible name', async () => {
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [TICKET], page: 1, limit: 50, total: 1, totalPages: 1 })));
    renderPage();
    await screen.findByText(TICKET.subject);
    expect(screen.getByRole('searchbox', { name: 'Search ticket' })).toBeInTheDocument();
  });

  it('Export writes a CSV of the rows on screen, and is disabled when there are none', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [TICKET], page: 1, limit: 50, total: 1, totalPages: 1 })));
    // jsdom does not implement `URL.createObjectURL`/`revokeObjectURL` at all.
    const createObjectURL = vi.fn(() => 'blob:mock');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();

    renderPage();
    await screen.findByText(TICKET.subject);
    await user.click(screen.getByRole('button', { name: /^export$/i }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  });

  it('Export is disabled when nothing is on screen', async () => {
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    renderPage();
    await screen.findByText('No tickets yet');
    expect(screen.getByRole('button', { name: /^export$/i })).toBeDisabled();
  });

  it('renders a support-specific error card, not the fleet one', async () => {
    server.use(http.get(url(endpoints.support.tickets), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    renderPage();
    expect(await screen.findByText('Could not load your tickets')).toBeInTheDocument();
    expect(screen.queryByText('Could not load the fleet')).not.toBeInTheDocument();
  });
});
