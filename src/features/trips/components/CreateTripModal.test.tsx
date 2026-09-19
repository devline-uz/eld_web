// web/tz.md §11.10 Create trip — B-31: an unverified driver's e-mail must block `Create trip`,
// not just show the warning (WB-115).
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addDays, format } from 'date-fns';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { ok, url } from '@/mocks/envelope';
import { endpoints } from '@/shared/api/endpoints';
import { ToastProvider } from '@/shared/ui/Toast';
import { VALIDATION_MESSAGES } from '@/shared/forms/messages';
import { CreateTripModal } from './CreateTripModal';

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

function renderModal() {
  server.use(
    http.get(url(endpoints.drivers.list), () =>
      ok({ items: [UNVERIFIED_DRIVER, VERIFIED_DRIVER], page: 1, limit: 200, total: 2, totalPages: 1 }),
    ),
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
  async function fillRequiredAndSubmit(pickup: string, delivery: string, { twice = false } = {}) {
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
    await user.type(origin!, 'Columbus, OH');
    await user.type(destination!, 'Dayton, OH');
    enterWindow('Pickup', pickup);
    enterWindow('Delivery', delivery);
    await user.type(screen.getByPlaceholderText('mi'), '120.5');
    await selectDriver('Vera Verified');
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

  it('rejects a delivery before pickup', async () => {
    await fillAndSubmit({ pickup: `${day(2)}T08:00`, delivery: `${day(1)}T08:00` });
    expect(await screen.findByText('Delivery cannot be before pickup.')).toBeInTheDocument();
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
