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

  it('unchecks both attachment checkboxes and still submits successfully', async () => {
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
    await user.click(screen.getByRole('checkbox', { name: /include device diagnostics/i }));
    await user.click(screen.getByRole('checkbox', { name: /include the last 24 h/i }));
    await user.selectOptions(screen.getByDisplayValue('ELD hardware'), 'Billing');
    await user.selectOptions(screen.getByDisplayValue('Normal'), 'URGENT');
    await user.type(screen.getByLabelText(/subject/i), 'Billing question');
    await user.type(screen.getByLabelText(/description/i), 'Invoice looks wrong.');
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    await waitFor(() => expect(body).not.toBeNull());
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

  it('shows the B-12 forbidden banner inline for a Viewer instead of a failing request replacing the page', async () => {
    const user = userEvent.setup();
    server.use(http.get(url(endpoints.support.tickets), () => ok({ items: [], page: 1, limit: 50, total: 0, totalPages: 1 })));
    server.use(http.post(url(endpoints.support.createTicket), () => fail(403, 'FORBIDDEN', 'You do not have access to this.')));

    renderPage();
    // §21.4 exception — the button is present even though a VIEWER only has `support:READ`.
    await user.click(await screen.findByRole('button', { name: /new ticket/i }));
    await user.type(screen.getByLabelText(/subject/i), 'Cannot see my hours');
    await user.type(screen.getByLabelText(/description/i), 'Please help.');
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have access to this.');
    // The page itself never gets replaced by <ForbiddenState> — the form is still on screen.
    expect(screen.getByRole('button', { name: 'Submit ticket' })).toBeInTheDocument();
  });
});
