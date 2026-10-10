// Vehicle groups (WD-116) — list, search, create/edit/delete through MSW, the four states, and the
// read-only (vehicles READ) removals.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { resetMockState } from '@/mocks/handlers/mockState';
import { resetVehicleGroupsState } from '@/mocks/handlers/vehicleGroups';
import { endpoints } from '@/shared/api/endpoints';
import { setAccessToken, setAuthBridge, resetAuthBridge } from '@/shared/api/client';
import { ToastProvider } from '@/shared/ui/Toast';
import VehicleGroupsPage from './VehicleGroupsPage';

const perm = vi.hoisted(() => ({ level: 'FULL' as 'FULL' | 'READ' }));
vi.mock('@/shared/auth/usePermission', () => ({
  usePermission: () => ({ can: (_key: string, level: 'READ' | 'FULL' = 'READ') => level === 'READ' || perm.level === 'FULL' }),
}));

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/vehicles/groups']}>
          <VehicleGroupsPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  resetAuthBridge();
  resetMockState();
  resetVehicleGroupsState();
});
afterAll(() => server.close());
beforeEach(() => {
  perm.level = 'FULL';
  setAuthBridge({ getAccessToken: () => 'test-token' });
  setAccessToken('test-token');
});

const rowOf = (text: string) => screen.getByText(text).closest('tr')!;

/** Records the JSON body of every request matching `method` + `path`, letting MSW answer. */
function recordBodies(method: 'post' | 'put' | 'patch', path: string) {
  const bodies: Array<Record<string, unknown>> = [];
  server.use(
    http[method](url(path), async ({ request }) => {
      bodies.push((await request.clone().json()) as Record<string, unknown>);
      return undefined;
    }),
  );
  return bodies;
}

describe('Vehicle groups list', () => {
  it('renders GROUP / DESCRIPTION / UNITS with the counts from the API', async () => {
    renderPage();
    expect(await screen.findByText('Midwest linehaul')).toBeInTheDocument();
    for (const header of ['GROUP', 'DESCRIPTION', 'UNITS']) expect(screen.getByText(header)).toBeInTheDocument();
    expect(within(rowOf('Midwest linehaul')).getByText('OH / IN / KY lanes')).toBeInTheDocument();
    expect(within(rowOf('Midwest linehaul')).getByText('8')).toBeInTheDocument();
    expect(within(rowOf('Regional')).getByText('—')).toBeInTheDocument();
  });

  it('filters by name in memory and shows the search empty state', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Midwest linehaul');
    await user.type(screen.getByLabelText('Search group name'), 'regio');
    expect(screen.queryByText('Midwest linehaul')).not.toBeInTheDocument();
    expect(screen.getByText('Regional')).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Search group name'));
    await user.type(screen.getByLabelText('Search group name'), 'zzz');
    expect(screen.getByText('Nothing matches "zzz"')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByText('Midwest linehaul')).toBeInTheDocument();
  });

  it('shows the empty state with New group for a writer', async () => {
    server.use(http.get(url(endpoints.vehicleGroups.list), () => ok({ items: [] })));
    renderPage();
    expect(await screen.findByText('No vehicle groups yet')).toBeInTheDocument();
    const empty = screen.getByText('No vehicle groups yet').parentElement!;
    expect(within(empty).getByRole('button', { name: 'New group' })).toBeInTheDocument();
  });

  it('shows the error state inside the card with a retry', async () => {
    server.use(http.get(url(endpoints.vehicleGroups.list), () => fail(500, 'INTERNAL', 'boom')));
    renderPage();
    expect(await screen.findByText('Could not load vehicle groups')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry|try again/i })).toBeInTheDocument();
  });
});

describe('Vehicle groups writes', () => {
  it('creates a group with picked units (one moved from another group) and refreshes the list', async () => {
    const posts = recordBodies('post', endpoints.vehicleGroups.create);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Midwest linehaul');
    await user.click(screen.getByRole('button', { name: 'New group' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Group name/), 'Night shift');
    await user.click(within(dialog).getByRole('radio', { name: 'Violet' }));
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Unit #103' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'Unit #101' }));
    expect(within(dialog).getByText('Moves from Midwest linehaul')).toBeInTheDocument();
    expect(within(dialog).getByText('2 selected')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Create group' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ name: 'Night shift', description: null, color: '#7C3AED', vehicleIds: ['veh_3', 'veh_1'] });
    expect(await screen.findByText('Group Night shift created')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(within(rowOf('Night shift')).getByText('2')).toBeInTheDocument());
    expect(within(rowOf('Midwest linehaul')).getByText('7')).toBeInTheDocument();
  });

  it('requires a name and maps a 409 onto the name field', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Midwest linehaul');
    await user.click(screen.getByRole('button', { name: 'New group' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Create group' }));
    expect(await within(dialog).findByText('Enter a group name of up to 80 characters.')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Group name/), 'Regional');
    await user.click(within(dialog).getByRole('button', { name: 'Create group' }));
    expect(await within(dialog).findByText('A vehicle group with this name already exists.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Group name/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('edits membership only: pre-selects the members and sends PUT without a PATCH', async () => {
    const puts = recordBodies('put', endpoints.vehicleGroups.members('vg_2'));
    const patches = recordBodies('patch', endpoints.vehicleGroups.update('vg_2'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Regional');
    await user.click(within(rowOf('Regional')).getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Edit group'));
    const dialog = await screen.findByRole('dialog', { name: 'Edit group Regional' });
    expect(await within(dialog).findByRole('checkbox', { name: 'Unit #102' })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Unit #101' })).not.toBeChecked();
    expect(within(dialog).getByLabelText(/Group name/)).toHaveValue('Regional');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Unit #102' }));
    expect(within(dialog).getByText('7 selected')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(puts).toHaveLength(1));
    expect(patches).toHaveLength(0);
    expect((puts[0]!.vehicleIds as string[]).includes('veh_2')).toBe(false);
    expect(puts[0]!.vehicleIds).toHaveLength(7);
    expect(await screen.findByText('Group Regional updated')).toBeInTheDocument();
    await waitFor(() => expect(within(rowOf('Regional')).getByText('7')).toBeInTheDocument());
  });

  it('renames through PATCH without touching membership', async () => {
    const puts = recordBodies('put', endpoints.vehicleGroups.members('vg_1'));
    const patches = recordBodies('patch', endpoints.vehicleGroups.update('vg_1'));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Midwest linehaul');
    await user.click(within(rowOf('Midwest linehaul')).getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Edit group'));
    const dialog = await screen.findByRole('dialog', { name: 'Edit group Midwest linehaul' });
    const name = await within(dialog).findByLabelText(/Group name/);
    await user.clear(name);
    await user.type(name, 'Midwest');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ name: 'Midwest', description: 'OH / IN / KY lanes', color: '#2F6FED' });
    expect(puts).toHaveLength(0);
    expect(await screen.findByText('Group Midwest updated')).toBeInTheDocument();
  });

  it('deletes a group after the destructive confirm', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Regional');
    await user.click(within(rowOf('Regional')).getByRole('button', { name: 'Row actions' }));
    await user.click(await screen.findByText('Delete group'));
    const dialog = await screen.findByRole('dialog', { name: 'Delete group Regional?' });
    expect(within(dialog).getByText(/Its 8 units stay in the fleet/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete group' }));
    expect(await screen.findByText('Group Regional deleted')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Regional')).not.toBeInTheDocument());
  });
});

describe('Vehicle groups RBAC (vehicles key)', () => {
  it('FULL sees New group and row actions', async () => {
    renderPage();
    await screen.findByText('Midwest linehaul');
    expect(screen.getByRole('button', { name: 'New group' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Row actions' })).toHaveLength(2);
  });

  it('READ keeps the list and search; write controls are absent from the DOM', async () => {
    perm.level = 'READ';
    renderPage();
    await screen.findByText('Midwest linehaul');
    expect(screen.getByLabelText('Search group name')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New group' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Row actions' })).not.toBeInTheDocument();
  });

  it('READ empty state has no actions', async () => {
    perm.level = 'READ';
    server.use(http.get(url(endpoints.vehicleGroups.list), () => ok({ items: [] })));
    renderPage();
    expect(await screen.findByText('No vehicle groups yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New group' })).not.toBeInTheDocument();
  });
});
