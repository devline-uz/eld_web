// 11.11 Request a log edit — the geocoded Location field (B-39). The geocoder is mocked;
// HosLogsPage.test.tsx covers the page-level payload with a geocoder that finds nothing.
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui/Toast';
import type { LogEventView } from '@/shared/api/hosLogs';
import { ApiError } from '@/shared/api/errors';
import { RequestLogEditModal } from './RequestLogEditModal';

const mutate = vi.fn();
const propose = vi.fn();
vi.mock('@/shared/api/hosLogs', () => ({
  useCreateEditRequest: () => ({ mutate, isPending: false }),
  useProposeLogEvent: () => ({ mutate: propose, isPending: false }),
}));
vi.mock('@/shared/map/geocode', () => ({
  geocodingEnabled: true,
  PLACE_QUERY_MIN: 3,
  usePlaceSearch: (query: string, enabled: boolean) => ({
    data: enabled && query.startsWith('Day') ? [{ name: 'Dayton, Ohio, United States', lat: 39.7589, lon: -84.1916 }] : [],
    isError: false,
  }),
}));

const EVENT: LogEventView = {
  id: '8801',
  eventType: 1,
  eventCode: 4,
  eventSequenceId: 1,
  eventDateTime: '2026-09-10T18:26:58.000Z',
  recordStatus: 1,
  recordOrigin: 1,
  status: 'ON',
  locationName: 'Columbus, OH',
  totalVehicleMiles: 993589,
  annotation: null,
  comment: null,
  supersedesId: null,
  editedById: null,
  editorType: null,
  editReason: null,
  vehicleId: null,
};

function renderModal() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <RequestLogEditModal
          driverId="drv_1"
          driverName="John Smith"
          date="2026-09-10"
          dateLabel="Sep 10, 2026"
          timezone="America/New_York"
          event={EVENT}
          graph={[]}
          onClose={vi.fn()}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return screen.getByRole('dialog');
}

describe('11.11 Location (geocoded)', () => {
  it('sends the picked place with its coordinates', async () => {
    const user = userEvent.setup();
    const dialog = renderModal();
    const location = within(dialog).getByRole('combobox', { name: /Location/ });
    expect(location).toHaveValue('Columbus, OH');
    await user.clear(location);
    await user.type(location, 'Dayton');
    await user.click(await within(dialog).findByRole('button', { name: 'Dayton, Ohio, United States' }));
    expect(location).toHaveValue('Dayton, Ohio, United States');
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'Wrong city.');
    await user.click(within(dialog).getByRole('button', { name: 'Send edit request' }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toMatchObject({
      location: { lat: 39.7589, lon: -84.1916, name: 'Dayton, Ohio, United States' },
    });
  });

  it('sends a typed name that was never picked as a name-only location (B-39)', async () => {
    mutate.mockClear();
    const user = userEvent.setup();
    const dialog = renderModal();
    const location = within(dialog).getByRole('combobox', { name: /Location/ });
    await user.clear(location);
    await user.type(location, 'Nowhere');
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'Wrong city.');
    await user.click(within(dialog).getByRole('button', { name: 'Send edit request' }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toMatchObject({ location: { name: 'Nowhere' } });
    expect(mutate.mock.calls[0]![0].location).not.toHaveProperty('lat');
    expect(propose).not.toHaveBeenCalled();
  });

  it('an untouched location is not sent', async () => {
    mutate.mockClear();
    const user = userEvent.setup();
    const dialog = renderModal();
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'Fix start.');
    await user.click(within(dialog).getByRole('button', { name: 'Send edit request' }));
    expect(mutate.mock.calls[0]![0]).not.toHaveProperty('location', expect.anything());
  });
});

describe('11.11 refusals are never silent', () => {
  async function submitValid(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'Wrong status.');
    await user.click(within(dialog).getByRole('button', { name: 'Send edit request' }));
  }
  function fail(error: Error) {
    const options = mutate.mock.calls.at(-1)![1] as { onError: (e: Error) => void; onSettled: () => void };
    act(() => {
      options.onError(error);
      options.onSettled();
    });
  }

  it('a 422 issue goes under its input; one with no input of its own is spelled out in the banner', async () => {
    mutate.mockClear();
    const user = userEvent.setup();
    const dialog = renderModal();
    await submitValid(user, dialog);
    fail(
      new ApiError(422, {
        code: 'VALIDATION_FAILED',
        details: {
          issues: [
            { path: ['location', 'name'], code: 'too_big', message: 'String must contain at most 120 character(s)' },
            { path: ['proposedStatus'], code: 'custom', message: 'Personal conveyance (PC) requires status OFF' },
          ],
        },
      }),
    );

    expect(within(dialog).getByText('String must contain at most 120 character(s)')).toBeInTheDocument();
    expect(within(dialog).getByRole('combobox', { name: /Location/ })).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Status: Personal conveyance (PC) requires status OFF.');
  });

  it('DRIVING_TIME_IMMUTABLE is still shown verbatim', async () => {
    mutate.mockClear();
    const user = userEvent.setup();
    const dialog = renderModal();
    await submitValid(user, dialog);
    fail(new ApiError(422, { code: 'DRIVING_TIME_IMMUTABLE' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Driving time can never be shortened, deleted or restatused (49 CFR §395.30).',
    );
  });

  it('engine hours past the DTO cap are refused on the field, sending nothing', async () => {
    mutate.mockClear();
    const user = userEvent.setup();
    const dialog = renderModal();
    await user.type(within(dialog).getByRole('textbox', { name: /Engine hours/ }), '99999.5');
    await submitValid(user, dialog);

    expect(within(dialog).getByText('Engine hours cannot exceed 99,999.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('engine hours input keeps at most 5 integer digits (LIMITS.engineHoursIntDigits)', async () => {
    const user = userEvent.setup();
    const dialog = renderModal();
    const input = within(dialog).getByRole('textbox', { name: /Engine hours/ });
    await user.type(input, '100000');
    expect(input).toHaveValue('10000');
  });
});

describe('LIVE-020 — field errors clear when the field changes', () => {
  it('drops the end-time order error once the end time is cleared', async () => {
    const user = userEvent.setup();
    const dialog = renderModal();
    const end = within(dialog).getByLabelText(/End time/);
    await user.type(end, '01:00:00');
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'Fix the end.');
    await user.click(within(dialog).getByRole('button', { name: 'Send edit request' }));
    expect(within(dialog).getByText('End time must be after the start time.')).toBeInTheDocument();

    await user.clear(end);
    expect(within(dialog).queryByText('End time must be after the start time.')).not.toBeInTheDocument();
  });
});
