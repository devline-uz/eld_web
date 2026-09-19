// 11.11 Request a log edit — the geocoded Location field (B-39). The geocoder is mocked; the
// no-key fallback (read-only, never sent) is covered by HosLogsPage.test.tsx.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui/Toast';
import type { LogEventView } from '@/shared/api/hosLogs';
import { RequestLogEditModal } from './RequestLogEditModal';

const mutate = vi.fn();
vi.mock('@/shared/api/hosLogs', () => ({ useCreateEditRequest: () => ({ mutate, isPending: false }) }));
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

  it('refuses a typed name that was never picked, and sends nothing', async () => {
    mutate.mockClear();
    const user = userEvent.setup();
    const dialog = renderModal();
    const location = within(dialog).getByRole('combobox', { name: /Location/ });
    await user.clear(location);
    await user.type(location, 'Nowhere');
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for the edit/ }), 'Wrong city.');
    await user.click(within(dialog).getByRole('button', { name: 'Send edit request' }));
    expect(await within(dialog).findByText('Pick a place from the suggestions so it can be located.')).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
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
