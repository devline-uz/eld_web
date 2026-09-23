// WB-158 — 11.4 (load variant): the `Notify the driver` tick was never part of the request, and
// the driver list gave no feedback while it loaded.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import type { TripRow } from '@/shared/api/trips';
import { AssignLoadModal } from './AssignLoadModal';

const LOAD = { id: 'trp_1', number: 'LD-9912' } as TripRow;

function renderModal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AssignLoadModal load={LOAD} onClose={() => {}} />
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

describe('AssignLoadModal — 11.4 load variant', () => {
  it('disables the notify checkbox with its reason on screen (B-74)', () => {
    renderModal();
    expect(screen.getByRole('checkbox', { name: /Notify the driver in the app/ })).toBeDisabled();
    expect(screen.getByText(/the assign endpoint sends no notification/)).toBeInTheDocument();
  });

  it('assigns the picked driver and sends only what the endpoint accepts', async () => {
    const posts: unknown[] = [];
    server.use(
      http.get(url(endpoints.drivers.list), () =>
        ok({
          items: [
            { id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', homeTerminalName: 'Columbus, OH' },
          ],
          page: 1,
          limit: 25,
          total: 1,
          totalPages: 1,
        }),
      ),
      http.post(url(endpoints.trips.assign(':id')), async ({ request }) => {
        posts.push(await request.json());
        return ok({ id: 'trp_1', number: 'LD-9912' });
      }),
    );
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByText('John Smith'));
    await user.click(screen.getByRole('button', { name: 'Assign driver' }));

    expect(await screen.findByText('Load LD-9912 assigned')).toBeInTheDocument();
    expect(posts).toEqual([{ driverId: 'drv_1' }]);
  });

  it('renders drivers as one native radio group — no radio nested in a button, arrow keys move the pick', async () => {
    server.use(
      http.get(url(endpoints.drivers.list), () =>
        ok({
          items: [
            { id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', homeTerminalName: 'Columbus, OH' },
            { id: 'drv_2', username: 'adoe', firstName: 'Ann', lastName: 'Doe', status: 'ACTIVE', homeTerminalName: 'Dayton, OH' },
          ],
          page: 1,
          limit: 25,
          total: 2,
          totalPages: 1,
        }),
      ),
    );
    const user = userEvent.setup();
    renderModal();

    const group = await screen.findByRole('radiogroup', { name: 'Driver' });
    const john = await screen.findByRole('radio', { name: 'John Smith' });
    const ann = screen.getByRole('radio', { name: 'Ann Doe' });
    expect(group).toContainElement(john);
    expect(john.closest('button')).toBeNull();
    expect(john).toHaveAttribute('name', ann.getAttribute('name'));

    await user.click(john);
    expect(john).toBeChecked();
    await user.keyboard('{ArrowDown}');
    expect(ann).toBeChecked();
    expect(screen.getByRole('button', { name: 'Assign driver' })).toBeEnabled();
  });

  it('says the driver list is loading instead of rendering an empty list', async () => {
    server.use(
      http.get(url(endpoints.drivers.list), async () => {
        await new Promise((r) => setTimeout(r, 50));
        return ok({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 });
      }),
    );
    renderModal();
    expect(await screen.findByText('Loading drivers…')).toBeInTheDocument();
  });
  // WB-237 — Enter in the driver search used to do nothing.
  describe('driver search Enter', () => {
    const DRIVERS = [
      { id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', homeTerminalName: 'Columbus, OH' },
      { id: 'drv_2', username: 'adoe', firstName: 'Ann', lastName: 'Doe', status: 'ACTIVE', homeTerminalName: 'Dayton, OH' },
    ];
    let posts: unknown[];
    beforeEach(() => {
      posts = [];
      server.use(
        http.get(url(endpoints.drivers.list), ({ request }) => {
          const q = (new URL(request.url).searchParams.get('q') ?? '').toLowerCase();
          const items = DRIVERS.filter((d) => `${d.firstName} ${d.lastName} ${d.username}`.toLowerCase().includes(q));
          return ok({ items, page: 1, limit: 25, total: items.length, totalPages: 1 });
        }),
        http.post(url(endpoints.trips.assign(':id')), async ({ request }) => {
          posts.push(await request.json());
          return ok({ id: 'trp_1', number: 'LD-9912' });
        }),
      );
    });

    it('selects the first filtered driver, focuses its radio and does not submit', async () => {
      const user = userEvent.setup();
      renderModal();
      await screen.findByRole('radio', { name: 'John Smith' });

      const search = screen.getByRole('textbox', { name: 'Search driver by name, username or licence' });
      await user.type(search, 'ann');
      const ann = await screen.findByRole('radio', { name: 'Ann Doe' });
      await waitFor(() => expect(screen.queryByRole('radio', { name: 'John Smith' })).not.toBeInTheDocument());

      await user.keyboard('{Enter}');
      expect(ann).toBeChecked();
      expect(ann).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Assign driver' })).toBeEnabled();
      expect(posts).toEqual([]);
      expect(screen.queryByText('Load LD-9912 assigned')).not.toBeInTheDocument();
    });

    it('does nothing when no driver matches', async () => {
      const user = userEvent.setup();
      renderModal();
      await screen.findByRole('radio', { name: 'John Smith' });

      const search = screen.getByRole('textbox', { name: 'Search driver by name, username or licence' });
      await user.type(search, 'zzz');
      expect(await screen.findByText('No drivers match this search.')).toBeInTheDocument();

      await user.keyboard('{Enter}');
      expect(search).toHaveFocus();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Assign driver' })).toBeDisabled();
      expect(posts).toEqual([]);
    });
  });
});
