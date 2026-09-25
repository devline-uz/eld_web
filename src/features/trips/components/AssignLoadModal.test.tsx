// WB-158 — 11.4 (load variant): the `Notify the driver` tick was never part of the request, and
// the driver list gave no feedback while it loaded.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
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
  it('starts the notify checkbox checked (B-74, shipped — server default is `true`)', () => {
    renderModal();
    expect(screen.getByRole('checkbox', { name: /Notify the driver in the app/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Notify the driver in the app/ })).toBeEnabled();
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
    expect(posts).toEqual([{ driverId: 'drv_1', notify: true }]);
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
  // Was "GAP B-2" (a static `—`): the right column now shows remaining drive / cycle time.
  describe('HOS column', () => {
    const TWO = [
      { id: 'drv_1', username: 'jsmith', firstName: 'John', lastName: 'Smith', status: 'ACTIVE', homeTerminalName: 'Columbus, OH' },
      { id: 'drv_2', username: 'adoe', firstName: 'Ann', lastName: 'Doe', status: 'ACTIVE', homeTerminalName: 'Dayton, OH' },
    ];
    const rosterRow = (id: string, driveRemainingSec: number, cycleRemainingSec: number) => ({
      driver: { id, username: id, firstName: 'X', lastName: 'Y', homeTerminalName: 'Z', appVersion: null, email: null },
      dutyStatus: 'OFF_DUTY',
      unit: null,
      hos: { driveRemainingSec, shiftRemainingSec: 50_400, cycleRemainingSec },
      openViolations: 0,
      emailVerified: null,
    });
    const page = (items: unknown[]) => ok({ items, page: 1, limit: 25, total: items.length, totalPages: 1 });
    const rowOf = (name: string) => screen.getByRole('radio', { name }).closest('label') as HTMLElement;
    // 404, not 5xx: `client.ts` retries a failed GET on 5xx (1 s, 3 s), which only slows the test.
    const fail = () =>
      HttpResponse.json({ statusCode: 404, code: 'DRIVER_NOT_FOUND', message: 'Driver not found.', details: null, traceId: 't' }, { status: 404 });
    let hosCalls: string[];

    beforeEach(() => {
      hosCalls = [];
      server.use(http.get(url(endpoints.drivers.list), () => page(TWO)));
    });

    it('renders each row\'s drive and cycle time from one roster request', async () => {
      const rosterQueries: string[] = [];
      server.use(
        http.get(url(endpoints.drivers.roster), ({ request }) => {
          rosterQueries.push(new URL(request.url).search);
          return page([rosterRow('drv_1', 39_600, 252_000), rosterRow('drv_2', 1_140, 36_000)]);
        }),
        http.get(url(endpoints.drivers.hos(':id')), ({ params }) => {
          hosCalls.push(String(params.id));
          return fail();
        }),
      );
      renderModal();
      await screen.findByRole('radio', { name: 'John Smith' });
      await waitFor(() => expect(rowOf('John Smith')).toHaveTextContent('11:00 drive70:00 cycle'));
      expect(rowOf('Ann Doe')).toHaveTextContent('00:19 drive10:00 cycle');
      expect(rosterQueries).toHaveLength(1);
      expect(rosterQueries[0]).toContain('limit=25');
      expect(hosCalls).toEqual([]);
    });

    it('falls back to the per-driver clock only for a row the roster page misses', async () => {
      server.use(
        http.get(url(endpoints.drivers.roster), () => page([rosterRow('drv_1', 39_600, 252_000)])),
        http.get(url(endpoints.drivers.hos(':id')), ({ params }) => {
          hosCalls.push(String(params.id));
          return ok({ driveRemainingSec: 23_400, shiftRemainingSec: 36_000, cycleRemainingSec: 200_000 });
        }),
      );
      renderModal();
      await screen.findByRole('radio', { name: 'Ann Doe' });
      await waitFor(() => expect(rowOf('Ann Doe')).toHaveTextContent('06:30 drive55:33 cycle'));
      expect(rowOf('John Smith')).toHaveTextContent('11:00 drive');
      expect(hosCalls).toEqual(['drv_2']);
    });

    it('shows a loading placeholder per cell while the clocks are in flight', async () => {
      server.use(
        http.get(url(endpoints.drivers.roster), async () => {
          await new Promise((r) => setTimeout(r, 50));
          return page([rosterRow('drv_1', 39_600, 252_000), rosterRow('drv_2', 1_140, 36_000)]);
        }),
      );
      renderModal();
      await screen.findByRole('radio', { name: 'John Smith' });
      expect(screen.getAllByRole('status', { name: 'Loading hours' })).toHaveLength(2);
      await waitFor(() => expect(rowOf('John Smith')).toHaveTextContent('11:00 drive'));
      expect(screen.queryByRole('status', { name: 'Loading hours' })).not.toBeInTheDocument();
    });

    it('shows — when the clocks cannot be read', async () => {
      server.use(
        http.get(url(endpoints.drivers.roster), () => page([rosterRow('drv_1', 39_600, 252_000)])),
        http.get(url(endpoints.drivers.hos(':id')), () => fail()),
      );
      renderModal();
      await screen.findByRole('radio', { name: 'Ann Doe' });
      await waitFor(() => expect(rowOf('John Smith')).toHaveTextContent('11:00 drive'));
      await waitFor(() => expect(rowOf('Ann Doe')).toHaveTextContent('—'));
      expect(rowOf('Ann Doe')).not.toHaveTextContent('drive');
    });

    it('shows — in every row when the roster request fails', async () => {
      server.use(http.get(url(endpoints.drivers.roster), () => fail()));
      renderModal();
      await screen.findByRole('radio', { name: 'John Smith' });
      await waitFor(() => expect(rowOf('John Smith')).toHaveTextContent('—'));
      expect(rowOf('Ann Doe')).toHaveTextContent('—');
      expect(screen.queryByRole('status', { name: 'Loading hours' })).not.toBeInTheDocument();
    });
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
