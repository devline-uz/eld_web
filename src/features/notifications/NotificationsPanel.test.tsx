// 11.27 Notifications panel — single-row mark-read against the missing B-56 route (WB-244).
// The row still opens its target; a failure is reported once per session; a 404/405 is
// remembered and the route is not called again; nothing pretends an item was read.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fail, server, url } from '@/mocks/server';
import { resetShellGapState } from '@/mocks/handlers/shellGaps';
import { endpoints } from '@/shared/api/endpoints';
import { resetSingleMarkReadAvailability } from '@/shared/api/notifications';
import { ToastProvider } from '@/shared/ui/Toast';
import NotificationsPanel from './NotificationsPanel';
import { MARK_ONE_UNAVAILABLE_TITLE } from './lib/copy';
import { resetMarkReadNotice } from './lib/markReadNotice';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetShellGapState();
  resetSingleMarkReadAvailability();
  resetMarkReadNotice();
});
afterAll(() => server.close());

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderPanel() {
  const onClose = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/']}>
          <NotificationsPanel onClose={onClose} isPathAllowed={() => true} />
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose, user: userEvent.setup() };
}

function rowFor(title: string) {
  const row = screen.getByText(title).closest('button');
  if (!row) throw new Error(`no row for ${title}`);
  return row;
}

function countMarkReadCalls(status: number) {
  let calls = 0;
  server.use(
    http.post(url(endpoints.notificationItem.markRead(':id')), () => {
      calls += 1;
      return fail(status, status === 404 ? 'NOT_FOUND' : 'INTERNAL', 'Cannot POST');
    }),
  );
  return () => calls;
}

describe('11.27 single-row mark-read (B-56)', () => {
  it('404: the row still opens, stays unread, one notice, and the route is not called again', async () => {
    const calls = countMarkReadCalls(404);
    const { user, onClose } = renderPanel();
    await screen.findByText('ELD disconnected');

    await user.click(rowFor('ELD disconnected'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/vehicles/veh_110'));
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText(MARK_ONE_UNAVAILABLE_TITLE)).toBeInTheDocument();
    expect(screen.getByText('Use Mark all read instead.')).toBeInTheDocument();
    expect(calls()).toBe(1);
    // No readAt was stored, so the row keeps its unread marker.
    expect(within(rowFor('ELD disconnected')).getByText('Unread')).toBeInTheDocument();

    await user.click(rowFor('HOS violation'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/drivers/drv_1'));
    expect(calls()).toBe(1);
    expect(screen.getAllByText(MARK_ONE_UNAVAILABLE_TITLE)).toHaveLength(1);
  });

  it('other failures keep retrying the call but still show the notice only once', async () => {
    const calls = countMarkReadCalls(500);
    const { user } = renderPanel();
    await screen.findByText('ELD disconnected');

    await user.click(rowFor('ELD disconnected'));
    expect(await screen.findByText(MARK_ONE_UNAVAILABLE_TITLE)).toBeInTheDocument();
    await user.click(rowFor('HOS violation'));
    await waitFor(() => expect(calls()).toBe(2));
    expect(screen.getAllByText(MARK_ONE_UNAVAILABLE_TITLE)).toHaveLength(1);
    expect(within(rowFor('HOS violation')).getByText('Unread')).toBeInTheDocument();
  });

  it('when the route exists (MSW), the row is marked read and no notice appears', async () => {
    const { user } = renderPanel();
    await screen.findByText('ELD disconnected');
    await user.click(rowFor('ELD disconnected'));
    await waitFor(() => expect(within(rowFor('ELD disconnected')).queryByText('Unread')).not.toBeInTheDocument());
    expect(screen.queryByText(MARK_ONE_UNAVAILABLE_TITLE)).not.toBeInTheDocument();
  });
});
