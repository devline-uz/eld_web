// 11.13 Unassigned driving — a refused assignment is never silent: a 422 on the annotation goes
// under the textarea, anything else is spelled out in the banner.
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/shared/ui/Toast';
import { ApiError } from '@/shared/api/errors';
import type * as HosLogsModule from '@/shared/api/hosLogs';
import type { UnidentifiedSegment } from '@/shared/api/hosLogs';
import { UnassignedDrivingModal } from './UnassignedDrivingModal';

const mutate = vi.fn();
vi.mock('@/shared/api/hosLogs', async (importOriginal) => ({
  ...(await importOriginal<typeof HosLogsModule>()),
  useResolveUnidentified: () => ({ mutate, isPending: false }),
}));

const SEGMENT: UnidentifiedSegment = {
  id: 'seg_1',
  vehicleId: 'veh_1',
  startAt: '2026-09-10T12:00:00.000Z',
  endAt: '2026-09-10T12:40:00.000Z',
  durationSec: 2400,
  distanceMi: 18,
  startLocation: 'Columbus, OH',
  endLocation: 'Dayton, OH',
  status: 'PENDING',
  assignedDriverId: null,
  assignedById: null,
  assignedAt: null,
  annotation: null,
  fromStoredEvents: true,
};

function renderModal() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <UnassignedDrivingModal
          segments={[SEGMENT]}
          drivers={[{ id: 'drv_1', name: 'John Smith' }]}
          unitLabel={() => 'Unit 101'}
          timezone="America/New_York"
          onClose={vi.fn()}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function submitAssignment(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('checkbox', { name: 'Select Unit 101 segment' }));
  await user.selectOptions(screen.getByRole('combobox', { name: 'Resolution for Unit 101' }), 'drv_1');
  await user.type(screen.getByRole('textbox'), 'Forgot to log in.');
  await user.click(screen.getByRole('button', { name: 'Send 1 segment for confirmation' }));
}

function fail(error: Error) {
  const options = mutate.mock.calls.at(-1)![1] as { onError: (e: Error) => void; onSettled: () => void };
  act(() => {
    options.onError(error);
    options.onSettled();
  });
}

describe('11.13 Unassigned driving — refusals', () => {
  it('a 422 on the annotation is shown under the textarea, and the other issue in the banner', async () => {
    mutate.mockClear();
    const user = userEvent.setup();
    renderModal();
    await submitAssignment(user);
    fail(
      new ApiError(422, {
        code: 'VALIDATION_FAILED',
        details: {
          issues: [
            { path: ['annotation'], code: 'too_small', message: 'String must contain at least 4 character(s)' },
            { path: ['driverId'], code: 'invalid_string', message: 'Invalid uuid' },
          ],
        },
      }),
    );

    expect(screen.getByText('String must contain at least 4 character(s)')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Driver: Invalid uuid.')).toBeInTheDocument();
  });

  it('a compliance refusal is shown verbatim', async () => {
    mutate.mockClear();
    const user = userEvent.setup();
    renderModal();
    await submitAssignment(user);
    fail(new ApiError(409, { code: 'UNIDENTIFIED_ALREADY_ASSIGNED' }));

    expect(screen.getByRole('alert')).toHaveTextContent('That segment has already been assigned.');
  });

  it("CODE-007: a segment that overlaps the driver's own log is refused with actionable copy", async () => {
    mutate.mockClear();
    const user = userEvent.setup();
    renderModal();
    await submitAssignment(user);
    fail(new ApiError(409, { code: 'UNIDENTIFIED_OVERLAPS_DRIVER_LOG' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      "This driver's own log overlaps this unidentified driving. Correct the driver's log first or assign it to another driver.",
    );
  });
});
