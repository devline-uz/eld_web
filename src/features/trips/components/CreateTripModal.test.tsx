// web/tz.md §11.10 Create trip — B-31: an unverified driver's e-mail must block `Create trip`,
// not just show the warning (WB-115).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, format } from 'date-fns';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { fail, ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ToastProvider } from '@/shared/ui/Toast';
import { VALIDATION_MESSAGES } from '@/shared/forms/messages';
import type * as GeocodeModule from '@/shared/map/geocode';
import type { TripRow } from '@/shared/api/trips';
import { CreateTripModal } from './CreateTripModal';

// Place suggestions: only the exact queries below find a place; everything else is free text.
const COLUMBUS = { name: 'Columbus, Ohio, United States', lat: 39.96, lon: -83 };
const PLACES: Record<string, { name: string; lat: number; lon: number }> = {
  Columbus: COLUMBUS,
  Dayton: { name: 'Dayton, Ohio, United States', lat: 39.76, lon: -84.19 },
  Springfield: { name: 'Springfield, Ohio, United States', lat: 39.92, lon: -83.81 },
  Xenia: { name: 'Xenia, Ohio, United States', lat: 39.68, lon: -83.93 },
};
vi.mock('@/shared/map/geocode', async (importOriginal) => ({
  ...(await importOriginal<typeof GeocodeModule>()),
  usePlaceSearch: (query: string, enabled: boolean) => {
    const place = enabled ? PLACES[query.trim()] : undefined;
    return { data: place ? [place] : [], isError: false };
  },
}));

// The route preview renders its stops as `P | 1:name | … | D` so the order is assertable without a map.
vi.mock('./RoutePreview', () => ({
  RoutePreview: ({ pickup, delivery, waypoints = [] }: { pickup: { name: string } | null; delivery: { name: string } | null; waypoints?: { name: string }[] }) => (
    <p data-testid="route-preview">
      {[`P:${pickup?.name}`, ...waypoints.map((w, i) => `${i + 1}:${w.name}`), `D:${delivery?.name}`].join(' | ')}
    </p>
  ),
}));

const VALIDATION_REQUIRED = VALIDATION_MESSAGES.required;

const UNVERIFIED_DRIVER = {
  id: 'drv_unverified',
  firstName: 'Uma',
  lastName: 'Unverified',
  homeTerminalName: 'Columbus, OH',
  emailVerified: false,
};

const VERIFIED_DRIVER = {
  id: 'drv_verified',
  firstName: 'Vera',
  lastName: 'Verified',
  homeTerminalName: 'Columbus, OH',
  emailVerified: true,
};

/** `status` of every `GET /drivers` the modal made (QA fix: pickers list ACTIVE drivers only). */
const requestedStatuses: (string | null)[] = [];

function renderModal() {
  requestedStatuses.length = 0;
  server.use(
    http.get(url(endpoints.drivers.list), ({ request }) => {
      requestedStatuses.push(new URL(request.url).searchParams.get('status'));
      return ok({ items: [UNVERIFIED_DRIVER, VERIFIED_DRIVER], page: 1, limit: 200, total: 2, totalPages: 1 });
    }),
    http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
    http.get(url(endpoints.drivers.hos(':id')), () =>
      ok({ driveRemainingSec: 36000, shiftRemainingSec: 39600, cycleRemainingSec: 180000, breakInSec: 7200, onDutySince: null }),
    ),
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <CreateTripModal onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

// The trigger's own text changes once a driver is picked (placeholder → the driver's name), so
// it is located via the "Driver" field label rather than by its current label text.
function driverTriggerButton() {
  const label = screen
    .getByText((content, element) => element?.tagName === 'SPAN' && element.classList.contains('text-label') && content.trim().startsWith('Driver'))
    .closest('label');
  if (!label) throw new Error('Driver field label not found');
  return within(label).getByRole('button');
}

async function selectDriver(name: string) {
  const user = userEvent.setup();
  await user.click(driverTriggerButton());
  await user.click(await screen.findByText(name));
}

/** Fills a stop window's native `datetime-local` — `'2026-09-20T14:30'`. */
function enterWindow(label: 'Pickup' | 'Delivery', value: string) {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label} window`)), { target: { value } });
}

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('CreateTripModal — QA fix: ACTIVE drivers only', () => {
  it('asks the server for ACTIVE drivers (`?status=ACTIVE`)', async () => {
    renderModal();
    await vi.waitFor(() => expect(requestedStatuses.length).toBeGreaterThan(0));
    expect(requestedStatuses.every((s) => s === 'ACTIVE')).toBe(true);
  });
});

describe('CreateTripModal — WB-115 assignment block', () => {
  it('disables `Create trip` once an e-mail-unverified driver is picked', async () => {
    renderModal();

    await selectDriver('Uma Unverified');

    expect(await screen.findByText(/e-mail is not verified/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create trip' })).toBeDisabled();
  });

  it('leaves `Create trip` enabled for a verified driver', async () => {
    renderModal();

    await selectDriver('Vera Verified');

    expect(screen.queryByText(/e-mail is not verified/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create trip' })).not.toBeDisabled();
  });

  it('re-enables `Create trip` after swapping to a verified driver', async () => {
    renderModal();

    await selectDriver('Uma Unverified');
    expect(screen.getByRole('button', { name: 'Create trip' })).toBeDisabled();

    await selectDriver('Vera Verified');
    expect(screen.getByRole('button', { name: 'Create trip' })).not.toBeDisabled();
  });
});

describe('CreateTripModal — submit', () => {
  async function fillRequiredAndSubmit(
    pickup: string,
    delivery: string,
    {
      twice = false,
      intermediate,
      pick,
      editAfterPick,
      moveStop,
      noDriver,
    }: {
      noDriver?: boolean;
      twice?: boolean;
      intermediate?: string | string[];
      pick?: boolean;
      editAfterPick?: string;
      /** `[stop number, new position]` — picked in that stop's `Order` select before submitting. */
      moveStop?: [number, number];
    } = {},
  ) {
    const posts: Record<string, unknown>[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    renderModal();
    server.use(
      http.get(url(endpoints.vehicles.list), () =>
        ok({ items: [{ id: 'veh_1', unitNumber: '101', make: 'Volvo', model: 'VNL' }], page: 1, limit: 500, total: 1, totalPages: 1 }),
      ),
      http.post(url(endpoints.trips.create), async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>);
        await gate;
        return ok({ id: 'trp_1', number: 'TR-1' });
      }),
    );
    const user = userEvent.setup();

    const inputs = document.querySelectorAll<HTMLInputElement>('form input');
    const [reference, , , origin, , destination] = Array.from(inputs);
    await user.type(reference!, 'TR-1');
    if (pick) {
      await user.type(origin!, 'Columbus');
      await user.click(within(await screen.findByRole('option', { name: COLUMBUS.name })).getByRole('button'));
      if (editAfterPick) await user.type(origin!, editAfterPick);
    } else await user.type(origin!, 'Columbus, OH');
    await user.type(destination!, 'Dayton, OH');
    enterWindow('Pickup', pickup);
    enterWindow('Delivery', delivery);
    const intermediates = intermediate === undefined ? [] : [intermediate].flat();
    for (const [index, name] of intermediates.entries()) {
      await user.click(screen.getByRole('button', { name: '+ Add an intermediate stop' }));
      const stopLabel = screen
        .getByText((content, el) => el?.tagName === 'SPAN' && content.trim() === `Stop ${index + 1} location`)
        .closest('label')!;
      await user.type(within(stopLabel).getByRole('combobox'), name);
    }
    if (moveStop) {
      const [stopNumber, position] = moveStop;
      await user.click(screen.getByRole('combobox', { name: `Stop ${stopNumber} order` }));
      await user.click(await screen.findByRole('option', { name: String(position) }));
    }
    await user.type(screen.getByPlaceholderText('mi'), '120.5');
    if (!noDriver) await selectDriver('Vera Verified');
    const unitLabel = screen
      .getByText((content, el) => el?.tagName === 'SPAN' && el.classList.contains('text-label') && content.trim().startsWith('Unit'))
      .closest('label')!;
    await user.click(within(unitLabel).getByRole('button'));
    await user.click(await screen.findByText('#101'));

    const submit = screen.getByRole('button', { name: 'Create trip' });
    await user.click(submit);
    if (twice) await user.click(submit);
    await vi.waitFor(() => expect(posts).toHaveLength(1));
    release();
    return posts;
  }
  // Pickup must fall between today and a year out, so the dates are relative to the run day.
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  it('submits once with a blank (optional) weight, ISO dates and the delivery window', async () => {
    const posts = await fillRequiredAndSubmit(`${tomorrow}T08:00`, `${tomorrow}T14:00`, { twice: true });

    expect(posts[0]).toMatchObject({
      number: 'TR-1',
      driverId: 'drv_verified',
      vehicleId: 'veh_1',
      plannedStartAt: new Date(`${tomorrow}T08:00`).toISOString(),
      plannedEndAt: new Date(`${tomorrow}T14:00`).toISOString(),
    });
    expect(posts[0]!.weightLbs).toBeUndefined();
  });

  // WD-110 — Driver is optional: a driverless trip is PLANNED and lands in Unassigned loads.
  it('creates a trip without a driver: no validation error, POST has no driverId', async () => {
    const posts = await fillRequiredAndSubmit(`${tomorrow}T08:00`, `${tomorrow}T14:00`, { noDriver: true });
    expect(posts[0]).not.toHaveProperty('driverId');
    expect(screen.queryByText('Required')).toBeNull();
  });

  // WB-164 — `+ Add an intermediate stop` had no `onClick`; `CreateTripPayload.stops` is real.
  it('sends an added intermediate stop between the pickup and the delivery', async () => {
    const posts = await fillRequiredAndSubmit(`${tomorrow}T08:00`, `${tomorrow}T14:00`, { intermediate: 'Springfield, OH' });

    expect(posts[0]!.stops).toEqual([
      { sequence: 1, type: 'PICKUP', name: 'Columbus, OH', scheduledAt: new Date(`${tomorrow}T08:00`).toISOString() },
      { sequence: 2, type: 'CHECKPOINT', name: 'Springfield, OH', scheduledAt: undefined },
      { sequence: 3, type: 'DELIVERY', name: 'Dayton, OH', scheduledAt: new Date(`${tomorrow}T14:00`).toISOString() },
    ]);
  });

  it('sends intermediate stops in the order picked in their Order select', async () => {
    const posts = await fillRequiredAndSubmit(`${tomorrow}T08:00`, `${tomorrow}T14:00`, {
      intermediate: ['Springfield, OH', 'Xenia, OH', 'Fairborn, OH'],
      moveStop: [3, 1],
    });
    const stops = posts[0]!.stops as { sequence: number; type: string; name: string }[];

    expect(stops.map((s) => [s.sequence, s.type, s.name])).toEqual([
      [1, 'PICKUP', 'Columbus, OH'],
      [2, 'CHECKPOINT', 'Fairborn, OH'],
      [3, 'CHECKPOINT', 'Springfield, OH'],
      [4, 'CHECKPOINT', 'Xenia, OH'],
      [5, 'DELIVERY', 'Dayton, OH'],
    ]);
  });

  it('sends latitude/longitude of a picked pickup place and omits them for free-text delivery', async () => {
    const posts = await fillRequiredAndSubmit(`${tomorrow}T08:00`, `${tomorrow}T14:00`, { pick: true });
    const stops = posts[0]!.stops as Record<string, unknown>[];

    expect(stops[0]).toMatchObject({ type: 'PICKUP', name: COLUMBUS.name, latitude: COLUMBUS.lat, longitude: COLUMBUS.lon });
    expect(stops[1]).not.toHaveProperty('latitude');
    expect(stops[1]).not.toHaveProperty('longitude');
  });

  it('drops the coordinates when the pickup text is edited after picking a place', async () => {
    const posts = await fillRequiredAndSubmit(`${tomorrow}T08:00`, `${tomorrow}T14:00`, { pick: true, editAfterPick: ' dock 4' });
    const stops = posts[0]!.stops as Record<string, unknown>[];

    expect(stops[0]).toMatchObject({ type: 'PICKUP', name: `${COLUMBUS.name} dock 4` });
    expect(stops[0]).not.toHaveProperty('latitude');
  });

  // An added-then-emptied row must not be sent as a nameless stop.
  it('drops an intermediate stop left blank', async () => {
    const posts = await fillRequiredAndSubmit(`${tomorrow}T08:00`, `${tomorrow}T14:00`, { intermediate: ' ' });

    expect(posts[0]!.stops).toHaveLength(2);
  });
});

describe('CreateTripModal — date, distance and rate validation', () => {
  async function fillAndSubmit({ pickup, delivery, distance, rate }: { pickup: string; delivery?: string; distance?: string; rate?: string }) {
    renderModal();
    const user = userEvent.setup();
    enterWindow('Pickup', pickup);
    if (delivery) enterWindow('Delivery', delivery);
    if (distance) await user.type(screen.getByPlaceholderText('mi'), distance);
    if (rate) await user.type(screen.getByPlaceholderText('USD'), rate);
    await user.click(screen.getByRole('button', { name: 'Create trip' }));
  }
  const day = (offset: number) => format(addDays(new Date(), offset), 'yyyy-MM-dd');

  it('rejects a pickup before today', async () => {
    await fillAndSubmit({ pickup: `${day(-1)}T08:00` });
    expect(await screen.findByText('Pickup cannot be before today.')).toBeInTheDocument();
  });

  it('rejects a pickup more than a year out', async () => {
    await fillAndSubmit({ pickup: `${day(367)}T08:00` });
    expect(await screen.findByText('Pickup must be within one year from today.')).toBeInTheDocument();
  });

  it('reports a browser-rejected date (Feb 29 of a non-leap year) as invalid, not blank', async () => {
    renderModal();
    const pickup = screen.getByLabelText(/^Pickup window/);
    // A real browser leaves `value` empty and flags `badInput`; jsdom only does the former.
    Object.defineProperty(pickup, 'validity', { value: { badInput: true } });
    fireEvent.blur(pickup);
    expect(await screen.findByText('Enter a valid date and time.')).toBeInTheDocument();
  });

  it('rejects a delivery equal to the pickup (the API needs end > start)', async () => {
    await fillAndSubmit({ pickup: `${day(2)}T08:00`, delivery: `${day(2)}T08:00` });
    expect(await screen.findByText('Delivery must be after pickup.')).toBeInTheDocument();
  });

  it('rejects a delivery before pickup', async () => {
    await fillAndSubmit({ pickup: `${day(2)}T08:00`, delivery: `${day(1)}T08:00` });
    expect(await screen.findByText('Delivery must be after pickup.')).toBeInTheDocument();
  });

  it('requires a distance greater than 0', async () => {
    await fillAndSubmit({ pickup: `${day(1)}T08:00`, distance: '0' });
    expect(await screen.findByText('Enter a distance greater than 0.')).toBeInTheDocument();
  });

  it('ignores letters, `e`, `+` and `-` in the distance', async () => {
    renderModal();
    const distance = screen.getByPlaceholderText('mi');
    await userEvent.setup().type(distance, 'a-1e+2.5x');
    expect(distance).toHaveValue(12.5);
  });

  it('requires a rate greater than 0', async () => {
    await fillAndSubmit({ pickup: `${day(1)}T08:00`, rate: '0' });
    expect(await screen.findByText('Enter a rate greater than 0.')).toBeInTheDocument();
  });

  it('rejects a rate with more than 2 decimal places', async () => {
    await fillAndSubmit({ pickup: `${day(1)}T08:00`, rate: '1240.505' });
    expect(await screen.findByText('Use at most 2 decimal places.')).toBeInTheDocument();
  });

  it('accepts a cents-precise rate', async () => {
    await fillAndSubmit({ pickup: `${day(1)}T08:00`, rate: '1240.05' });
    // The rest of the form is blank, so submit stops on the required fields — but not on the rate.
    expect((await screen.findAllByText(VALIDATION_REQUIRED)).length).toBeGreaterThan(0);
    expect(screen.queryByText('Enter a rate greater than 0.')).not.toBeInTheDocument();
    expect(screen.queryByText('Use at most 2 decimal places.')).not.toBeInTheDocument();
  });

  it('ignores letters, `e`, `+` and `-` in the rate', async () => {
    renderModal();
    const rate = screen.getByPlaceholderText('USD');
    await userEvent.setup().type(rate, 'a-1e+2.5x');
    expect(rate).toHaveValue(12.5);
  });

  it('refuses a pasted non-number in the rate', async () => {
    renderModal();
    const user = userEvent.setup();
    const rate = screen.getByPlaceholderText('USD');
    await user.click(rate);
    await user.paste('12abc');
    expect((rate as HTMLInputElement).value).toBe('');
  });
});

describe('CreateTripModal — dirty close, payload and 422 mapping', () => {
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  /** Fills every required field; the trailing `post` handler decides the response. */
  async function fillValidForm() {
    const user = userEvent.setup();
    server.use(
      http.get(url(endpoints.vehicles.list), () =>
        ok({ items: [{ id: 'veh_1', unitNumber: '101', make: 'Volvo', model: 'VNL' }], page: 1, limit: 500, total: 1, totalPages: 1 }),
      ),
    );
    const inputs = document.querySelectorAll<HTMLInputElement>('form input');
    const [reference, , , origin, , destination] = Array.from(inputs);
    await user.type(reference!, 'TR-1');
    await user.type(origin!, 'Columbus, OH');
    await user.type(destination!, 'Dayton, OH');
    enterWindow('Pickup', `${tomorrow}T08:00`);
    enterWindow('Delivery', `${tomorrow}T14:00`);
    await selectDriver('Vera Verified');
    const unitLabel = screen
      .getByText((content, el) => el?.tagName === 'SPAN' && el.classList.contains('text-label') && content.trim().startsWith('Unit'))
      .closest('label')!;
    await user.click(within(unitLabel).getByRole('button'));
    await user.click(await screen.findByText('#101'));
    return user;
  }

  it('closes an untouched form with no discard confirm', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('closes an untouched form from X with no discard confirm', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Discard changes?')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('routes Cancel through the discard confirm after a real edit', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.type(document.querySelectorAll<HTMLInputElement>('form input')[0]!, 'TR-9');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('confirms on close after editing `Estimated drive time`, which lives outside the form', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText('h'), '9');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Discard changes?')).toBeInTheDocument();
  });

  it('submits without a distance and never sends the field when it is blank (B-73)', async () => {
    const posts: Record<string, unknown>[] = [];
    renderModal();
    server.use(
      http.post(url(endpoints.trips.create), async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>);
        return ok({ id: 'trp_1', number: 'TR-1' });
      }),
    );
    const user = await fillValidForm();

    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(Object.keys(posts[0]!)).not.toContain('distanceMi');
  });

  it('sends `Estimated drive time` as seconds (B-92, shipped)', async () => {
    const posts: Record<string, unknown>[] = [];
    renderModal();
    server.use(
      http.post(url(endpoints.trips.create), async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>);
        return ok({ id: 'trp_1', number: 'TR-1' });
      }),
    );
    const user = await fillValidForm();
    await user.type(screen.getByPlaceholderText('h'), '6');

    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]!.estimatedDriveSec).toBe(6 * 3600);
  });

  it('saves as a draft via `draft: true` and shows the draft toast', async () => {
    const posts: Record<string, unknown>[] = [];
    renderModal();
    server.use(
      http.post(url(endpoints.trips.create), async ({ request }) => {
        posts.push((await request.json()) as Record<string, unknown>);
        return ok({ id: 'trp_1', number: 'TR-1' });
      }),
    );
    const user = await fillValidForm();

    await user.click(screen.getByRole('button', { name: 'Save as draft' }));

    await vi.waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]!.draft).toBe(true);
    expect(await screen.findByText('Trip TR-1 saved as draft')).toBeInTheDocument();
  });

  it('shows a 422 on `notes` in the modal banner instead of swallowing it', async () => {
    renderModal();
    server.use(
      http.post(url(endpoints.trips.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Check the highlighted fields and try again.', {
          fields: { notes: 'Notes are limited to 500 characters.' },
        }),
      ),
    );
    const user = await fillValidForm();

    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    expect(await screen.findByText('Notes: Notes are limited to 500 characters.')).toBeInTheDocument();
  });

  it('maps a 422 on `number` onto the Trip / load ID field', async () => {
    renderModal();
    server.use(
      http.post(url(endpoints.trips.create), () =>
        fail(422, 'VALIDATION_FAILED', 'Check the highlighted fields and try again.', {
          fields: { number: 'A trip with this number already exists.' },
        }),
      ),
    );
    const user = await fillValidForm();

    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    expect(await screen.findByText('A trip with this number already exists.')).toBeInTheDocument();
  });

  function trailerTrigger() {
    const label = screen
      .getByText((content, el) => el?.tagName === 'SPAN' && el.classList.contains('text-label') && content.trim().startsWith('Trailer'))
      .closest('label')!;
    return within(label).getByRole('button');
  }

  it('searches trailers on the server (`q`, ACTIVE only, limit ≤ 200) and keeps the pick after a new search', async () => {
    const queries: URLSearchParams[] = [];
    const T = (id: string, number: string) => ({ id, number, vin: null, status: 'ACTIVE', deletedAt: null });
    renderModal();
    server.use(
      http.get(url(endpoints.trailers.list), ({ request }) => {
        const params = new URL(request.url).searchParams;
        queries.push(params);
        const q = params.get('q');
        const items = q ? [T('trl_9', 'T-9000')] : [T('trl_1', 'T-1000'), T('trl_2', 'T-2000')];
        return ok({ items, page: 1, limit: 50, total: q ? 1 : 120, totalPages: 1 });
      }),
    );
    const user = userEvent.setup();
    await user.click(trailerTrigger());
    await user.click(await screen.findByText('#T-1000'));
    expect(queries[0]?.get('status')).toBe('ACTIVE');
    expect(Number(queries[0]?.get('limit'))).toBeLessThanOrEqual(200);
    // not silently truncated: the hint says only 2 of 120 are shown
    expect(await screen.findByText(/Showing 2 of 120 trailers/)).toBeInTheDocument();
    await user.click(trailerTrigger());
    await user.type(screen.getByPlaceholderText('Search'), 'T-9');
    await vi.waitFor(() => expect(queries.some((p) => p.get('q') === 'T-9')).toBe(true));
    await user.click(await screen.findByText('#T-9000'));
    expect(trailerTrigger()).toHaveTextContent('#T-9000');
  });

  it('maps 422 TRAILER_NOT_FOUND (deleted trailer) onto the Trailer field', async () => {
    renderModal();
    server.use(
      http.get(url(endpoints.trailers.list), () =>
        ok({ items: [{ id: 'trl_1', number: 'T-1000', vin: null, status: 'ACTIVE', deletedAt: null }], page: 1, limit: 50, total: 1, totalPages: 1 }),
      ),
      http.post(url(endpoints.trips.create), () =>
        fail(422, 'TRAILER_NOT_FOUND', 'Trailer not found.', { trailerId: 'This trailer has been deleted and cannot be assigned.' }),
      ),
    );
    const user = await fillValidForm();
    await user.click(trailerTrigger());
    await user.click(await screen.findByText('#T-1000'));
    await user.click(screen.getByRole('button', { name: 'Create trip' }));
    expect(await screen.findByText('This trailer has been deleted and cannot be assigned.')).toBeInTheDocument();
  });

  it('shows a 409 TRIP_SCHEDULE_CONFLICT under the Unit field naming the other trip, and keeps the modal open', async () => {
    const start = new Date(Date.UTC(2031, 0, 5, 14, 0));
    const end = new Date(Date.UTC(2031, 0, 6, 2, 0));
    const { onClose } = renderModal();
    server.use(
      http.post(url(endpoints.trips.create), () =>
        fail(409, 'TRIP_SCHEDULE_CONFLICT', 'Unit 101 is already assigned to another trip (TRP-500) from 2031-01-05 14:00 UTC to 2031-01-06 02:00 UTC.', {
          vehicleId: 'Unit 101 is already assigned to another trip (TRP-500) from 2031-01-05 14:00 UTC to 2031-01-06 02:00 UTC.',
          conflict: { tripId: 'trp_500', number: 'TRP-500', status: 'ASSIGNED', unitNumber: '101', start: start.toISOString(), end: end.toISOString() },
        }),
      ),
    );
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    const unitLabel = screen
      .getByText((content, el) => el?.tagName === 'SPAN' && el.classList.contains('text-label') && content.trim().startsWith('Unit'))
      .closest('label')!;
    expect(await within(unitLabel).findByRole('alert')).toHaveTextContent(
      `Unit 101 is already assigned to another trip (TRP-500) from ${format(start, 'MMM dd, HH:mm')} to ${format(end, 'MMM dd, HH:mm')}.`,
    );
    expect(screen.getByText('Overlaps trip TRP-500 on this unit.')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['driver', 'Driver', 'Ana Silva', { driverName: 'Ana Silva' }, 'Driver Ana Silva is already assigned to another trip (TRP-501)', 'Overlaps trip TRP-501 on this driver.'],
    ['trailer', 'Trailer', 'T-77', { trailerNumber: 'T-77' }, 'Trailer T-77 is already assigned to another trip (TRP-501)', 'Overlaps trip TRP-501 on this trailer.'],
  ])('shows a 409 TRIP_SCHEDULE_CONFLICT for the %s under its own field', async (resource, label, _n, extra, message, hint) => {
    const { onClose } = renderModal();
    server.use(
      http.post(url(endpoints.trips.create), () =>
        fail(409, 'TRIP_SCHEDULE_CONFLICT', 'Conflict', {
          conflict: { resource, tripId: 'trp_501', number: 'TRP-501', unitNumber: null, ...extra, start: new Date(Date.UTC(2031, 0, 5, 14, 0)).toISOString(), end: null },
        }),
      ),
    );
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    const fieldLabel = screen
      .getByText((content, el) => el?.tagName === 'SPAN' && el.classList.contains('text-label') && content.trim().startsWith(label))
      .closest('label')!;
    expect(await within(fieldLabel).findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  function tripIdLabel() {
    return screen
      .getByText((content, el) => el?.tagName === 'SPAN' && el.classList.contains('text-label') && content.trim().startsWith('Trip / load ID'))
      .closest('label')!;
  }

  it.each([
    ['keyed details.number (current backend)', { number: 'A trip with this number already exists.' }],
    ['with no details (older backend build)', undefined],
  ])('shows a duplicate trip / load ID 409 CONFLICT %s under that field, not the generic banner', async (_case, details) => {
    const { onClose } = renderModal();
    server.use(http.post(url(endpoints.trips.create), () => fail(409, 'CONFLICT', 'A trip with this number already exists.', details)));
    const user = await fillValidForm();
    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    expect(await within(tripIdLabel()).findByRole('alert')).toHaveTextContent('A trip with this ID already exists.');
    expect(within(tripIdLabel()).getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('That value is already in use.')).not.toBeInTheDocument();
    expect(screen.queryByText('A trip with this number already exists.')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a plain 500 in the banner as well as the toast', async () => {
    renderModal();
    server.use(http.post(url(endpoints.trips.create), () => fail(500, 'INTERNAL_ERROR', 'Boom')));
    const user = await fillValidForm();

    await user.click(screen.getByRole('button', { name: 'Create trip' }));

    expect((await screen.findAllByText('Something went wrong on our side. Try again.')).length).toBeGreaterThan(0);
  });
});

describe('CreateTripModal — trailer list shape (crash on open)', () => {
  function trailerTriggerButton() {
    const label = screen
      .getByText((content, element) => element?.tagName === 'SPAN' && element.classList.contains('text-label') && content.trim().startsWith('Trailer'))
      .closest('label');
    if (!label) throw new Error('Trailer field label not found');
    return within(label).getByRole('button');
  }

  it('opens without crashing when `GET /trailers` answers with a bare array (pre-paging backend)', async () => {
    let trailerRequests = 0;
    server.use(
      http.get(url(endpoints.trailers.list), () => {
        trailerRequests += 1;
        return ok([
          { id: 'trl_a', number: 'T-100', vin: null, status: 'ACTIVE', deletedAt: null },
          { id: 'trl_off', number: 'T-900', vin: null, status: 'INACTIVE', deletedAt: null },
        ]);
      }),
    );
    renderModal();
    await vi.waitFor(() => expect(trailerRequests).toBeGreaterThan(0));
    const user = userEvent.setup();
    await user.click(trailerTriggerButton());
    expect(await screen.findByText('#T-100')).toBeInTheDocument();
    // The old build ignored `?status=ACTIVE`; the normaliser applies it client-side.
    expect(screen.queryByText('#T-900')).not.toBeInTheDocument();
  });
});

describe('CreateTripModal — edit mode (`PATCH /trips/:id`)', () => {
  /** A PLANNED trip whose pickup is already in the past. */
  const PAST_TRIP: TripRow = {
    id: 'trp_edit',
    number: 'TR-7001',
    driverId: 'drv_verified',
    vehicleId: 'veh_1',
    trailerId: null,
    status: 'PLANNED',
    shippingDocument: 'BOL-1',
    commodity: null,
    weightLbs: 30000,
    pieces: null,
    plannedStartAt: addDays(new Date(), -3).toISOString(),
    plannedEndAt: addDays(new Date(), -2).toISOString(),
    startedAt: null,
    completedAt: null,
    etaAt: null,
    onTime: null,
    notes: null,
    createdById: 'usr_1',
    createdAt: addDays(new Date(), -5).toISOString(),
    stops: [
      { id: 's1', tripId: 'trp_edit', sequence: 1, type: 'PICKUP', name: 'Columbus, OH', address: null, latitude: null, longitude: null, scheduledAt: null, arrivedAt: null, departedAt: null, status: 'PENDING', note: null },
      { id: 's2', tripId: 'trp_edit', sequence: 2, type: 'DELIVERY', name: 'Dayton, OH', address: null, latitude: null, longitude: null, scheduledAt: null, arrivedAt: null, departedAt: null, status: 'PENDING', note: null },
    ],
    distanceMi: '72.5',
    rateUsd: '1240.00',
    customer: 'Acme',
    estimatedDriveSec: 7200,
    driver: { id: 'drv_verified', firstName: 'Vera', lastName: 'Verified' },
    vehicle: { id: 'veh_1', unitNumber: '101' },
  };

  function renderEdit(trip: TripRow = PAST_TRIP) {
    const patches: Record<string, unknown>[] = [];
    server.use(
      http.get(url(endpoints.drivers.list), () => ok({ items: [VERIFIED_DRIVER], page: 1, limit: 200, total: 1, totalPages: 1 })),
      http.get(url(endpoints.vehicles.list), () => ok({ items: [], page: 1, limit: 500, total: 0, totalPages: 1 })),
      http.get(url(endpoints.drivers.hos(':id')), () =>
        ok({ driveRemainingSec: 36000, shiftRemainingSec: 39600, cycleRemainingSec: 180000, breakInSec: 7200, onDutySince: null }),
      ),
      http.patch(url(endpoints.trips.update(':id')), async ({ request }) => {
        patches.push((await request.json()) as Record<string, unknown>);
        return ok({ ...trip });
      }),
    );
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onClose = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CreateTripModal trip={trip} onClose={onClose} />
        </ToastProvider>
      </QueryClientProvider>,
    );
    return { onClose, patches };
  }

  it('prefills the trip and renders the ID, stops and assignment read-only', () => {
    renderEdit();
    expect(screen.getByText('Edit trip TR-7001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('TR-7001')).toHaveAttribute('readonly');
    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument();
    expect(screen.getByDisplayValue('BOL-1')).toBeInTheDocument();
    expect(screen.getByText('Columbus, OH')).toBeInTheDocument();
    expect(screen.getByText('Vera Verified')).toBeInTheDocument();
    expect(screen.getByText('#101')).toBeInTheDocument();
    expect(screen.queryByText('+ Add an intermediate stop')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save as draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('sends only the changed fields, and a past pickup left untouched is not refused', async () => {
    const { patches, onClose } = renderEdit();
    const user = userEvent.setup();
    const customer = screen.getByDisplayValue('Acme');
    await user.clear(customer);
    await user.type(customer, 'Globex');
    const rate = screen.getByPlaceholderText('USD');
    await user.clear(rate);
    await user.type(rate, '1500');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await vi.waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toEqual({ customer: 'Globex', rateUsd: 1500 });
    expect(await screen.findByText('Trip TR-7001 updated')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it('still refuses moving the pickup to another past date', async () => {
    const { patches } = renderEdit();
    const user = userEvent.setup();
    enterWindow('Pickup', `${format(addDays(new Date(), -1), 'yyyy-MM-dd')}T08:00`);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Pickup cannot be before today.')).toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it('refuses clearing a number the PATCH cannot null', async () => {
    const { patches } = renderEdit();
    const user = userEvent.setup();
    await user.clear(screen.getByPlaceholderText('lbs'));

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('This value can be changed but not cleared.')).toBeInTheDocument();
    expect(patches).toHaveLength(0);
  });

  it('maps 409 TRIP_SCHEDULE_CONFLICT under the pickup window', async () => {
    renderEdit();
    server.use(
      http.patch(url(endpoints.trips.update(':id')), () =>
        fail(409, 'TRIP_SCHEDULE_CONFLICT', 'Conflict', {
          conflict: { tripId: 'trp_x', number: 'TR-9', unitNumber: '101', start: new Date().toISOString(), end: null },
        }),
      ),
    );
    const user = userEvent.setup();
    enterWindow('Pickup', `${format(addDays(new Date(), 2), 'yyyy-MM-dd')}T08:00`);
    enterWindow('Delivery', `${format(addDays(new Date(), 3), 'yyyy-MM-dd')}T08:00`);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText(/already assigned to another trip \(TR-9\)/)).toBeInTheDocument();
  });

  it('toasts and closes on 409 TRIP_NOT_EDITABLE', async () => {
    const { onClose } = renderEdit();
    server.use(
      http.patch(url(endpoints.trips.update(':id')), () => fail(409, 'TRIP_NOT_EDITABLE', 'Not editable')),
    );
    const user = userEvent.setup();
    await user.type(screen.getByDisplayValue('Acme'), ' Inc');

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Delivered and cancelled trips can no longer be edited.')).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CreateTripModal — route preview', () => {
  async function pickPlace(input: HTMLElement, query: string) {
    const user = userEvent.setup();
    await user.type(input, query);
    await user.click(within(await screen.findByRole('option', { name: PLACES[query]!.name })).getByRole('button'));
  }
  const stopInput = (n: number) =>
    within(
      screen.getByText((content, el) => el?.tagName === 'SPAN' && content.trim() === `Stop ${n} location`).closest('label')!,
    ).getByRole('combobox');

  it('shows pickup first, stops in their Order, delivery last — and follows reorders and removals', async () => {
    renderModal();
    const user = userEvent.setup();
    const [, , , origin, , destination] = Array.from(document.querySelectorAll<HTMLInputElement>('form input'));

    await pickPlace(origin!, 'Columbus');
    expect(screen.queryByTestId('route-preview')).not.toBeInTheDocument();
    await pickPlace(destination!, 'Dayton');
    expect(screen.getByTestId('route-preview')).toHaveTextContent(`P:${COLUMBUS.name} | D:${PLACES.Dayton!.name}`);

    const addStop = screen.getByRole('button', { name: '+ Add an intermediate stop' });
    await user.click(addStop);
    await pickPlace(stopInput(1), 'Springfield');
    await user.click(addStop);
    await user.type(stopInput(2), 'Somewhere unpicked'); // free text, no coordinates → skipped
    await user.click(addStop); // left blank → skipped
    await user.click(addStop);
    await pickPlace(stopInput(4), 'Xenia');

    const springfield = PLACES.Springfield!.name;
    const xenia = PLACES.Xenia!.name;
    expect(screen.getByTestId('route-preview')).toHaveTextContent(
      `P:${COLUMBUS.name} | 1:${springfield} | 2:${xenia} | D:${PLACES.Dayton!.name}`,
    );

    // Move Xenia (stop 4) to position 1.
    await user.click(screen.getByRole('combobox', { name: 'Stop 4 order' }));
    await user.click(await screen.findByRole('option', { name: '1' }));
    expect(screen.getByTestId('route-preview')).toHaveTextContent(
      `P:${COLUMBUS.name} | 1:${xenia} | 2:${springfield} | D:${PLACES.Dayton!.name}`,
    );

    // Remove Xenia (now stop 1).
    await user.click(screen.getByRole('button', { name: 'Remove stop 1' }));
    expect(screen.getByTestId('route-preview')).toHaveTextContent(
      `P:${COLUMBUS.name} | 1:${springfield} | D:${PLACES.Dayton!.name}`,
    );

    // Editing a stop's text drops its coordinates, so it leaves the preview.
    await user.type(stopInput(1), ' dock'); // Springfield is stop 1 after the removal
    expect(screen.getByTestId('route-preview')).toHaveTextContent(`P:${COLUMBUS.name} | D:${PLACES.Dayton!.name}`);
  });
});
