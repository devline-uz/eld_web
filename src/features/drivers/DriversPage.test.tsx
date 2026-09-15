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

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
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
